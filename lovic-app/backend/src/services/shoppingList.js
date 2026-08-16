// Genera la lista de mercado a partir del plan de comidas por tipo de día.
// Usa la rutina activa como patrón semanal (cuántos días de cada zona) y la IA para
// extraer ingredientes de cada comida.
const db = require('../database/db');
const { parseShoppingIngredients } = require('./ai');

const CATEGORIES = ['Proteínas', 'Carbohidratos', 'Frutas y verduras', 'Lácteos', 'Grasas y otros'];

function colombiaToday() {
  return new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10);
}

async function computeShoppingList(userId, period = 'weekly') {
  const [[u]] = await db.query('SELECT nutrition_mode FROM users WHERE id=?', [userId]);
  const mode = u?.nutrition_mode || 'simple';

  // Frecuencia semanal por zona, según la rutina activa
  const [[plan]] = await db.query(
    'SELECT id, start_date, created_at FROM workout_plans WHERE user_id=? AND is_active=TRUE ORDER BY created_at DESC LIMIT 1', [userId]);
  const freq = { superior: 0, inferior: 0, descanso: 0 };
  let note = null;
  if (plan) {
    const [pdays] = await db.query('SELECT day_type FROM workout_days WHERE plan_id=?', [plan.id]);
    let labeled = 0;
    for (const d of pdays) { if (freq[d.day_type] != null) { freq[d.day_type]++; labeled++; } }
    const implicitRest = Math.max(0, 7 - pdays.length);
    freq.descanso += implicitRest;
    if (labeled === 0) {
      // Sin etiquetas de tipo de día: repartimos 7 días entre las zonas que tengan comidas
      note = 'La rutina no tiene días etiquetados por tipo; se estimó una distribución pareja.';
    }
  } else {
    note = 'No hay rutina activa; se asumió 1 vez por semana cada tipo.';
  }

  // Slots del plan
  const [slots] = await db.query('SELECT * FROM client_meal_slots WHERE client_id=?', [userId]);
  if (slots.length === 0) return { categories: [], mealsCount: 0, period, note: 'Esta clienta no tiene comidas asignadas en su plan.' };

  // Si no hay frecuencias (sin etiquetas), repartir 7 entre zonas con comidas
  const zonesWithMeals = [...new Set(slots.map(s => s.body_zone))];
  if (freq.superior + freq.inferior + freq.descanso === 0 && zonesWithMeals.length) {
    const per = Math.round(7 / zonesWithMeals.length);
    for (const z of zonesWithMeals) freq[z] = per;
  }

  // Semanas a incluir según el periodo
  const factor = { weekly: 1, biweekly: 2, monthly: 4 }[period] || 1;
  let weekInstances = [];
  if (mode === 'rotativo') {
    const ref = plan ? new Date(plan.start_date || plan.created_at) : new Date();
    const daysSince = Math.max(0, Math.floor((new Date(colombiaToday()) - ref) / 86400000));
    const cur = (Math.floor(daysSince / 7) % 4) + 1;
    if (period === 'monthly') weekInstances = [1, 2, 3, 4];
    else if (period === 'biweekly') weekInstances = [cur, (cur % 4) + 1];
    else weekInstances = [cur];
  } else {
    for (let i = 0; i < factor; i++) weekInstances.push(1);
  }

  // Cuántas veces se come cada slot en el periodo
  // Cada momento (semana×zona×tipo) puede tener VARIAS opciones; la clienta come UNA.
  // Repartimos las veces del momento entre sus opciones (no se compra ×opciones).
  const groupSize = {};
  for (const s of slots) {
    const g = `${s.week_no}|${s.body_zone}|${s.meal_type}`;
    groupSize[g] = (groupSize[g] || 0) + 1;
  }
  const slotTimes = slots.map(s => {
    const weeksMatch = weekInstances.filter(w => w === s.week_no).length;
    const g = `${s.week_no}|${s.body_zone}|${s.meal_type}`;
    return weeksMatch * (freq[s.body_zone] || 0) / (groupSize[g] || 1);
  });

  // Comidas únicas para la IA (dedupe por nombre+descripción)
  const uniq = [];
  const keyToIdx = new Map();
  const slotToUniq = [];
  slots.forEach(s => {
    const k = `${s.name}||${s.description || ''}`;
    if (!keyToIdx.has(k)) { keyToIdx.set(k, uniq.length); uniq.push({ name: s.name, description: s.description }); }
    slotToUniq.push(keyToIdx.get(k));
  });

  let parsed = [];
  try { parsed = await parseShoppingIngredients(uniq); } catch (e) { parsed = []; }
  const ingByUniq = {};
  for (const p of parsed) ingByUniq[p.i] = p.ingredients || [];

  // Agregación: categoría -> (nombre|unidad) -> cantidad
  const agg = {};
  slots.forEach((s, si) => {
    const times = slotTimes[si];
    if (times <= 0) return;
    const ings = ingByUniq[slotToUniq[si]] || [];
    for (const ing of ings) {
      const cat = CATEGORIES.includes(ing.category) ? ing.category : 'Grasas y otros';
      const unit = ing.unit || 'unidad';
      const name = (ing.name || '').trim();
      if (!name) continue;
      const key = `${cat}||${name.toLowerCase()}||${unit}`;
      if (!agg[key]) agg[key] = { category: cat, name, unit, qty: 0 };
      agg[key].qty += (Number(ing.qty) || 0) * times;
    }
  });

  // Estructura por categoría
  const byCat = {};
  for (const item of Object.values(agg)) {
    const q = item.unit === 'unidad' ? Math.ceil(item.qty) : Math.round(item.qty);
    if (q <= 0) continue;
    (byCat[item.category] = byCat[item.category] || []).push({ name: item.name, qty: q, unit: item.unit });
  }
  const categories = CATEGORIES.filter(c => byCat[c]).map(c => ({
    category: c,
    items: byCat[c].sort((a, b) => a.name.localeCompare(b.name)),
  }));

  return { categories, mealsCount: slots.length, period, mode, freq, note };
}

module.exports = { computeShoppingList };
