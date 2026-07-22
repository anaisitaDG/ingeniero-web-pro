// Envía una notificación push de prueba a un usuario (por correo).
// Uso: node scripts/test-push.js correo@ejemplo.com
const fs = require('fs');
const path = require('path');

// Cargar variables del .env del backend a mano (sin depender de dotenv)
const envPath = path.join(__dirname, '../backend/.env');
try {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m && !(m[1] in process.env)) {
      process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
    }
  }
} catch (e) {
  console.error('No se pudo leer', envPath, '-', e.message);
  process.exit(1);
}

const db = require('../backend/src/database/db');
const { sendToUser } = require('../backend/src/notifications');

(async () => {
  const email = process.argv[2];
  if (!email) {
    console.error('Uso: node scripts/test-push.js correo@ejemplo.com');
    process.exit(1);
  }

  const [[user]] = await db.query('SELECT id, name FROM users WHERE email = ?', [email]);
  if (!user) {
    console.error(`❌ No existe ningún usuario con el correo ${email}`);
    process.exit(1);
  }

  const [[{ n }]] = await db.query(
    'SELECT COUNT(*) AS n FROM push_subscriptions WHERE user_id = ?', [user.id]
  );
  console.log(`👤 Usuario: ${user.name}`);
  console.log(`📱 Dispositivos suscritos: ${n}`);

  if (n === 0) {
    console.log('');
    console.log('⚠️  No hay ningún dispositivo suscrito todavía.');
    console.log('   → Abre la app DESDE EL ÍCONO en tu pantalla de inicio (no Safari),');
    console.log('     toca "Activar" y dale "Permitir". Luego vuelve a correr este comando.');
    process.exit(0);
  }

  await sendToUser(user.id, {
    title: '🧪 Prueba de Lovic',
    body: '¡Si ves esto en tu iPhone, las notificaciones funcionan! 🎉',
    url: '/',
  });
  console.log('');
  console.log('✅ Notificación de prueba enviada. Revisa tu iPhone en unos segundos.');
  process.exit(0);
})().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
