#!/usr/bin/env bash
# Restauración de backups de Lovic.
#
#   bash restore.sh test            → PRUEBA SEGURA: restaura el dump más reciente
#                                     en una base de datos temporal, verifica que
#                                     tenga datos y la borra. NO toca producción.
#   bash restore.sh test <archivo>  → igual, pero usando un dump específico.
#   bash restore.sh emergency <archivo>
#                                   → EMERGENCIA: sobreescribe la base REAL con el
#                                     dump indicado. Pide confirmación escrita.
#
# Lee las credenciales del .env del backend automáticamente.
set -euo pipefail
trap 'echo "❌ Restauración FALLÓ en la línea $LINENO. Revisa el error de arriba." >&2' ERR

APP_DIR="$HOME/webapps/lovic/lovic-app"
ENV_FILE="$APP_DIR/backend/.env"
BACKUP_DIR="$HOME/backups/lovic"

if [ ! -f "$ENV_FILE" ]; then echo "ERROR: no existe $ENV_FILE" >&2; exit 1; fi

get_env() { { grep -E "^$1=" "$ENV_FILE" || true; } | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'" | tr -d '\r'; }
DB_HOST="$(get_env DB_HOST)";     DB_HOST="${DB_HOST:-localhost}"
DB_PORT="$(get_env DB_PORT)";     DB_PORT="${DB_PORT:-3306}"
DB_USER="$(get_env DB_USER)"
DB_PASSWORD="$(get_env DB_PASSWORD)"
DB_NAME="$(get_env DB_NAME)"
DB_SOCKET="$(get_env DB_SOCKET)"

# Argumentos de conexión comunes para mysql
CONN=(-u"$DB_USER" -p"$DB_PASSWORD")
if [ -n "$DB_SOCKET" ]; then CONN+=(--socket="$DB_SOCKET"); else CONN+=(-h"$DB_HOST" -P"$DB_PORT"); fi

MODE="${1:-}"
ARG_FILE="${2:-}"

# Elegir el dump: el indicado, o el más reciente
if [ -n "$ARG_FILE" ]; then
  DUMP="$ARG_FILE"
  [ -f "$DUMP" ] || DUMP="$BACKUP_DIR/$ARG_FILE"
else
  DUMP="$(ls -1t "$BACKUP_DIR"/db_*.sql.gz 2>/dev/null | head -1 || true)"
fi
if [ -z "${DUMP:-}" ] || [ ! -f "$DUMP" ]; then
  echo "ERROR: no encontré el dump a restaurar." >&2
  echo "Dumps disponibles:"; ls -1t "$BACKUP_DIR"/db_*.sql.gz 2>/dev/null || echo "  (ninguno)"
  exit 1
fi

case "$MODE" in
  test)
    TEST_DB="${DB_NAME}_restoretest"
    echo "🧪 PRUEBA de restauración (no toca producción)"
    echo "   Dump:  $DUMP"
    echo "   BD temporal: $TEST_DB"
    mysql "${CONN[@]}" -e "DROP DATABASE IF EXISTS \`$TEST_DB\`; CREATE DATABASE \`$TEST_DB\` CHARACTER SET utf8mb4;"
    gunzip -c "$DUMP" | mysql "${CONN[@]}" "$TEST_DB"
    # Verificar que se restauró con datos reales
    TABLES=$(mysql "${CONN[@]}" -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$TEST_DB';")
    USERS=$(mysql "${CONN[@]}" -N -e "SELECT COUNT(*) FROM \`$TEST_DB\`.users;" 2>/dev/null || echo "0")
    echo "   ✅ Restaurada: $TABLES tablas, $USERS usuarios."
    mysql "${CONN[@]}" -e "DROP DATABASE \`$TEST_DB\`;"
    echo "   🧹 Base temporal eliminada."
    if [ "$TABLES" -gt 0 ] && [ "$USERS" -gt 0 ]; then
      echo "✅ El backup es válido y se puede restaurar."
    else
      echo "⚠️  El backup se restauró pero parece vacío — revísalo." >&2
      exit 1
    fi
    ;;

  emergency)
    if [ -z "$ARG_FILE" ]; then echo "ERROR: indica el archivo. Uso: bash restore.sh emergency <archivo>" >&2; exit 1; fi
    echo "🚨 EMERGENCIA: vas a SOBREESCRIBIR la base REAL '$DB_NAME' con:"
    echo "   $DUMP"
    echo "   Esto BORRA los datos actuales y los reemplaza por los del backup."
    read -r -p "   Escribe exactamente 'RESTAURAR $DB_NAME' para continuar: " CONFIRM
    if [ "$CONFIRM" != "RESTAURAR $DB_NAME" ]; then echo "Cancelado."; exit 1; fi
    # Respaldo de seguridad de lo actual, por si acaso
    SAFETY="$BACKUP_DIR/pre_restore_$(date +%Y-%m-%d_%H%M).sql.gz"
    echo "   💾 Guardando respaldo del estado actual en $SAFETY …"
    mysqldump --single-transaction --quick --routines --triggers "${CONN[@]}" "$DB_NAME" | gzip > "$SAFETY"
    echo "   ♻️  Restaurando…"
    gunzip -c "$DUMP" | mysql "${CONN[@]}" "$DB_NAME"
    echo "✅ Base restaurada desde $DUMP. Reinicia el backend: pm2 restart lovic-backend"
    ;;

  *)
    echo "Uso:"
    echo "  bash restore.sh test [archivo]        # prueba segura (recomendado)"
    echo "  bash restore.sh emergency <archivo>   # restauración real (¡cuidado!)"
    echo ""
    echo "Dumps disponibles:"; ls -1t "$BACKUP_DIR"/db_*.sql.gz 2>/dev/null || echo "  (ninguno)"
    exit 1
    ;;
esac
