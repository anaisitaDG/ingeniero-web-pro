#!/usr/bin/env bash
# Backup diario de Lovic: base de datos (últimos 5 dumps) + fotos (espejo incremental)
# Uso: bash backup.sh
# Lee las credenciales del .env del backend automáticamente.
set -euo pipefail
trap 'echo "❌ Backup FALLÓ en la línea $LINENO. Revisa el error de arriba." >&2' ERR

APP_DIR="$HOME/webapps/lovic/lovic-app"
ENV_FILE="$APP_DIR/backend/.env"
BACKUP_DIR="$HOME/backups/lovic"
KEEP_DB=5   # cuántos dumps de BD conservar

# ── Leer credenciales del .env ────────────────────────────────────────────────
if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: no existe $ENV_FILE" >&2
  exit 1
fi

# El "|| true" evita que set -e aborte el script cuando una variable opcional no existe
get_env() { { grep -E "^$1=" "$ENV_FILE" || true; } | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'" | tr -d '\r'; }

DB_HOST="$(get_env DB_HOST)";     DB_HOST="${DB_HOST:-localhost}"
DB_PORT="$(get_env DB_PORT)";     DB_PORT="${DB_PORT:-3306}"
DB_USER="$(get_env DB_USER)"
DB_PASSWORD="$(get_env DB_PASSWORD)"
DB_NAME="$(get_env DB_NAME)"
DB_SOCKET="$(get_env DB_SOCKET)"
UPLOAD_PATH="$(get_env UPLOAD_PATH)"; UPLOAD_PATH="${UPLOAD_PATH:-$APP_DIR/backend/uploads}"

STAMP="$(date +%Y-%m-%d_%H%M)"
mkdir -p "$BACKUP_DIR"

# ── 1. Dump de la base de datos ───────────────────────────────────────────────
DB_FILE="$BACKUP_DIR/db_${DB_NAME}_${STAMP}.sql.gz"
DUMP_ARGS=(--single-transaction --quick --routines --triggers -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME")
if [ -n "$DB_SOCKET" ]; then
  DUMP_ARGS=(--socket="$DB_SOCKET" "${DUMP_ARGS[@]}")
else
  DUMP_ARGS=(-h"$DB_HOST" -P"$DB_PORT" "${DUMP_ARGS[@]}")
fi
mysqldump "${DUMP_ARGS[@]}" | gzip > "$DB_FILE"
echo "✅ BD respaldada: $DB_FILE ($(du -h "$DB_FILE" | cut -f1))"

# Conservar solo los últimos $KEEP_DB dumps
ls -1t "$BACKUP_DIR"/db_*.sql.gz 2>/dev/null | tail -n +$((KEEP_DB + 1)) | xargs -r rm -f
echo "🧹 Conservando los últimos $KEEP_DB dumps de BD"

# ── 2. Espejo incremental de fotos (solo copia lo nuevo/cambiado) ─────────────
if [ -d "$UPLOAD_PATH" ]; then
  MIRROR_DIR="$BACKUP_DIR/uploads_mirror"
  mkdir -p "$MIRROR_DIR"
  CHANGES=$(rsync -a --delete --stats "$UPLOAD_PATH/" "$MIRROR_DIR/" | grep -E 'Number of (regular files transferred|deleted files)' || true)
  echo "✅ Fotos sincronizadas en: $MIRROR_DIR ($(du -sh "$MIRROR_DIR" | cut -f1))"
  [ -n "$CHANGES" ] && echo "   $CHANGES"
else
  echo "⚠️  No se encontró la carpeta de uploads en $UPLOAD_PATH (omitido)"
fi

# Limpiar tars antiguos del formato anterior (si existen)
rm -f "$BACKUP_DIR"/uploads_*.tar.gz

echo "📦 Estado de los backups:"
ls -lh "$BACKUP_DIR" | grep -v '^total' || true
