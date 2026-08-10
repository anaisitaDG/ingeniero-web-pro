// Calcula insights de comportamiento nutricional y una correlación simple con el peso.
// Se usa tanto para la clienta (/food/insights) como para Lorena (nutrition-adherence).
const db = require('../database/db');

function colombiaToday() {
  return new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10);
}
const toDay = v => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10));
const avg = arr => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
const pctDiff = (a, b) => (b ? Math.round(((a - b) / b) * 100) : 0);

async function computeInsights(userId, { calorieTarget = null, proteinTarget = null } = {}) {
  const today = colombiaToday();

  // Comidas por día (últimos 30 días)
  const [rows] = await db.query(
    `SELECT logged_at, SUM(calories) AS c, SUM(protein_g) AS p
     FROM food_logs WHERE user_id=? AND logged_at >= DATE_SUB(?, INTERVAL 30 DAY)
     GROUP BY logged_at`, [userId, today]);
  const days = rows.map(r => {
    const d = toDay(r.logged_at);
    const [y, m, dd] = d.split('-').map(Number);
    const dow = new Date(Date.UTC(y, m - 1, dd)).getUTCDay(); // 0=Dom..6=Sab
    return { date: d, cal: Number(r.c), prot: Number(r.p), weekend: dow === 0 || dow === 6 };
  });

  // Días de entreno (daily_tracking o logs de ejercicio)
  const [tr] = await db.query(
    `SELECT DISTINCT d FROM (
       SELECT DATE_FORMAT(tracked_date,'%Y-%m-%d') d FROM daily_tracking WHERE user_id=? AND workout_done=1 AND tracked_date >= DATE_SUB(?, INTERVAL 30 DAY)
       UNION SELECT DATE_FORMAT(logged_date,'%Y-%m-%d') d FROM workout_logs WHERE user_id=? AND logged_date >= DATE_SUB(?, INTERVAL 30 DAY)
     ) t`, [userId, today, userId, today]);
  const trainDates = new Set(tr.map(r => r.d));
  for (const d of days) d.training = trainDates.has(d.date);

  const insights = [];

  // 1) Fin de semana vs entre semana (calorías)
  const wkndCal = days.filter(d => d.weekend).map(d => d.cal);
  const weekCal = days.filter(d => !d.weekend).map(d => d.cal);
  if (wkndCal.length >= 2 && weekCal.length >= 3) {
    const diff = pctDiff(avg(wkndCal), avg(weekCal));
    if (diff >= 15) insights.push({ icon: '📅', text: `Los fines de semana comes ~${diff}% más calorías que entre semana.` });
    else if (diff <= -15) insights.push({ icon: '📅', text: `Los fines de semana comes ~${Math.abs(diff)}% menos que entre semana.` });
  }

  // 2) Días de entreno vs descanso (calorías)
  const trainCal = days.filter(d => d.training).map(d => d.cal);
  const restCal = days.filter(d => !d.training).map(d => d.cal);
  if (trainCal.length >= 3 && restCal.length >= 3) {
    const diff = pctDiff(avg(trainCal), avg(restCal));
    if (diff >= 15) insights.push({ icon: '💪', text: `En días de entreno comes ~${diff}% más que en descanso.` });
    else if (diff <= -15) insights.push({ icon: '💪', text: `En días de entreno comes ~${Math.abs(diff)}% menos que en descanso. Ojo con comer suficiente para rendir.` });
  }

  // 3) Proteína en descanso
  if (proteinTarget) {
    const trainProt = days.filter(d => d.training).map(d => d.prot);
    const restProt = days.filter(d => !d.training).map(d => d.prot);
    if (trainProt.length >= 3 && restProt.length >= 3) {
      const ta = avg(trainProt), ra = avg(restProt);
      if (ra < proteinTarget * 0.85 && ra < ta * 0.85) insights.push({ icon: '🥩', text: `En días de descanso bajas la proteína (${Math.round(ra)}g vs ${Math.round(ta)}g). Manténla también sin entrenar.` });
    }
  }

  // 4) Comida menos registrada
  const [meals] = await db.query(
    `SELECT meal_type, COUNT(DISTINCT logged_at) AS n FROM food_logs
     WHERE user_id=? AND logged_at >= DATE_SUB(?, INTERVAL 14 DAY) GROUP BY meal_type`, [userId, today]);
  const totalDays = new Set(rows.map(r => toDay(r.logged_at))).size;
  if (totalDays >= 5) {
    const LABEL = { breakfast: 'el desayuno', lunch: 'el almuerzo', dinner: 'la cena', snack: 'la merienda' };
    const counts = { breakfast: 0, lunch: 0, dinner: 0, snack: 0 };
    for (const m of meals) counts[m.meal_type] = m.n;
    const least = Object.entries(counts).sort((a, b) => a[1] - b[1])[0];
    if (least && least[1] <= totalDays * 0.3) insights.push({ icon: '🍽️', text: `Casi nunca registras ${LABEL[least[0]]}. ¿La saltas o se te olvida anotarla?` });
  }

  // Correlación simple con el peso (observacional, honesta)
  let correlation = null;
  const [weights] = await db.query(
    `SELECT weight_kg, logged_at FROM measurements WHERE user_id=? AND weight_kg IS NOT NULL
     AND logged_at >= DATE_SUB(?, INTERVAL 30 DAY) ORDER BY logged_at ASC`, [userId, today]);
  if (weights.length >= 2 && days.length >= 5 && calorieTarget) {
    const wDelta = +(Number(weights[weights.length - 1].weight_kg) - Number(weights[0].weight_kg)).toFixed(1);
    const avgCal = Math.round(avg(days.map(d => d.cal)));
    const belowTarget = avgCal < calorieTarget * 0.95;
    const aboveTarget = avgCal > calorieTarget * 1.05;
    let text = null;
    if (belowTarget && wDelta < 0) text = `Promedias ${avgCal} kcal (bajo tu meta) y tu peso bajó ${Math.abs(wDelta)}kg. Déficit efectivo. 👏`;
    else if (aboveTarget && wDelta > 0) text = `Promedias ${avgCal} kcal (sobre tu meta) y tu peso subió ${wDelta}kg. Coherente con superávit.`;
    else if (belowTarget && wDelta > 0) text = `Comes bajo tu meta (${avgCal} kcal) pero el peso subió ${wDelta}kg. Puede ser retención, poca proteína o registro incompleto.`;
    else if (aboveTarget && wDelta < 0) text = `Comes sobre tu meta pero bajaste ${Math.abs(wDelta)}kg. Quizá gastas más de lo estimado.`;
    if (text) correlation = { avgCalories: avgCal, weightDelta: wDelta, text };
  }

  return { insights, correlation };
}

module.exports = { computeInsights };
