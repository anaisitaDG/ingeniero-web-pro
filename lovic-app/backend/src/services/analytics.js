// Analítica estilo MacroFactor, adaptada al modelo de Lovic (la app sugiere, Lorena decide).
// Tres piezas: (1) tendencia de peso suavizada, (2) gasto calórico REAL, (3) sugerencia de ajuste.

const ENERGY_PER_KG = 7700; // kcal aprox. por kg de peso corporal

function toDateStr(d) {
  if (!d) return null;
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  return String(d).slice(0, 10);
}

// (1) TENDENCIA DE PESO — media móvil exponencial sobre los puntos (robusta con datos escasos).
// rows: [{ logged_at, weight_kg }] en cualquier orden. Devuelve puntos (crudo + tendencia),
// la tendencia actual y el ritmo en kg/semana (regresión lineal sobre ~28 días).
function weightTrend(rows, { alpha = 0.25, rateWindowDays = 28 } = {}) {
  const pts = (rows || [])
    .map(r => ({ date: toDateStr(r.logged_at), w: Number(r.weight_kg) }))
    .filter(p => p.date && !isNaN(p.w) && p.w > 0)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (pts.length === 0) return { points: [], latestTrend: null, rateKgPerWeek: null, count: 0 };

  // EWMA
  let trend = pts[0].w;
  const points = pts.map((p, i) => {
    trend = i === 0 ? p.w : alpha * p.w + (1 - alpha) * trend;
    return { date: p.date, raw: +p.w.toFixed(1), trend: +trend.toFixed(2) };
  });
  const latestTrend = points[points.length - 1].trend;

  // Ritmo: regresión lineal (mínimos cuadrados) de la tendencia vs días, últimos rateWindowDays.
  // Si no hay 2+ puntos en la ventana (weigh-ins escasos), usamos todos los puntos disponibles.
  let rateKgPerWeek = null;
  const lastDate = new Date(points[points.length - 1].date);
  const windowStart = new Date(lastDate.getTime() - rateWindowDays * 86400000);
  let win = points.filter(p => new Date(p.date) >= windowStart);
  if (win.length < 2) win = points; // fallback: todo el histórico
  if (win.length >= 2) {
    const t0 = new Date(win[0].date).getTime();
    const xs = win.map(p => (new Date(p.date).getTime() - t0) / 86400000); // días
    const ys = win.map(p => p.trend);
    const n = xs.length;
    const mx = xs.reduce((a, b) => a + b, 0) / n;
    const my = ys.reduce((a, b) => a + b, 0) / n;
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
    if (den > 0) rateKgPerWeek = +((num / den) * 7).toFixed(2); // kg/día → kg/semana
  }
  return { points, latestTrend, rateKgPerWeek, count: points.length };
}

// (2) GASTO CALÓRICO REAL — balance energético: lo que comió vs cómo cambió su peso.
// weightRows: [{logged_at, weight_kg}]; intakeRows: [{date, calories}] (totales por día).
function estimateExpenditure(weightRows, intakeRows, { windowDays = 21 } = {}) {
  const today = new Date(Date.now() - 5 * 3600 * 1000);
  const startStr = new Date(today.getTime() - windowDays * 86400000).toISOString().slice(0, 10);

  // Ingesta: solo días con registro real dentro de la ventana
  const intake = (intakeRows || [])
    .map(r => ({ date: toDateStr(r.date), cal: Number(r.calories) || 0 }))
    .filter(r => r.date && r.date >= startStr && r.cal > 0);
  const loggedDays = intake.length;
  const avgIntake = loggedDays ? Math.round(intake.reduce((a, b) => a + b.cal, 0) / loggedDays) : null;

  // Peso: tendencia al inicio y al final de la ventana
  const tr = weightTrend(weightRows);
  const win = tr.points.filter(p => p.date >= startStr);
  let tdee = null, deltaKg = null, spanDays = null, quality = 'low';
  if (avgIntake && win.length >= 2) {
    deltaKg = +(win[win.length - 1].trend - win[0].trend).toFixed(2);
    spanDays = Math.max(1, Math.round((new Date(win[win.length - 1].date) - new Date(win[0].date)) / 86400000));
    // TDEE = ingesta media - (energía ganada/perdida por día)
    tdee = Math.round(avgIntake - (deltaKg * ENERGY_PER_KG) / spanDays);
    // Calidad del dato: cuántos días registró comida vs la ventana, y si el peso cubre buen rango
    const ratio = loggedDays / windowDays;
    quality = (loggedDays >= 10 && ratio >= 0.5 && spanDays >= 10) ? 'good'
            : (loggedDays >= 6 && spanDays >= 7) ? 'medium' : 'low';
  }
  return { tdee, avgIntake, deltaKg, loggedDays, windowDays, spanDays, quality, latestTrend: tr.latestTrend, rateKgPerWeek: tr.rateKgPerWeek };
}

// (3) SUGERENCIA DE AJUSTE — advisory para Lorena. Nunca aplica cambios solo.
function suggestAdjustment({ goal, tdee, currentTarget, rateKgPerWeek, bodyWeight }) {
  if (tdee == null || rateKgPerWeek == null) return null;
  const g = goal || 'maintenance';
  const wk = rateKgPerWeek;            // + sube, - baja
  const bw = bodyWeight || null;
  // Ritmo "ideal" por objetivo (en % del peso corporal por semana, aprox.)
  const pctWeek = bw ? (wk / bw) * 100 : null;

  let direction = 'hold', text = '';
  if (g === 'fat_loss') {
    if (wk >= -0.05) { direction = 'down'; text = `No está bajando (${fmtRate(wk)}). Considera bajar la meta ~150–250 kcal.`; }
    else if (pctWeek != null && pctWeek < -1.2) { direction = 'up'; text = `Está bajando muy rápido (${fmtRate(wk)}). Considera subir ~150 kcal para cuidar músculo.`; }
    else { direction = 'hold'; text = `Buen ritmo de pérdida (${fmtRate(wk)}). Mantén la meta.`; }
  } else if (g === 'muscle_gain') {
    if (wk <= 0.02) { direction = 'up'; text = `No está subiendo (${fmtRate(wk)}). Considera subir la meta ~150–250 kcal.`; }
    else if (pctWeek != null && pctWeek > 0.75) { direction = 'down'; text = `Está subiendo rápido (${fmtRate(wk)}), puede ser mucha grasa. Considera bajar ~150 kcal.`; }
    else { direction = 'hold'; text = `Buen ritmo de volumen (${fmtRate(wk)}). Mantén la meta.`; }
  } else { // maintenance / health
    if (Math.abs(wk) >= 0.25) { direction = wk > 0 ? 'down' : 'up'; text = `Para mantener, el peso se está moviendo (${fmtRate(wk)}). Ajusta ~100–150 kcal en sentido contrario.`; }
    else { direction = 'hold'; text = `Peso estable (${fmtRate(wk)}). Mantenimiento en orden.`; }
  }

  // Meta sugerida concreta, anclada al gasto real
  let suggestedTarget = null;
  if (g === 'fat_loss') suggestedTarget = Math.round(tdee - 400);
  else if (g === 'muscle_gain') suggestedTarget = Math.round(tdee + 250);
  else suggestedTarget = Math.round(tdee);

  return { direction, text, suggestedTarget, currentTarget: currentTarget || null };
}

function fmtRate(wk) {
  if (wk == null) return '—';
  const s = wk > 0 ? '+' : '';
  return `${s}${wk.toFixed(2)} kg/sem`;
}

module.exports = { weightTrend, estimateExpenditure, suggestAdjustment, fmtRate };
