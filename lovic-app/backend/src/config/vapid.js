// Configuración central de VAPID (notificaciones push).
// Las llaves SOLO se leen de variables de entorno — nunca van escritas en el
// código, porque la privada es un secreto. Si faltan, el push se desactiva de
// forma segura (sin tumbar el servidor) y se avisa por consola.
const webpush = require('web-push');

const VAPID_PUBLIC  = process.env.VAPID_PUBLIC_KEY  || '';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:hola@anaismoralesmkt.com';

let configured = false;
if (VAPID_PUBLIC && VAPID_PRIVATE) {
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
    configured = true;
  } catch (e) {
    console.error('[vapid] Llaves inválidas, push desactivado:', e.message);
  }
} else {
  console.warn('[vapid] Faltan VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY en .env — notificaciones push desactivadas.');
}

module.exports = { webpush, VAPID_PUBLIC, VAPID_PRIVATE, configured };
