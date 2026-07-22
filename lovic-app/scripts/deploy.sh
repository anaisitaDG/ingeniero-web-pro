#!/usr/bin/env bash
# Deploy de Lovic: baja el código, compila el frontend, lo copia a la carpeta
# que sirve el sitio EN VIVO, y reinicia el backend.
# Uso: bash scripts/deploy.sh
set -euo pipefail
trap 'echo "❌ Deploy FALLÓ en la línea $LINENO. Revisa el error de arriba." >&2' ERR

BRANCH="claude/compassionate-knuth-whrodo"
APP_DIR="$HOME/webapps/lovic/lovic-app"
BUILD_DIR="$APP_DIR/frontend/build"
SERVED_DIR="$HOME/webapps/LovicGym-App"   # carpeta que sirve app.lovicgym.com

cd "$APP_DIR"

echo "── 1/4  Bajando código ($BRANCH) ──────────────────────────────"
git pull origin "$BRANCH"

echo "── 2/4  Compilando frontend ───────────────────────────────────"
cd "$APP_DIR/frontend"
npm run build

echo "── 3/4  Publicando a la carpeta en vivo ───────────────────────"
if [ ! -d "$SERVED_DIR" ]; then
  echo "ERROR: no existe la carpeta servida $SERVED_DIR" >&2
  exit 1
fi
# Reemplaza los assets con hash (limpios) y copia el resto del build encima
rm -rf "$SERVED_DIR/static"
cp -r "$BUILD_DIR/." "$SERVED_DIR/"
SERVED_HASH="$(grep -o 'main\.[a-z0-9]*\.js' "$SERVED_DIR/index.html" | head -1)"
BUILD_HASH="$(grep -o 'main\.[a-z0-9]*\.js' "$BUILD_DIR/index.html" | head -1)"
echo "   build:   $BUILD_HASH"
echo "   servido: $SERVED_HASH"
[ "$SERVED_HASH" = "$BUILD_HASH" ] && echo "   ✅ Coinciden" || echo "   ⚠️  No coinciden — revisar"

echo "── 4/4  Reiniciando backend ───────────────────────────────────"
cd "$APP_DIR"
pm2 restart all

echo "✅ Deploy completo. Abre app.lovicgym.com (en incógnito para ver fresco)."
