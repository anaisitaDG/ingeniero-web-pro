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
    echo "🧪 PRUEBA de restauración (no toca producción)"
    echo "   Dump:  $DUMP"
    TEST_DB="${DB_NAME}_restoretest"

    # Intento A: restaurar de verdad en una base temporal (lo más completo).
    # Requiere que el usuario de BD pueda crear bases (CREATE/DROP DATABASE).
    if mysql "${CONN[@]}" -e "CREATE DATABASE IF NOT EXISTS \`$TEST_DB\` CHARACTER SET utf8mb4;" 2>/dev/null; then
      echo "   BD temporal: $TEST_DB"
      gunzip -c "$DUMP" | mysql "${CONN[@]}" "$TEST_DB"
      TABLES=$(mysql "${CONN[@]}" -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$TEST_DB';")
      USERS=$(mysql "${CONN[@]}" -N -e "SELECT COUNT(*) FROM \`$TEST_DB\`.users;" 2>/dev/null || echo "0")
      mysql "${CONN[@]}" -e "DROP DATABASE \`$TEST_DB\`;"
      echo "   🧹 Base temporal eliminada."
      if [ "$TABLES" -gt 0 ] && [ "$USERS" -gt 0 ]; then
        echo "✅ Restauración COMPLETA verificada: $TABLES tablas, $USERS usuarios. El backup sirve."
      else
        echo "⚠️  Se restauró pero quedó vacío — revísalo." >&2; exit 1
      fi
    else
      # Intento B: sin permiso para crear bases → verificar INTEGRIDAD del archivo.
      # Comprueba que el .gz no esté corrupto y contenga el esquema y los datos clave.
      echo "   ℹ️  El usuario de BD no puede crear bases temporales."
      echo "   → Verificando la INTEGRIDAD del archivo de backup en su lugar…"
      if ! gunzip -t "$DUMP" 2>/dev/null; then
        echo "❌ El archivo está CORRUPTO (gzip inválido). Backup NO utilizable." >&2; exit 1
      fi
      CONTENT=$(gunzip -c "$DUMP")
      HAS_SCHEMA=$(printf '%s' "$CONTENT" | grep -c "CREATE TABLE \`users\`" || true)
      HAS_DATA=$(printf '%s'   "$CONTENT" | grep -c "INSERT INTO \`users\`" || true)
      HAS_END=$(printf '%s'    "$CONTENT" | grep -c "Dump completed" || true)
      TABLE_COUNT=$(printf '%s' "$CONTENT" | grep -c "CREATE TABLE" || true)
      echo "   Tablas en el dump: $TABLE_COUNT"
      if [ "$HAS_SCHEMA" -ge 1 ] && [ "$HAS_DATA" -ge 1 ] && [ "$HAS_END" -ge 1 ]; then
        echo "✅ Backup ÍNTEGRO: archivo sano, con esquema, datos de usuarios y cierre correcto."
        echo "   (Para una prueba de restauración COMPLETA, pídele al admin de la BD permiso"
        echo "    CREATE/DROP, o restaura manualmente en una base de prueba.)"
      else
        echo "❌ El backup parece incompleto o truncado (falta esquema/datos/cierre). Revísalo." >&2
        exit 1
      fi
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
