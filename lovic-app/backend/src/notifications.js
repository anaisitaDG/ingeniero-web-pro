const cron = require('node-cron');
const webpush = require('web-push');
const db = require('./db');

const VAPID_PUBLIC  = 'BMyXu344UMSX0IoqheXZQnVnk9LC5bSMUVYza66Ht5jrY_LpeSe3y5b3npONMOM33uI-Rsg7z5XJBza4CHbwD6s';
const VAPID_PRIVATE = '0zl7Psjn5I2o8gyQMDmWiEgKuqgsC5hl9kG2zWvxZ30';

webpush.setVapidDetails('mailto:hola@anaismoralesmkt.com', VAPID_PUBLIC, VAPID_PRIVATE);

function colombiaToday() {
  return new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

async function sendToUser(userId, payload) {
  const [subs] = await db.query('SELECT subscription FROM push_subscriptions WHERE user_id=?', [userId]);
  for (const row of subs) {
    try {
      await webpush.sendNotification(JSON.parse(row.subscription), JSON.stringify(payload));
    } catch (err) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        // Suscripción expirada — limpiar
        const sub = JSON.parse(row.subscription);
        await db.query('DELETE FROM push_subscriptions WHERE user_id=? AND endpoint=?', [userId, sub.endpoint]);
      }
    }
  }
}

async function sendToAll(payload) {
  const [subs] = await db.query('SELECT user_id, subscription FROM push_subscriptions');
  for (const row of subs) {
    try {
      await webpush.sendNotification(JSON.parse(row.subscription), JSON.stringify(payload));
    } catch (err) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        const sub = JSON.parse(row.subscription);
        await db.query('DELETE FROM push_subscriptions WHERE endpoint=?', [sub.endpoint]);
      }
    }
  }
}

const WATER_MSGS = [
  { title: '💧 Vic tiene sed', body: 'Han pasado horas. ¿Ya tomaste agua? Por mí, un vasito. Te espero.' },
  { title: '🏜️ Me estoy apagando', body: '¿Agua? Solo uno. Por favor. Vic.' },
  { title: '💧 Recuerda hidratarte', body: 'Cada vaso de agua me hace brillar más. No me abandones.' },
];

const MORNING_MSGS = [
  { title: '🔥 ¡Buenos días!', body: 'Vic está lista. ¿Y tú? Hoy es un buen día para ser constante.' },
  { title: '☀️ Arranca el día', body: 'Empieza bien: agua, desayuno y a moverse. Yo te acompaño.' },
  { title: '🔥 Vic te espera', body: 'Nueva oportunidad, nuevo día. ¿Vamos juntas hoy?' },
];

const EVENING_MSGS = [
  { title: '💪 ¿Ya entrenaste?', body: 'La tarde es tuya. Un entreno ahora y el día queda completo.' },
  { title: '🔥 No lo dejes para mañana', body: 'Después no llega. Ahora sí puedes. Vamos.' },
  { title: '💪 Vic te está mirando', body: '¿A qué esperas? Son las mejores horas para entrenar.' },
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function startCronJobs() {
  // 8am Colombia (13:00 UTC)
  cron.schedule('0 13 * * *', async () => {
    console.log('[push] Enviando notificación matutina');
    const msg = pick(MORNING_MSGS);
    await sendToAll({ ...msg, url: '/' });
  });

  // 2pm Colombia (19:00 UTC) — recordatorio de agua
  cron.schedule('0 19 * * *', async () => {
    console.log('[push] Enviando recordatorio de agua');
    // Solo a quienes tienen < 3 vasos hoy
    const today = colombiaToday();
    const [rows] = await db.query(
      `SELECT ps.user_id, ps.subscription
       FROM push_subscriptions ps
       LEFT JOIN daily_tracking dt ON dt.user_id = ps.user_id AND DATE(dt.tracked_date) = ?
       WHERE COALESCE(dt.water_glasses, 0) < 3`,
      [today]
    );
    const msg = pick(WATER_MSGS);
    for (const row of rows) {
      try {
        await webpush.sendNotification(JSON.parse(row.subscription), JSON.stringify({ ...msg, url: '/' }));
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          const sub = JSON.parse(row.subscription);
          await db.query('DELETE FROM push_subscriptions WHERE endpoint=?', [sub.endpoint]);
        }
      }
    }
  });

  // 5pm Colombia (22:00 UTC) — motivación de tarde si no han entrenado
  cron.schedule('0 22 * * *', async () => {
    console.log('[push] Enviando motivación de tarde');
    const today = colombiaToday();
    const [rows] = await db.query(
      `SELECT ps.user_id, ps.subscription
       FROM push_subscriptions ps
       LEFT JOIN daily_tracking dt ON dt.user_id = ps.user_id AND DATE(dt.tracked_date) = ?
       WHERE COALESCE(dt.workout_done, 0) = 0`,
      [today]
    );
    const msg = pick(EVENING_MSGS);
    for (const row of rows) {
      try {
        await webpush.sendNotification(JSON.parse(row.subscription), JSON.stringify({ ...msg, url: '/' }));
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          const sub = JSON.parse(row.subscription);
          await db.query('DELETE FROM push_subscriptions WHERE endpoint=?', [sub.endpoint]);
        }
      }
    }
  });

  console.log('[push] Cron jobs de notificaciones activos');
}

module.exports = { startCronJobs, sendToUser, sendToAll };
