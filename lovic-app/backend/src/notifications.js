const cron = require('node-cron');
const webpush = require('web-push');
const db = require('./database/db');

const VAPID_PUBLIC  = process.env.VAPID_PUBLIC_KEY  || 'BMyXu344UMSX0IoqheXZQnVnk9LC5bSMUVYza66Ht5jrY_LpeSe3y5b3npONMOM33uI-Rsg7z5XJBza4CHbwD6s';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || '0zl7Psjn5I2o8gyQMDmWiEgKuqgsC5hl9kG2zWvxZ30';

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
    try {
      console.log('[push] Enviando notificación matutina');
      const msg = pick(MORNING_MSGS);
      await sendToAll({ ...msg, url: '/' });
    } catch (e) { console.error('[push] Error matutina:', e.message); }
  });

  // 2pm Colombia (19:00 UTC) — recordatorio de agua
  cron.schedule('0 19 * * *', async () => {
    try {
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
    } catch (e) { console.error('[push] Error agua:', e.message); }
  });

  // 5pm Colombia (22:00 UTC) — motivación de tarde si no han entrenado
  cron.schedule('0 22 * * *', async () => {
    try {
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
    } catch (e) { console.error('[push] Error tarde:', e.message); }
  });

  // 6pm Colombia (23:00 UTC) — aviso de racha en riesgo
  cron.schedule('0 23 * * *', async () => {
    try {
      console.log('[push] Revisando rachas en riesgo');
      const [subs] = await db.query('SELECT DISTINCT user_id FROM push_subscriptions');
      const today = colombiaToday();
      for (const { user_id } of subs) {
        try {
          const [logDays] = await db.query(
            `SELECT DISTINCT DATE_FORMAT(logged_date,'%Y-%m-%d') as d FROM workout_logs WHERE user_id=? AND logged_date <= ? ORDER BY d DESC LIMIT 60`,
            [user_id, today]
          );
          const [trackDays] = await db.query(
            `SELECT DATE_FORMAT(tracked_date,'%Y-%m-%d') as d FROM daily_tracking WHERE user_id=? AND (workout_done=1 OR diet_followed=1) AND tracked_date <= ? ORDER BY d DESC LIMIT 60`,
            [user_id, today]
          );
          const active = new Set([...logDays.map(r => r.d), ...trackDays.map(r => r.d)]);

          // Días seguidos sin actividad contando desde hoy hacia atrás
          let gap = 0;
          let t = new Date(today).getTime();
          while (gap <= 4 && !active.has(new Date(t).toISOString().slice(0, 10))) { gap++; t -= 86400000; }

          // En riesgo: 2 o 3 días sin actividad (al 4to se rompe). Solo avisar una vez (gap exacto 2 o 3).
          if (gap < 2 || gap > 3) continue;

          // Racha acumulada antes del hueco (con la misma regla de 3 días de gracia)
          let streak = 0, restRun = 0;
          while (true) {
            const ds = new Date(t).toISOString().slice(0, 10);
            if (active.has(ds)) { streak++; restRun = 0; }
            else { restRun++; if (restRun > 3) break; }
            t -= 86400000;
          }
          if (streak < 3) continue; // rachas cortas no ameritan alarma

          const daysLeft = 4 - gap;
          await sendToUser(user_id, {
            title: `🔥 ¡Tu racha de ${streak} días está en riesgo!`,
            body: daysLeft === 1
              ? 'Entrena hoy o se reinicia. ¡No dejes que se apague! 💪'
              : `Llevas ${gap} días sin actividad. Entrena pronto para no perderla 💪`,
            url: '/plan',
          });
        } catch (err) { console.error('[push racha] usuario', user_id, err.message); }
      }
    } catch (e) { console.error('[push] Error racha en riesgo:', e.message); }
  });

  console.log('[push] Cron jobs de notificaciones activos');
}

module.exports = { startCronJobs, sendToUser, sendToAll };
