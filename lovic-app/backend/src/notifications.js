const cron = require('node-cron');
const db = require('./database/db');
const { webpush } = require('./config/vapid');

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

const MEAL_MSGS = [
  { title: '🍽️ ¿Ya registraste tus comidas?', body: 'Va media tarde y no veo nada anotado. Registra lo que has comido para no perder el conteo.' },
  { title: '📋 No olvides tu comida', body: 'Aún no has registrado nada hoy. Anótalo ahora que lo tienes fresco.' },
  { title: '🥗 Vic no ve tu comida de hoy', body: 'Registra tus comidas para llevar el control. ¡Solo toma un momento!' },
];

const WEIGH_MSGS = [
  { title: '⚖️ ¿Nos pesamos?', body: 'Ya pasó una semana. Un pesaje rápido en ayunas y seguimos viendo tu progreso real.' },
  { title: '📈 Tu progreso te espera', body: 'Hace días que no registras tu peso. Anótalo para que la tendencia siga clara.' },
  { title: '⚖️ Momento de pesarte', body: 'Pésate hoy (mejor en ayunas y a la misma hora) y mantenemos tu seguimiento al día.' },
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function daysBetween(a, b) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
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

  // Cada hora — recordatorio DINÁMICO de comida: a la hora habitual de cada clienta.
  // Si ya pasó su hora usual de registrar (+2h de margen) y hoy no ha anotado nada, se avisa una vez.
  // Clientas sin historial suficiente (<3 días): respaldo a las 3pm Colombia.
  cron.schedule('0 * * * *', async () => {
    try {
      const today = colombiaToday();
      const colHour = new Date(Date.now() - 5 * 3600 * 1000).getUTCHours(); // hora actual en Colombia
      const [rows] = await db.query(
        `SELECT ps.user_id, ps.subscription, up.usual_hour, up.days, HOUR(NOW()) AS db_hour
         FROM push_subscriptions ps
         JOIN users u ON u.id = ps.user_id AND u.role = 'client'
         LEFT JOIN (
           SELECT user_id, AVG(fh) AS usual_hour, COUNT(*) AS days FROM (
             SELECT user_id, HOUR(MIN(created_at)) AS fh
             FROM food_logs WHERE created_at >= NOW() - INTERVAL 30 DAY
             GROUP BY user_id, DATE(created_at)
           ) x GROUP BY user_id
         ) up ON up.user_id = ps.user_id
         WHERE NOT EXISTS (SELECT 1 FROM food_logs f WHERE f.user_id = ps.user_id AND f.logged_at = ?)`,
        [today]
      );

      // Agrupar por clienta (puede tener varios dispositivos)
      const byUser = new Map();
      for (const r of rows) {
        if (!byUser.has(r.user_id)) byUser.set(r.user_id, { subs: [], usual_hour: r.usual_hour, days: r.days, db_hour: r.db_hour });
        byUser.get(r.user_id).subs.push(r.subscription);
      }

      for (const [userId, u] of byUser) {
        const hasHistory = u.days >= 3 && u.usual_hour != null;
        // Con historial: dispara a la hora usual + 2h (mismo reloj de BD, el desfase se cancela).
        // Sin historial: respaldo a las 3pm Colombia.
        const due = hasHistory
          ? Number(u.db_hour) >= Math.round(Number(u.usual_hour)) + 2
          : colHour === 15;
        if (!due) continue;

        // 1 aviso por día por clienta
        const [ins] = await db.query('INSERT IGNORE INTO meal_reminder_sent (user_id, sent_date) VALUES (?, ?)', [userId, today]);
        if (ins.affectedRows === 0) continue;

        const msg = pick(MEAL_MSGS);
        for (const subStr of u.subs) {
          try {
            await webpush.sendNotification(JSON.parse(subStr), JSON.stringify({ ...msg, url: '/food' }));
          } catch (err) {
            if (err.statusCode === 410 || err.statusCode === 404) {
              const sub = JSON.parse(subStr);
              await db.query('DELETE FROM push_subscriptions WHERE endpoint=?', [sub.endpoint]);
            }
          }
        }
      }
    } catch (e) { console.error('[push] Error recordatorio comida:', e.message); }
  });

  // 8pm Colombia (01:00 UTC) — Nivel 2: si registró algo pero le faltó alguna comida
  cron.schedule('0 1 * * *', async () => {
    try {
      const today = colombiaToday();
      const [rows] = await db.query(
        `SELECT ps.user_id, ps.subscription,
                (SELECT COUNT(DISTINCT meal_type) FROM food_logs WHERE user_id=ps.user_id AND logged_at=?) AS today_meals,
                (SELECT ROUND(COUNT(DISTINCT CONCAT(logged_at,'|',meal_type)) / NULLIF(COUNT(DISTINCT logged_at),0))
                   FROM food_logs
                   WHERE user_id=ps.user_id AND logged_at >= DATE_SUB(?, INTERVAL 14 DAY) AND logged_at < ?) AS typical_meals
         FROM push_subscriptions ps
         JOIN users u ON u.id = ps.user_id AND u.role = 'client'`, [today, today, today]);

      const byUser = new Map();
      for (const r of rows) {
        if (!byUser.has(r.user_id)) byUser.set(r.user_id, { subs: [], today: Number(r.today_meals) || 0, typical: Number(r.typical_meals) || 0 });
        byUser.get(r.user_id).subs.push(r.subscription);
      }
      for (const [userId, u] of byUser) {
        // Solo si registró AL MENOS una comida hoy (si no registró nada, ya lo cubre el aviso dinámico)
        // y le falta al menos una respecto a su promedio.
        if (u.typical < 2 || u.today < 1 || u.today >= u.typical) continue;
        const [ins] = await db.query('INSERT IGNORE INTO meal_evening_sent (user_id, sent_date) VALUES (?, ?)', [userId, today]);
        if (ins.affectedRows === 0) continue;
        const msg = { title: '🌙 ¿Te faltó registrar alguna comida?', body: 'Anotaste algo hoy pero parece que falta. Complétalo antes de dormir para que el conteo quede bien.' };
        for (const subStr of u.subs) {
          try { await webpush.sendNotification(JSON.parse(subStr), JSON.stringify({ ...msg, url: '/food' })); }
          catch (err) { if (err.statusCode === 410 || err.statusCode === 404) { const s = JSON.parse(subStr); await db.query('DELETE FROM push_subscriptions WHERE endpoint=?', [s.endpoint]); } }
        }
      }
    } catch (e) { console.error('[push] Error recordatorio noche:', e.message); }
  });

  // Cada hora — recordatorio DINÁMICO de entreno: a la hora habitual de cada clienta.
  // "Inteligente": mira a qué hora SUELE registrar su entreno (últimos 30 días) y avisa
  // ~2h después de esa hora SOLO si hoy todavía no ha entrenado. Si no tiene historial
  // suficiente (<3 días), respaldo a las 5pm Colombia. Nunca molesta si ya entrenó hoy
  // (plan estructurado, entreno libre, o marcó "entrené" en el seguimiento diario).
  cron.schedule('0 * * * *', async () => {
    try {
      const today = colombiaToday();
      const colHour = new Date(Date.now() - 5 * 3600 * 1000).getUTCHours(); // hora actual en Colombia
      const [rows] = await db.query(
        `SELECT ps.user_id, ps.subscription, up.usual_hour, up.days, HOUR(NOW()) AS db_hour
         FROM push_subscriptions ps
         JOIN users u ON u.id = ps.user_id AND u.role = 'client'
         LEFT JOIN (
           SELECT user_id, AVG(wh) AS usual_hour, COUNT(*) AS days FROM (
             SELECT user_id, HOUR(MIN(created_at)) AS wh
             FROM workout_logs WHERE created_at >= NOW() - INTERVAL 30 DAY
             GROUP BY user_id, logged_date
           ) x GROUP BY user_id
         ) up ON up.user_id = ps.user_id
         WHERE NOT EXISTS (SELECT 1 FROM workout_logs w WHERE w.user_id = ps.user_id AND w.logged_date = ?)
           AND NOT EXISTS (SELECT 1 FROM free_workout_logs fw WHERE fw.user_id = ps.user_id AND fw.session_date = ?)
           AND NOT EXISTS (SELECT 1 FROM daily_tracking dt WHERE dt.user_id = ps.user_id AND DATE(dt.tracked_date) = ? AND dt.workout_done = 1)`,
        [today, today, today]
      );

      // Agrupar por clienta (puede tener varios dispositivos)
      const byUser = new Map();
      for (const r of rows) {
        if (!byUser.has(r.user_id)) byUser.set(r.user_id, { subs: [], usual_hour: r.usual_hour, days: r.days, db_hour: r.db_hour });
        byUser.get(r.user_id).subs.push(r.subscription);
      }

      for (const [userId, u] of byUser) {
        const hasHistory = u.days >= 3 && u.usual_hour != null;
        // Con historial: dispara a la hora usual + 2h (mismo reloj de BD, el desfase UTC se cancela).
        // Sin historial: respaldo a las 5pm Colombia.
        const due = hasHistory
          ? Number(u.db_hour) >= Math.round(Number(u.usual_hour)) + 2
          : colHour === 17;
        if (!due) continue;

        // 1 aviso por día por clienta
        const [ins] = await db.query('INSERT IGNORE INTO workout_reminder_sent (user_id, sent_date) VALUES (?, ?)', [userId, today]);
        if (ins.affectedRows === 0) continue;

        const msg = pick(EVENING_MSGS);
        for (const subStr of u.subs) {
          try {
            await webpush.sendNotification(JSON.parse(subStr), JSON.stringify({ ...msg, url: '/plan' }));
          } catch (err) {
            if (err.statusCode === 410 || err.statusCode === 404) {
              const sub = JSON.parse(subStr);
              await db.query('DELETE FROM push_subscriptions WHERE endpoint=?', [sub.endpoint]);
            }
          }
        }
      }
    } catch (e) { console.error('[push] Error recordatorio entreno:', e.message); }
  });

  // Cada hora — recordatorio DINÁMICO de PESAJE. Como el pesaje es ~semanal, se avisa
  // SOLO si han pasado 7+ días desde el último peso, a la hora habitual de la clienta
  // (o 8am si no hay patrón), con enfriamiento de 3 días para no fastidiar.
  cron.schedule('0 * * * *', async () => {
    try {
      const today = colombiaToday();
      const colHour = new Date(Date.now() - 5 * 3600 * 1000).getUTCHours();
      const [rows] = await db.query(
        `SELECT ps.user_id, ps.subscription, up.hr, up.cnt, up.last
         FROM push_subscriptions ps
         JOIN users u ON u.id = ps.user_id AND u.role = 'client'
         JOIN (
           SELECT user_id,
                  ROUND(AVG(HOUR(logged_at - INTERVAL 5 HOUR))) AS hr,
                  COUNT(*) AS cnt,
                  MAX(DATE(logged_at - INTERVAL 5 HOUR)) AS last
           FROM measurements WHERE weight_kg IS NOT NULL
           GROUP BY user_id
         ) up ON up.user_id = ps.user_id
         WHERE up.last <= DATE_SUB(?, INTERVAL 7 DAY)`,
        [today]
      );

      const byUser = new Map();
      for (const r of rows) {
        if (!byUser.has(r.user_id)) byUser.set(r.user_id, { subs: [], hr: r.hr, cnt: r.cnt });
        byUser.get(r.user_id).subs.push(r.subscription);
      }

      for (const [userId, u] of byUser) {
        const hasHistory = u.cnt >= 2 && u.hr != null;
        const dueHour = hasHistory ? Math.min(Math.max(Math.round(Number(u.hr)), 5), 20) : 8;
        if (colHour !== dueHour) continue;

        // Enfriamiento: máx. 1 cada 3 días
        const [[prev]] = await db.query('SELECT last_sent FROM weigh_reminder_sent WHERE user_id=?', [userId]);
        if (prev && daysBetween(prev.last_sent, today) < 3) continue;
        await db.query(
          'INSERT INTO weigh_reminder_sent (user_id, last_sent) VALUES (?, ?) ON DUPLICATE KEY UPDATE last_sent=VALUES(last_sent)',
          [userId, today]);

        const msg = pick(WEIGH_MSGS);
        for (const subStr of u.subs) {
          try {
            await webpush.sendNotification(JSON.parse(subStr), JSON.stringify({ ...msg, url: '/measurements' }));
          } catch (err) {
            if (err.statusCode === 410 || err.statusCode === 404) {
              const sub = JSON.parse(subStr);
              await db.query('DELETE FROM push_subscriptions WHERE endpoint=?', [sub.endpoint]);
            }
          }
        }
      }
    } catch (e) { console.error('[push] Error recordatorio pesaje:', e.message); }
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
