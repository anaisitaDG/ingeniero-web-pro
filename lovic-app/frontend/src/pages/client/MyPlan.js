import React, { useEffect, useState, useCallback, useRef } from 'react';
import { LineChart, Line, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { api } from '../../services/api';
import ShoppingList from '../../components/ShoppingList';

export default function MyPlan() {
  const [tab, setTab]         = useState('routine');
  const [plan, setPlan]       = useState(null);
  const [nutrition, setNutrition] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [streak, setStreak]   = useState(0);
  // Factor de peso corporal: las calorías se ajustan al peso ACTUAL de la persona
  // (las tablas base están calibradas a 65 kg). Ej: 90 kg → factor 1.38.
  const [weightFactor, setWeightFactor] = useState(1);
  const [bodyWeight, setBodyWeight] = useState(65); // peso real para calorías de fuerza

  const [completedDays, setCompletedDays] = useState({});
  const [celebration, setCelebration] = useState(null); // { dayName, kcal }

  const load = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    try {
      setLoadError(false);
      const [wRes, dRes, cRes] = await Promise.all([api.workout.plan(), api.dashboard.get(), api.workout.completedDays()]);
      setPlan(wRes.plan);
      setNutrition(dRes.nutrition_plan);
      setStreak(dRes.streak || 0);
      const bw = Number(dRes.weight_history?.[0]?.weight_kg) || Number(dRes.bio?.weight_kg) || Number(dRes.questionnaire?.weight_kg) || 65;
      setWeightFactor(Math.max(0.6, Math.min(2.2, bw / 65)));
      setBodyWeight(bw);
      const map = {};
      (cRes.completed || []).forEach(r => {
        if (typeof r === 'string') map[r] = true;
        else map[r.day_id] = r.last_completed ? String(r.last_completed).slice(0, 10) : true;
      });
      setCompletedDays(map);
    } catch { setLoadError(true); }
    finally { if (showSpinner) setLoading(false); }
  }, []);

  async function toggleDay(dayId, dayName, kcal, date) {
    const today = new Date().toLocaleDateString('en-CA');
    // "Completado" se juzga contra HOY: una rutina hecha días atrás no cuenta como hecha hoy
    const done = completedDays[dayId] !== today;
    const useDate = date || today;
    const prev = completedDays;
    setCompletedDays(p => {
      const next = { ...p };
      if (done) next[dayId] = useDate; else delete next[dayId];
      return next;
    });
    try {
      await api.workout.completeDay(dayId, done, useDate);
    } catch (_) {
      setCompletedDays(prev);
      return;
    }
    if (done) {
      const dRes = await api.dashboard.get().catch(() => null);
      const newStreak = dRes?.streak ?? streak + 1;
      setStreak(newStreak);
      setCelebration({ dayName, kcal, streak: newStreak, date: useDate });
    }
  }

  useEffect(() => { load(); }, [load]);

  // Recargar al volver la app a primer plano (PWA reanudada)
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') load(false); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [load]);

  if (loading) return <div style={{ textAlign: 'center', padding: 48 }}><div className="spinner" style={{ borderTopColor: 'var(--coral)', borderColor: 'var(--border)', width: 28, height: 28 }} /></div>;
  if (loadError) return <div className="empty-state"><div className="icon">📡</div><p>No se pudo cargar tu plan. Revisa tu conexión.</p><button className="btn-primary" style={{ marginTop: 16 }} onClick={() => load()}>Reintentar</button></div>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Mi Plan 💪</h1>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, background: 'var(--border)', padding: 4, borderRadius: 12 }}>
        {[{ key: 'routine', label: '💪 Rutina' }, { key: 'nutrition', label: '🥗 Nutrición' }].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            flex: 1, padding: '10px', borderRadius: 10, fontWeight: 700, fontSize: 14, border: 'none',
            background: tab === t.key ? 'var(--card)' : 'transparent',
            color: tab === t.key ? 'var(--coral)' : 'var(--muted)',
            boxShadow: tab === t.key ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
            cursor: 'pointer', transition: 'all 0.2s',
          }}>{t.label}</button>
        ))}
      </div>

      {celebration && (
        <CelebrationModal
          dayName={celebration.dayName}
          kcal={celebration.kcal}
          streak={celebration.streak}
          completedDate={celebration.date}
          completedDays={completedDays}
          onClose={() => setCelebration(null)}
        />
      )}

      {tab === 'routine' && (
        <>
          {plan ? (
            <div>
              {plan.name && (
                <div style={{ marginBottom: 14 }}>
                  <p style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>Tu rutina actual</p>
                  <p style={{ fontSize: 20, fontWeight: 900 }}>{plan.name}</p>
                </div>
              )}
              {plan.duration_days && <PlanProgress startDate={plan.start_date || plan.created_at} durationDays={plan.duration_days} />}
              {plan.days.map(day => (
                <DayCard key={day.id} day={day} onLogged={load} weightFactor={weightFactor} bodyWeight={bodyWeight}
                  completedDate={completedDays[day.id]}
                  onToggleComplete={(kcal, date) => toggleDay(day.id, day.day_name, kcal, date)} />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <div className="icon">💪</div>
              <p>Tu entrenadora aún no ha asignado una rutina.<br />¡Pronto la tendrás!</p>
            </div>
          )}
          <div style={{ marginTop: 20, borderTop: '2px dashed var(--border)', paddingTop: 20 }}>
            <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>🆓 ¿Entrenaste algo diferente hoy?</p>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14 }}>Registra aquí cualquier actividad fuera de tu rutina asignada.</p>
            <FreeWorkout weightFactor={weightFactor} bodyWeight={bodyWeight} onCompleted={(kcal, date) => {
              api.dashboard.get().then(d => {
                setCelebration({ dayName: 'Entrenamiento libre', kcal, streak: d.streak || streak, date });
                setStreak(d.streak || streak);
              }).catch(() => setCelebration({ dayName: 'Entrenamiento libre', kcal, streak, date }));
            }} />
          </div>
        </>
      )}

      {tab === 'nutrition' && (
        <MealByTypeView legacyNutrition={nutrition} />
      )}
    </div>
  );
}

const WARMUP_OPTIONS = ['Movilidad articular', 'Estiramiento dinámico', 'Otro'];
// Opciones de cardio (mismas para 'Cardio inicio' y 'Cardio final')
const CARDIO_INICIO_OPTIONS = ['Caminata', 'Trote suave', 'Cuerda', 'Jumping jacks', 'Elíptica', 'Bicicleta', 'Aeróbicos', 'Rumba', 'Combat', 'Remo', 'Escaleras', 'Otro'];
const CARDIO_INICIO_KCAL = { 'Caminata': 5, 'Trote suave': 7, 'Cuerda': 12, 'Jumping jacks': 8, 'Elíptica': 8, 'Bicicleta': 7, 'Aeróbicos': 8, 'Rumba': 8, 'Combat': 10, 'Remo': 8, 'Escaleras': 9 };

// kcal/min approx for 65kg person. Para actividades personalizadas ("Otro") se usa
// una tasa por defecto para que igual cuente (no en cero).
const CARDIO_DEFAULT_RATE = 8;
const WARMUP_DEFAULT_RATE = 5;
const WARMUP_KCAL = { 'Movilidad articular': 2.5, 'Estiramiento dinámico': 2 };

// Soporta una actividad o varias combinadas ("A + B"): usa el promedio de sus tasas.
// Actividades personalizadas o "Otro" con texto usan la tasa por defecto.
function calcKcal(table, type, mins, defaultRate, factor = 1) {
  if (!type || type === 'Otro' || !mins) return null;
  const parts = String(type).split(' + ').map(s => s.trim()).filter(p => p && p !== 'Otro');
  if (parts.length === 0) return defaultRate ? Math.round(defaultRate * mins * factor) : null;
  const rates = parts.map(p => (table[p] != null ? table[p] : defaultRate)).filter(r => r != null);
  if (!rates.length) return null;
  const avg = rates.reduce((a, b) => a + b, 0) / rates.length;
  return Math.round(avg * mins * factor);
}

// ── Meal Plan View ────────────────────────────────────────────────────────────
const DAYS_LABELS = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const MEAL_META = {
  breakfast: { label: 'Desayuno',    icon: '🌅', color: '#FF8E53' },
  lunch:     { label: 'Almuerzo',    icon: '☀️',  color: '#C99A1E' },
  snack:     { label: 'Media tarde', icon: '🍎',  color: '#16a34a' },
  dinner:    { label: 'Cena',        icon: '🌙',  color: '#2D6EA0' },
};
const MEAL_ORDER = ['breakfast', 'lunch', 'snack', 'dinner'];

const BYTYPE_MOMENTS = [
  { value: 'desayuno', label: '🌅 Desayuno' },
  { value: 'almuerzo', label: '☀️ Almuerzo' },
  { value: 'merienda', label: '🍎 Merienda' },
  { value: 'cena',     label: '🌙 Cena' },
];
const ZONE_META = {
  superior: { label: '💪 Tren superior', color: '#8B5CF6' },
  inferior: { label: '🦵 Tren inferior', color: '#EA580C' },
  descanso: { label: '😴 Descanso', color: '#0891B2' },
};
const DAYTYPE_TEXT = {
  superior: 'Hoy entrenaste 💪 tren superior',
  inferior: 'Hoy entrenaste 🦵 tren inferior',
  descanso: 'Hoy es 😴 día de descanso',
};

function MealByTypeView({ legacyNutrition }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [zone, setZone]       = useState('superior');
  const [eaten, setEaten]     = useState([]);   // keys 'plan:<id>'
  const [busy, setBusy]       = useState({});
  const [showShopping, setShowShopping] = useState(false);
  const [optIdx, setOptIdx] = useState({}); // opción visible por momento (carrusel)
  const [logged, setLogged] = useState({}); // slot_id -> { name, calories } registrado
  const [editing, setEditing] = useState(null); // slot_id en edición ("comí algo distinto")
  const [editText, setEditText] = useState('');
  const [suppTaken, setSuppTaken] = useState([]); // ids de suplementos tomados hoy

  useEffect(() => {
    (async () => {
      try {
        const res = await api.mealPlan.byType();
        setData(res);
        setZone(res.auto_zone || 'superior');
        setEaten(res.eatenKeys || []);
        setSuppTaken(res.supplementsTaken || []);
      } catch (_) { setData({ slots: [] }); }
      setLoading(false);
    })();
  }, []);

  async function toggleSupp(id) {
    const taken = suppTaken.includes(id);
    setSuppTaken(t => taken ? t.filter(x => x !== id) : [...t, id]); // optimista
    try { await api.mealPlan.supplementTaken(id, !taken); }
    catch (_) { setSuppTaken(t => taken ? [...t, id] : t.filter(x => x !== id)); }
  }

  // customText: si comió una variante, se registra y estima lo real; si no, marca/desmarca la del plan
  async function toggleEat(slot, customText) {
    const key = `plan:${slot.id}`;
    const unmark = eaten.includes(key) && !customText;
    setBusy(b => ({ ...b, [slot.id]: true }));
    try {
      if (unmark) {
        await api.mealPlan.eat(slot.id, false);
        setEaten(e => e.filter(k => k !== key));
        setLogged(l => { const n = { ...l }; delete n[slot.id]; return n; });
      } else {
        const res = await api.mealPlan.eat(slot.id, true, customText || undefined);
        setEaten(e => e.includes(key) ? e : [...e, key]);
        if (res && res.logged) setLogged(l => ({ ...l, [slot.id]: res.logged }));
      }
    } catch (_) {}
    setBusy(b => ({ ...b, [slot.id]: false }));
    setEditing(null);
    setEditText('');
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 48 }}><div className="spinner" style={{ borderTopColor: 'var(--coral)', borderColor: 'var(--border)', width: 28, height: 28 }} /></div>;

  // Sin plan por tipo → usa el sistema anterior (plan semanal o texto libre)
  if (!data || !data.slots || data.slots.length === 0) {
    return <MealPlanView legacyNutrition={legacyNutrition} />;
  }

  const zoneSlots = data.slots.filter(s => s.body_zone === zone);
  const byMoment = {};
  zoneSlots.forEach(s => { (byMoment[s.meal_type] = byMoment[s.meal_type] || []).push(s); });

  return (
    <div>
      {/* Indicaciones & Suplementación — primero de todo (misma lista todos los días, agrupada por momento) */}
      {data.supplements && data.supplements.length > 0 && (() => {
        const groups = [];
        data.supplements.forEach(s => {
          const last = groups[groups.length - 1];
          if (last && last.moment === s.moment) last.items.push(s);
          else groups.push({ moment: s.moment, items: [s] });
        });
        return (
          <div style={{ marginBottom: 20 }}>
            <p style={{ fontWeight: 800, fontSize: 15, marginBottom: 12 }}>📌 Indicaciones & Suplementación</p>
            {groups.map((g, gi) => (
              <div key={gi} className="card" style={{ padding: '12px 14px', marginBottom: 10 }}>
                <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--coral)', marginBottom: g.items.length ? 8 : 0 }}>{g.moment}</p>
                {g.items.map((it, ii) => {
                  const taken = suppTaken.includes(it.id);
                  return (
                    <div key={ii} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderTop: ii ? '1px solid var(--border)' : 'none' }}>
                      <button onClick={() => toggleSupp(it.id)} aria-label="marcar tomado" style={{
                        flexShrink: 0, width: 24, height: 24, borderRadius: 7, cursor: 'pointer',
                        border: taken ? 'none' : '2px solid var(--border)',
                        background: taken ? '#16a34a' : 'transparent', color: '#fff', fontSize: 14, fontWeight: 800,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
                      }}>{taken ? '✓' : ''}</button>
                      <span style={{ flex: 1, fontSize: 14, fontWeight: 600, textDecoration: taken ? 'line-through' : 'none', opacity: taken ? 0.6 : 1 }}>{it.item}</span>
                      {it.dose && <span style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'right', flexShrink: 0 }}>{it.dose}</span>}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        );
      })()}

      {/* Contexto: qué entrenó hoy + semana */}
      {(data.today_day_type || (data.mode === 'rotativo' && data.week_no)) && (
        <div className="card" style={{ marginBottom: 14, padding: '12px 14px', background: 'var(--coral-light)', border: 'none' }}>
          <p style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--coral)' }}>
            {data.today_day_type ? DAYTYPE_TEXT[data.today_day_type] : 'Elige el tipo de tu día'}
            {data.mode === 'rotativo' ? `  ·  Semana ${data.week_no}` : ''}
          </p>
          {!data.today_day_type && (
            <p style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 3 }}>Marca tu entrenamiento de hoy como hecho y verás sola la comida que te toca.</p>
          )}
        </div>
      )}

      {/* Toggle de zona */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {['superior', 'inferior', 'descanso'].map(z => (
          <button key={z} onClick={() => setZone(z)} style={{
            flex: 1, padding: '11px', borderRadius: 12, cursor: 'pointer', fontWeight: 800, fontSize: 13, border: 'none',
            background: zone === z ? ZONE_META[z].color : 'var(--card)',
            color: zone === z ? '#fff' : 'var(--muted)',
            boxShadow: zone === z ? '0 2px 8px rgba(0,0,0,0.15)' : 'var(--shadow)',
          }}>{ZONE_META[z].label}</button>
        ))}
      </div>

      {/* Plan vs. realidad — cumplimiento del plan de esta zona (por momento, no por opción) */}
      {zoneSlots.length > 0 && (() => {
        const moments = BYTYPE_MOMENTS.map(m => byMoment[m.value] || []).filter(a => a.length);
        const total = moments.length;
        const done = moments.filter(opts => opts.some(x => eaten.includes(`plan:${x.id}`))).length;
        // Plan de calorías = promedio de las opciones de cada momento (comes 1 por momento)
        const plannedKcal = moments.reduce((sum, opts) => {
          const withCal = opts.filter(x => x.calories != null);
          return sum + (withCal.length ? withCal.reduce((s, x) => s + Number(x.calories), 0) / withCal.length : 0);
        }, 0);
        const consumed = data.consumedToday || 0;
        const mealsPct = total ? Math.round((done / total) * 100) : 0;
        return (
          <div className="card" style={{ marginBottom: 16, padding: '13px 15px' }}>
            <p style={{ fontWeight: 800, fontSize: 14, marginBottom: 10 }}>🎯 Plan vs. realidad {zone !== (data.auto_zone || zone) ? '' : '(hoy)'}</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 4 }}>
              <span style={{ fontWeight: 600 }}>Comidas del plan registradas</span>
              <span style={{ color: 'var(--muted)' }}>{done} / {total}</span>
            </div>
            <div style={{ height: 7, background: 'var(--border)', borderRadius: 7, overflow: 'hidden', marginBottom: 12 }}>
              <div style={{ height: '100%', width: `${mealsPct}%`, background: '#16a34a', borderRadius: 7, transition: 'width .3s' }} />
            </div>
            {plannedKcal > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
                <span style={{ fontWeight: 600 }}>Calorías: hoy vs. plan</span>
                <span style={{ color: 'var(--muted)' }}>
                  {Math.round(consumed)} / {Math.round(plannedKcal)} kcal
                  {(() => { const diff = Math.round(consumed - plannedKcal); if (Math.abs(diff) < 50) return ''; return diff > 0 ? ` · +${diff}` : ` · ${diff}`; })()}
                </span>
              </div>
            )}
          </div>
        );
      })()}

      {/* Momentos — carrusel de opciones (comes una) */}
      {BYTYPE_MOMENTS.map(m => {
        const items = byMoment[m.value] || [];
        if (items.length === 0) return null;
        const key = `${zone}-${m.value}`;
        const eatenPos = items.findIndex(x => eaten.includes(`plan:${x.id}`));
        const rawIdx = optIdx[key] != null ? optIdx[key] : (eatenPos >= 0 ? eatenPos : 0);
        const pos = Math.min(Math.max(rawIdx, 0), items.length - 1);
        const s = items[pos];
        const isEaten = eaten.includes(`plan:${s.id}`);
        const many = items.length > 1;
        const canPrev = pos > 0;
        const canNext = pos < items.length - 1;
        // Sin dar la vuelta: la flecha se queda en el borde (no cicla)
        const go = (delta) => setOptIdx(o => ({ ...o, [key]: Math.min(Math.max(pos + delta, 0), items.length - 1) }));
        // Reservamos el espacio de la flecha para que la tarjeta no salte; se oculta cuando no hay a dónde ir
        const arrow = (dir, enabled) => (
          <button onClick={enabled ? () => go(dir === '◀' ? -1 : 1) : undefined} aria-hidden={!enabled} style={{
            flexShrink: 0, width: 30, borderRadius: 8, border: 'none',
            cursor: enabled ? 'pointer' : 'default', visibility: enabled ? 'visible' : 'hidden',
            background: 'var(--bg)', color: 'var(--coral)', fontSize: 14, fontWeight: 800,
          }}>{dir}</button>
        );
        return (
          <div key={m.value} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <p style={{ fontWeight: 800, fontSize: 13, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1 }}>{m.label}</p>
              {many && <span style={{ fontSize: 11, color: 'var(--coral)', fontWeight: 700 }}>Opción {pos + 1} de {items.length}</span>}
            </div>
            <div className="card" style={{ padding: 14, borderLeft: `4px solid ${isEaten ? '#16a34a' : ZONE_META[zone].color}`, opacity: isEaten ? 0.85 : 1, transition: 'all .3s' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {many && arrow('◀', canPrev)}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 700, fontSize: 15, textDecoration: isEaten ? 'line-through' : 'none' }}>{s.name}</p>
                  {s.description && <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 3 }}>{s.description}</p>}
                  {s.calories != null && <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 5 }}>🔥 {s.calories} kcal{s.protein_g != null ? ` · P ${s.protein_g}g` : ''}{s.carbs_g != null ? ` · C ${s.carbs_g}g` : ''}{s.fat_g != null ? ` · G ${s.fat_g}g` : ''}</p>}
                  {/* Lo que quedó registrado (útil cuando la comida del plan no traía calorías o comió una variante) */}
                  {logged[s.id] && (
                    <p style={{ fontSize: 12, color: '#16a34a', fontWeight: 700, marginTop: 5 }}>
                      ✓ Registrado: {logged[s.id].name} · {logged[s.id].calories} kcal
                    </p>
                  )}
                  {editing === s.id ? (
                    <div style={{ marginTop: 10 }}>
                      <input
                        autoFocus value={editText} onChange={e => setEditText(e.target.value)}
                        placeholder="Ej: crema de arroz con mora y coco"
                        style={{ width: '100%', padding: '9px 11px', borderRadius: 9, border: '1px solid var(--border)', fontSize: 16, boxSizing: 'border-box' }}
                      />
                      <p style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 4 }}>Estimamos las calorías reales de lo que escribas.</p>
                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        <button onClick={() => editText.trim() && toggleEat(s, editText.trim())} disabled={busy[s.id] || !editText.trim()} style={{
                          flex: 1, padding: '8px 14px', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 12.5,
                          background: '#16a34a', color: '#fff', opacity: (busy[s.id] || !editText.trim()) ? 0.6 : 1,
                        }}>{busy[s.id] ? 'Calculando…' : 'Guardar lo que comí'}</button>
                        <button onClick={() => { setEditing(null); setEditText(''); }} disabled={busy[s.id]} style={{
                          padding: '8px 14px', borderRadius: 10, border: '1px solid var(--border)', cursor: 'pointer', fontWeight: 700, fontSize: 12.5,
                          background: 'var(--card)', color: 'var(--muted)',
                        }}>Cancelar</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginTop: 10 }}>
                      <button onClick={() => toggleEat(s)} disabled={busy[s.id]} style={{
                        padding: '8px 14px', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 12.5,
                        background: isEaten ? '#16a34a' : 'var(--coral-light)', color: isEaten ? '#fff' : 'var(--coral)',
                      }}>{busy[s.id] ? '…' : (isEaten ? '✓ Esta comí' : 'Ya comí esta')}</button>
                      <button onClick={() => { setEditing(s.id); setEditText(s.description ? `${s.name}, ${s.description}` : s.name); }} disabled={busy[s.id]} style={{
                        padding: '8px 12px', borderRadius: 10, border: '1px solid var(--border)', cursor: 'pointer', fontWeight: 600, fontSize: 12,
                        background: 'transparent', color: 'var(--muted)',
                      }}>✏️ Comí algo distinto</button>
                    </div>
                  )}
                </div>
                {many && arrow('▶', canNext)}
              </div>
              {many && eatenPos < 0 && (
                <p style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center', marginTop: 8 }}>◀ ▶ Desliza y elige la que vas a comer</p>
              )}
            </div>
          </div>
        );
      })}
      {zoneSlots.length === 0 && (
        <div className="empty-state"><div className="icon">🍽️</div><p>No hay comidas para {ZONE_META[zone].label} esta semana.</p></div>
      )}

      {/* Lista de mercado */}
      <div style={{ marginTop: 20, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
        {!showShopping ? (
          <button onClick={() => setShowShopping(true)} style={{
            width: '100%', padding: '13px', borderRadius: 12, border: '2px dashed var(--coral)', background: 'var(--coral-light)',
            color: 'var(--coral)', fontWeight: 800, fontSize: 14, cursor: 'pointer',
          }}>🛒 Ver mi lista de mercado</button>
        ) : (
          <>
            <p style={{ fontWeight: 800, fontSize: 15, marginBottom: 10 }}>🛒 Lista de mercado</p>
            <ShoppingList fetcher={api.mealPlan.shoppingList} />
          </>
        )}
      </div>
    </div>
  );
}

function MealPlanView({ legacyNutrition }) {
  const [meals, setMeals]           = useState(null); // today's meals
  const [weekPlan, setWeekPlan]     = useState(null);
  const [completed, setCompleted]   = useState([]);
  const [todayDow, setTodayDow]     = useState(null);
  const [viewDow, setViewDow]       = useState(null); // which day the user is browsing
  const [mode, setMode]             = useState('today'); // 'today' | 'week'
  const [loading, setLoading]       = useState(true);
  const [toggling, setToggling]     = useState({});

  useEffect(() => {
    (async () => {
      try {
        const [todayRes, weekRes] = await Promise.all([api.mealPlan.today(), api.mealPlan.week()]);
        setMeals(todayRes.meals || []);
        setCompleted(todayRes.completed || []);
        setTodayDow(todayRes.dow);
        setViewDow(todayRes.dow);
        setWeekPlan(weekRes.plan || {});
      } catch (_) {}
      setLoading(false);
    })();
  }, []);

  async function toggleMeal(meal_type) {
    const isDone = completed.includes(meal_type);
    setToggling(t => ({ ...t, [meal_type]: true }));
    const next = isDone ? completed.filter(m => m !== meal_type) : [...completed, meal_type];
    setCompleted(next);
    try {
      await api.mealPlan.complete(meal_type, null, !isDone);
    } catch (_) {
      setCompleted(isDone ? [...completed] : completed.filter(m => m !== meal_type));
    }
    setToggling(t => ({ ...t, [meal_type]: false }));
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 48 }}><div className="spinner" style={{ borderTopColor: 'var(--coral)', borderColor: 'var(--border)', width: 28, height: 28 }} /></div>;

  const hasMealPlan = meals !== null && (meals.length > 0 || (weekPlan && Object.keys(weekPlan).length > 0));

  if (!hasMealPlan) {
    return legacyNutrition
      ? <NutritionView content={legacyNutrition.content} updatedAt={legacyNutrition.created_at} />
      : <div className="empty-state"><div className="icon">🥗</div><p>Tu entrenadora aún no ha asignado un plan nutricional.<br />¡Pronto lo tendrás!</p></div>;
  }

  // Which meals to show in day view
  const dayMeals = mode === 'today'
    ? meals
    : (weekPlan[viewDow] || []);

  const groupedByType = {};
  dayMeals.forEach(m => {
    if (!groupedByType[m.meal_type]) groupedByType[m.meal_type] = [];
    groupedByType[m.meal_type].push(m);
  });

  const todayComplete = MEAL_ORDER.filter(t => groupedByType[t]).every(t => completed.includes(t));

  return (
    <div>
      {/* Mode switcher */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, background: 'var(--border)', padding: 4, borderRadius: 12 }}>
        {[{ k: 'today', l: '📅 Hoy' }, { k: 'week', l: '📆 Semana' }].map(({ k, l }) => (
          <button key={k} onClick={() => setMode(k)} style={{
            flex: 1, padding: '8px', borderRadius: 10, fontWeight: 700, fontSize: 13, border: 'none',
            background: mode === k ? 'var(--card)' : 'transparent',
            color: mode === k ? 'var(--coral)' : 'var(--muted)',
            boxShadow: mode === k ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
            cursor: 'pointer',
          }}>{l}</button>
        ))}
      </div>

      {mode === 'today' && (
        <>
          {/* Progress bar */}
          {MEAL_ORDER.some(t => groupedByType[t]) && (
            <div className="card" style={{ marginBottom: 16, padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontWeight: 700, fontSize: 15 }}>
                  {todayComplete ? '🎉 ¡Dieta completada hoy!' : '🥗 Plan de hoy'}
                </span>
                <span style={{ fontWeight: 800, color: 'var(--coral)', fontSize: 14 }}>
                  {MEAL_ORDER.filter(t => groupedByType[t] && completed.includes(t)).length} / {MEAL_ORDER.filter(t => groupedByType[t]).length}
                </span>
              </div>
              <div style={{ height: 8, background: 'var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 8,
                  background: todayComplete ? '#16a34a' : 'var(--coral)',
                  width: `${Math.round((MEAL_ORDER.filter(t => groupedByType[t] && completed.includes(t)).length / Math.max(1, MEAL_ORDER.filter(t => groupedByType[t]).length)) * 100)}%`,
                  transition: 'width 0.4s',
                }} />
              </div>
            </div>
          )}

          {/* Meal cards for today */}
          {dayMeals.length === 0
            ? <div className="empty-state"><div className="icon">📅</div><p>No hay comidas asignadas para hoy</p></div>
            : MEAL_ORDER.map(type => {
                const meta = MEAL_META[type] || { label: type, icon: '🍽️', color: 'var(--coral)' };
                const items = groupedByType[type];
                if (!items) return null;
                const done = completed.includes(type);
                return (
                  <div key={type} className="card" style={{
                    marginBottom: 12, padding: 16,
                    borderLeft: `4px solid ${done ? '#16a34a' : meta.color}`,
                    background: done ? 'var(--card)' : 'var(--card)',
                    opacity: done ? 0.85 : 1,
                    transition: 'all 0.3s',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                          <span style={{ fontSize: 22 }}>{done ? '✅' : meta.icon}</span>
                          <p style={{ fontWeight: 800, fontSize: 15, color: done ? '#16a34a' : meta.color }}>{meta.label}</p>
                        </div>
                        {items.map((item, i) => (
                          <p key={i} style={{ fontSize: 14, lineHeight: 1.65, color: done ? 'var(--muted)' : 'var(--text)', marginBottom: 2 }}>
                            • {item.description}
                          </p>
                        ))}
                      </div>
                      <button
                        onClick={() => toggleMeal(type)}
                        disabled={toggling[type]}
                        style={{
                          marginLeft: 12, flexShrink: 0, width: 36, height: 36, borderRadius: '50%', border: 'none',
                          cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: done ? '#dcfce7' : 'var(--border)',
                          color: done ? '#16a34a' : 'var(--muted)',
                          transition: 'all 0.2s',
                        }}
                        title={done ? 'Marcar como pendiente' : 'Marcar como completado'}
                      >
                        {toggling[type] ? <span className="spinner" style={{ width: 14, height: 14, borderColor: 'var(--border)', borderTopColor: 'var(--coral)' }} /> : (done ? '✓' : '○')}
                      </button>
                    </div>
                  </div>
                );
              })
          }
        </>
      )}

      {mode === 'week' && (
        <>
          {/* Day navigator */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 16, overflowX: 'auto', paddingBottom: 4 }}>
            {[1,2,3,4,5,6,7].map(dow => {
              const hasMeals = weekPlan[dow]?.length > 0;
              const isToday = dow === todayDow;
              return (
                <button key={dow} onClick={() => setViewDow(dow)} style={{
                  flexShrink: 0, padding: '8px 12px', borderRadius: 10, border: 'none', cursor: 'pointer',
                  fontWeight: 700, fontSize: 12,
                  background: viewDow === dow ? 'var(--coral)' : 'var(--card)',
                  color: viewDow === dow ? '#fff' : hasMeals ? 'var(--text)' : 'var(--muted)',
                  boxShadow: 'var(--shadow)',
                  outline: isToday && viewDow !== dow ? '2px solid var(--coral)' : 'none',
                }}>
                  {DAYS_LABELS[dow].slice(0, 3)}
                  {isToday && <span style={{ display: 'block', fontSize: 9, marginTop: 2 }}>HOY</span>}
                </button>
              );
            })}
          </div>

          {/* Day label */}
          <p style={{ fontWeight: 800, fontSize: 17, marginBottom: 14 }}>{DAYS_LABELS[viewDow]}</p>

          {/* Meals for selected day */}
          {(weekPlan[viewDow] || []).length === 0
            ? <div className="empty-state"><div className="icon">📅</div><p>No hay comidas asignadas para este día</p></div>
            : (() => {
                const grouped = {};
                (weekPlan[viewDow] || []).forEach(m => {
                  if (!grouped[m.meal_type]) grouped[m.meal_type] = [];
                  grouped[m.meal_type].push(m);
                });
                return MEAL_ORDER.map(type => {
                  const meta = MEAL_META[type] || { label: type, icon: '🍽️', color: 'var(--coral)' };
                  const items = grouped[type];
                  if (!items) return null;
                  return (
                    <div key={type} className="card" style={{ marginBottom: 12, padding: 16, borderLeft: `4px solid ${meta.color}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                        <span style={{ fontSize: 20 }}>{meta.icon}</span>
                        <p style={{ fontWeight: 800, fontSize: 14, color: meta.color }}>{meta.label}</p>
                      </div>
                      {items.map((item, i) => (
                        <p key={i} style={{ fontSize: 14, lineHeight: 1.65, color: 'var(--text)', marginBottom: 2 }}>
                          • {item.description}
                        </p>
                      ))}
                    </div>
                  );
                });
              })()
          }
        </>
      )}

      {/* Legacy text plan as reference */}
      {legacyNutrition && (
        <details style={{ marginTop: 20 }}>
          <summary style={{ fontSize: 13, color: 'var(--muted)', cursor: 'pointer', padding: '8px 0' }}>
            📄 Ver plan nutricional en texto
          </summary>
          <div style={{ marginTop: 10 }}>
            <NutritionView content={legacyNutrition.content} updatedAt={legacyNutrition.created_at} />
          </div>
        </details>
      )}
    </div>
  );
}

const MEAL_KEYWORDS = {
  'desayuno': { icon: '🌅', color: '#FF8E53' },
  'almuerzo': { icon: '☀️', color: '#C99A1E' },
  'cena':     { icon: '🌙', color: '#2D6EA0' },
  'merienda': { icon: '🍎', color: '#16a34a' },
  'snack':    { icon: '🍎', color: '#16a34a' },
  'colación': { icon: '🍎', color: '#16a34a' },
};

function NutritionView({ content, updatedAt }) {
  const [showRaw, setShowRaw] = useState(false);

  // Try to parse into meal blocks by detecting lines that start with a meal keyword
  const lines = content.split('\n');
  const blocks = [];
  let current = null;

  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const lc = trimmed.toLowerCase();
    const mealKey = Object.keys(MEAL_KEYWORDS).find(k => lc.startsWith(k) || lc.includes(`**${k}`) || lc.includes(`# ${k}`));
    if (mealKey) {
      if (current) blocks.push(current);
      current = { meal: mealKey, icon: MEAL_KEYWORDS[mealKey].icon, color: MEAL_KEYWORDS[mealKey].color, title: trimmed.replace(/[#*]/g, '').trim(), items: [] };
    } else if (current) {
      current.items.push(trimmed);
    } else {
      blocks.push({ meal: 'info', icon: 'ℹ️', color: '#6b7280', title: null, items: [trimmed] });
    }
  });
  if (current) blocks.push(current);

  const hasMeals = blocks.some(b => b.meal !== 'info');

  if (!hasMeals || showRaw) {
    return (
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <p style={{ fontWeight: 700 }}>🥗 Plan nutricional</p>
          {hasMeals && <button className="btn-ghost" onClick={() => setShowRaw(false)} style={{ fontSize: 12 }}>Ver visual</button>}
        </div>
        <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 14, lineHeight: 1.7 }}>{content}</pre>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 12 }}>Actualizado: {new Date(updatedAt).toLocaleDateString('es')}</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <p style={{ fontWeight: 800, fontSize: 17 }}>🥗 Plan nutricional</p>
        <button className="btn-ghost" onClick={() => setShowRaw(true)} style={{ fontSize: 12 }}>Ver texto</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {blocks.map((b, i) => (
          <div key={i} className="card" style={{ borderLeft: `4px solid ${b.color}`, padding: '14px 18px' }}>
            {b.title && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: b.items.length ? 10 : 0 }}>
                <span style={{ fontSize: 22 }}>{b.icon}</span>
                <p style={{ fontWeight: 800, fontSize: 15, color: b.color }}>{b.title}</p>
              </div>
            )}
            {b.items.map((item, j) => (
              <p key={j} style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text)', paddingLeft: b.title ? 30 : 0 }}>
                {item.startsWith('-') || item.startsWith('•') ? item : `• ${item}`}
              </p>
            ))}
          </div>
        ))}
      </div>
      <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 12, textAlign: 'right' }}>Actualizado: {new Date(updatedAt).toLocaleDateString('es')}</p>
    </div>
  );
}

function PlanProgress({ startDate, durationDays }) {
  const start = new Date(String(startDate).slice(0, 10) + 'T00:00:00');
  const dur = Number(durationDays) || 0;
  if (isNaN(start.getTime()) || !dur) return null; // sin fecha/duración válida no mostramos la barra
  const elapsed = Math.max(0, Math.floor((Date.now() - start) / 86400000));
  const dayOfPlan = Math.min(elapsed + 1, dur);
  const pct = Math.min(Math.round((elapsed / dur) * 100), 100);
  const daysLeft = Math.max(0, dur - elapsed);
  const expired = elapsed >= dur;
  const expiringSoon = !expired && daysLeft <= 7;

  return (
    <>
      {expired && (
        <div style={{ background: '#fee2e2', border: '1.5px solid #fca5a5', borderRadius: 14, padding: '14px 18px', marginBottom: 14, display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ fontSize: 22 }}>⏰</span>
          <div>
            <p style={{ fontWeight: 800, fontSize: 14, color: '#dc2626' }}>Tu plan de entrenamiento ha vencido</p>
            <p style={{ fontSize: 13, color: '#b91c1c', marginTop: 2 }}>Contacta a tu entrenadora para renovar y seguir avanzando. ¡No pares ahora! 💪</p>
          </div>
        </div>
      )}
      {expiringSoon && (
        <div style={{ background: '#fef9c3', border: '1.5px solid #fde047', borderRadius: 14, padding: '14px 18px', marginBottom: 14, display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ fontSize: 22 }}>⚠️</span>
          <div>
            <p style={{ fontWeight: 800, fontSize: 14, color: '#ca8a04' }}>Tu plan vence en {daysLeft} día{daysLeft !== 1 ? 's' : ''}</p>
            <p style={{ fontSize: 13, color: '#a16207', marginTop: 2 }}>Habla con tu entrenadora para renovar pronto.</p>
          </div>
        </div>
      )}
      <div className="card" style={{ marginBottom: 14, padding: '14px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <p style={{ fontWeight: 800, fontSize: 15 }}>Día {dayOfPlan} <span style={{ color: 'var(--muted)', fontWeight: 400 }}>de {durationDays}</span></p>
          <span style={{ fontSize: 13, fontWeight: 700, color: expired ? '#dc2626' : 'var(--coral)' }}>{pct}%</span>
        </div>
        <div style={{ background: 'var(--border)', borderRadius: 99, height: 8, overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: expired ? 'linear-gradient(90deg,#f87171,#dc2626)' : 'linear-gradient(90deg, var(--coral), #FF8E53)', borderRadius: 99 }} />
        </div>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>
          {expired ? '🎉 ¡Completaste el plan! Habla con tu entrenadora.' : `${daysLeft} días restantes`}
        </p>
      </div>
    </>
  );
}

function ActivityBlock({ emoji, label, options, kcalTable, defaultRate, defaultDuration, choice, setChoice, mins, setMins, done, setDone, history = [], multi = false, weightFactor = 1 }) {
  const kcal = calcKcal(kcalTable, choice, Number(mins), defaultRate, weightFactor);
  const [showHistory, setShowHistory] = useState(false);

  // Selección múltiple (calentamiento): choice guarda las opciones unidas por " + "
  const parts = choice ? choice.split(' + ').map(s => s.trim()).filter(Boolean) : [];
  const customText = parts.find(p => !options.includes(p)) || '';
  const otroOn = parts.includes('Otro') || !!customText;
  const rebuild = (arr) => { setChoice(arr.join(' + ')); setDone(false); };
  const toggleOpt = (o) => {
    if (o === 'Otro') {
      if (otroOn) rebuild(parts.filter(p => options.includes(p) && p !== 'Otro'));
      else rebuild([...parts.filter(p => options.includes(p)), 'Otro']);
    } else if (parts.includes(o)) {
      rebuild(parts.filter(p => p !== o));
    } else {
      rebuild([...parts, o]);
    }
  };
  const setCustom = (txt) => {
    const base = parts.filter(p => options.includes(p) && p !== 'Otro');
    rebuild(txt.trim() ? [...base, txt] : [...base, 'Otro']);
  };
  const multiReady = parts.some(p => p !== 'Otro');
  const ready = multi ? multiReady : (choice && choice !== 'Otro');
  return (
    <div style={{ background: done ? '#d1fae5' : 'var(--bg)', borderRadius: 12, padding: '12px 14px', transition: 'background 0.3s' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <p style={{ fontWeight: 700, fontSize: 13 }}>{emoji} {label}</p>
        {history.length > 0 && (
          <button onClick={() => setShowHistory(h => !h)} style={{
            background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, padding: '0 4px',
          }} title="Ver historial">📈</button>
        )}
      </div>
      {showHistory && (
        <div style={{ marginBottom: 10, background: 'var(--card)', borderRadius: 10, padding: '10px 12px' }}>
          <p style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, marginBottom: 8 }}>HISTORIAL DE SESIONES</p>
          {history.map((a, i) => {
            const dateStr = a.session_date ? String(a.session_date).slice(0, 10) : null;
            const dateLabel = dateStr
              ? new Date(`${dateStr}T00:00:00`).toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' })
              : '—';
            return (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, fontSize: 13 }}>
                <span style={{ color: 'var(--muted)', fontSize: 12 }}>{dateLabel}</span>
                <span style={{ fontWeight: 600 }}>{a.activity_name}{a.duration_mins ? ` · ${a.duration_mins} min` : ''}</span>
              </div>
            );
          })}
        </div>
      )}
      {multi ? (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: parts.length ? 8 : 0 }}>
            {options.map(o => {
              const active = o === 'Otro' ? otroOn : parts.includes(o);
              return (
                <button key={o} onClick={() => toggleOpt(o)} style={{
                  padding: '7px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700,
                  background: active ? 'var(--coral)' : 'var(--card)', color: active ? '#fff' : 'var(--muted)',
                  boxShadow: 'var(--shadow)',
                }}>{active ? '✓ ' : ''}{o}</button>
              );
            })}
          </div>
          {!parts.length && <p style={{ fontSize: 11, color: 'var(--muted)', margin: 0 }}>Sin {label.toLowerCase()} hoy · toca para elegir (puedes marcar varias)</p>}
          {otroOn && (
            <input className="input" placeholder="¿Qué hiciste?" value={customText}
              onChange={e => setCustom(e.target.value)}
              style={{ fontSize: 13, padding: '8px 10px', marginTop: 8 }} autoFocus />
          )}
        </>
      ) : (
        <>
          <select className="input" value={choice === 'Otro' || (!options.includes(choice) && choice) ? 'Otro' : choice} onChange={e => { setChoice(e.target.value); setDone(false); }} style={{ fontSize: 13, padding: '8px 10px', marginBottom: 8 }}>
            <option value="">Sin {label.toLowerCase()} hoy</option>
            {options.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          {(choice === 'Otro' || (!options.includes(choice) && choice)) && (
            <input className="input" placeholder="¿Qué hiciste?" value={choice === 'Otro' ? '' : choice}
              onChange={e => setChoice(e.target.value !== '' ? e.target.value : 'Otro')}
              style={{ fontSize: 13, padding: '8px 10px', marginBottom: 8 }} autoFocus />
          )}
        </>
      )}
      {ready && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 3 }}>Duración (min)</label>
              <input className="input" type="number" min="1" max="120" placeholder={defaultDuration || '10'}
                value={mins} onChange={e => setMins(e.target.value)} style={{ padding: '8px', textAlign: 'center' }} />
            </div>
            {kcal && (
              <div style={{ background: done ? '#a7f3d0' : 'var(--coral-light)', borderRadius: 10, padding: '8px 14px', textAlign: 'center', flexShrink: 0 }}>
                <p style={{ fontSize: 18, fontWeight: 800, color: done ? '#065f46' : 'var(--coral)' }}>~{kcal}</p>
                <p style={{ fontSize: 10, color: done ? '#065f46' : 'var(--coral)', fontWeight: 600 }}>kcal est.</p>
              </div>
            )}
          </div>
          <button onClick={() => setDone(d => !d)} style={{
            width: '100%', padding: '9px', borderRadius: 10, border: 'none', cursor: 'pointer',
            fontWeight: 700, fontSize: 13, transition: 'all 0.2s',
            background: done ? '#065f46' : 'var(--border)', color: done ? '#fff' : 'var(--muted)',
          }}>
            {done ? `✅ ${label} completado` : `Marcar ${label.toLowerCase()} como completado`}
          </button>
        </>
      )}
    </div>
  );
}

// kcal de fuerza basadas en el ESFUERZO (reps/segundos) escaladas por el peso corporal,
// no en el peso externo. Así los ejercicios con el propio peso y las isometrías SÍ cuentan,
// y el peso levantado solo suma un bono pequeño (no dispara el total).
// Recibe el peso corporal REAL de la persona (kg).
function calcStrengthKcal(setWeights, bodyweight = 65) {
  return Math.round((setWeights || []).reduce((sum, s) => {
    const w = parseFloat(s.weight_kg) || 0;         // peso externo (opcional)
    const r = parseFloat(s.reps_done) || 0;
    const d = parseFloat(s.duration_secs) || 0;     // isometría: 3 seg de sostén ≈ 1 rep
    const effReps = r + d / 3;
    // ~1% del peso corporal por rep efectiva + bono chico por el peso externo
    return sum + effReps * (bodyweight * 0.01 + w * 0.004);
  }, 0));
}

function parseDate(d) {
  const s = String(d).slice(0, 10);
  return new Date(`${s}T00:00:00`);
}

function formatDayDate(dateStr) {
  if (!dateStr) return null;
  return parseDate(dateStr).toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' });
}

const DAYS_ES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

function DayCard({ day, onLogged, completedDate, onToggleComplete, weightFactor = 1, bodyWeight = 65 }) {
  const noAccents = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
  const todayDayEs = noAccents(DAYS_ES[new Date().getDay()]);
  const dayNameLc = noAccents(day.day_name.toLowerCase());
  // Match if the day name contains the current weekday name (ignora tildes: "MIERCOLES" = "miércoles")
  const isToday = DAYS_ES.some(d => dayNameLc.includes(noAccents(d)))
    ? dayNameLc.includes(todayDayEs)
    : false;
  const [open, setOpen] = useState(isToday);

  const [warmupChoice, setWarmupChoice] = useState('');
  const [warmupMins, setWarmupMins]     = useState(day.warmup_duration || '');
  const [warmupDone, setWarmupDone]     = useState(false);
  const [ciChoice, setCiChoice]         = useState('');
  const [ciMins, setCiMins]             = useState('');
  const [ciDone, setCiDone]             = useState(false);
  const [cardioChoice, setCardioChoice] = useState('');
  const [cardioMins, setCardioMins]     = useState(day.cardio_duration || '');
  const [cardioDone, setCardioDone]     = useState(false);
  const [activityLoaded, setActivityLoaded] = useState(false);
  const [allActivities, setAllActivities] = useState([]);
  const [confirmingDate, setConfirmingDate] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toLocaleDateString('en-CA'));

  const today = new Date().toLocaleDateString('en-CA');

  // Load today's activity from backend only when card is open
  useEffect(() => {
    if (!open) return;
    api.workout.getActivity(day.id).then(res => {
      const acts = res.activities || [];
      setAllActivities(acts);
      // Solo pre-cargar y marcar como hecho lo de HOY (no la última sesión previa)
      const isToday = a => {
        const d = a.session_date;
        const ds = d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10);
        return ds === today;
      };
      const w = acts.find(a => a.type === 'warmup' && isToday(a));
      const ci = acts.find(a => a.type === 'cardio_inicio' && isToday(a));
      const c = acts.find(a => a.type === 'cardio' && isToday(a));
      if (w) { setWarmupChoice(w.activity_name); setWarmupMins(w.duration_mins || ''); setWarmupDone(true); }
      if (ci) { setCiChoice(ci.activity_name); setCiMins(ci.duration_mins || ''); setCiDone(true); }
      if (c) { setCardioChoice(c.activity_name); setCardioMins(c.duration_mins || ''); setCardioDone(true); }
      setActivityLoaded(true);
    }).catch(err => { console.error('Activity load error:', err); setActivityLoaded(true); });
  }, [day.id, open]); // eslint-disable-line

  // Save to backend when done is toggled or choice/mins change (only after initial load)
  useEffect(() => {
    if (!activityLoaded) return;
    if (warmupChoice && warmupChoice !== 'Otro') {
      api.workout.saveActivity(day.id, 'warmup', warmupChoice, Number(warmupMins) || null).catch(() => {});
    } else if (!warmupChoice) {
      // "Sin calentamiento hoy" → borra la actividad de hoy en vez de dejarla pegada
      api.workout.deleteActivity(day.id, 'warmup').catch(() => {});
    }
  }, [warmupChoice, warmupMins, warmupDone, activityLoaded, day.id]); // eslint-disable-line

  useEffect(() => {
    if (!activityLoaded) return;
    if (ciChoice && ciChoice !== 'Otro') {
      api.workout.saveActivity(day.id, 'cardio_inicio', ciChoice, Number(ciMins) || null).catch(() => {});
    } else if (!ciChoice) {
      api.workout.deleteActivity(day.id, 'cardio_inicio').catch(() => {});
    }
  }, [ciChoice, ciMins, ciDone, activityLoaded, day.id]); // eslint-disable-line

  useEffect(() => {
    if (!activityLoaded) return;
    if (cardioChoice && cardioChoice !== 'Otro') {
      api.workout.saveActivity(day.id, 'cardio', cardioChoice, Number(cardioMins) || null).catch(() => {});
    } else if (!cardioChoice) {
      api.workout.deleteActivity(day.id, 'cardio').catch(() => {});
    }
  }, [cardioChoice, cardioMins, cardioDone, activityLoaded, day.id]); // eslint-disable-line
  // kcal per exercise keyed by ex.id, updated by ExerciseCard
  const [exKcal, setExKcal] = useState({});
  const [extraKcal, setExtraKcal] = useState(0); // kcal de ejercicios extra del día

  const warmupKcal = calcKcal(WARMUP_KCAL, warmupChoice, Number(warmupMins), WARMUP_DEFAULT_RATE, weightFactor) || 0;
  const ciKcal     = calcKcal(CARDIO_INICIO_KCAL, ciChoice, Number(ciMins), CARDIO_DEFAULT_RATE, weightFactor) || 0;
  const cardioKcal = calcKcal(CARDIO_INICIO_KCAL, cardioChoice, Number(cardioMins), CARDIO_DEFAULT_RATE, weightFactor) || 0;
  const strengthKcal = Object.values(exKcal).reduce((a, b) => a + b, 0) + extraKcal;
  const totalKcal = warmupKcal + ciKcal + strengthKcal + cardioKcal;

  // Last session date = most recent exercise log in this day
  const lastSessionDate = day.exercises
    .map(ex => ex.last_session?.logged_date)
    .filter(Boolean)
    .map(d => String(d).slice(0, 10))
    .sort()
    .reverse()[0];
  const lastSessionLabel = lastSessionDate ? formatDayDate(lastSessionDate) : null;

  const completedLabel = completedDate && typeof completedDate === 'string'
    ? formatDayDate(completedDate)
    : null;
  const completedToday = completedDate === today;

  return (
    <div className="card" style={{
      marginBottom: 14,
      border: isToday ? '2px solid var(--coral)' : '2px solid transparent',
      background: isToday ? 'var(--card)' : undefined,
    }}>
      {isToday && (
        <div style={{ background: 'var(--coral)', color: '#fff', fontSize: 11, fontWeight: 700,
          padding: '3px 10px', borderRadius: '8px 8px 0 0', marginTop: -16, marginLeft: -16,
          marginRight: -16, marginBottom: 10, letterSpacing: 0.5 }}>
          HOY
        </div>
      )}
      <button onClick={() => setOpen(o => !o)} style={{
        width: '100%', background: 'none', border: 'none', cursor: 'pointer',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 0,
      }}>
        <div style={{ textAlign: 'left' }}>
          <p style={{ fontWeight: 800, fontSize: 16 }}>{day.day_name}</p>
          {completedToday ? (
            <p style={{ fontSize: 11, color: '#059669', marginTop: 2, fontWeight: 600 }}>✅ Completado hoy</p>
          ) : completedLabel ? (
            <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Completado por última vez: {completedLabel}</p>
          ) : null}
          {lastSessionLabel && (
            <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Última sesión: {lastSessionLabel}</p>
          )}
        </div>
        <span style={{ color: 'var(--muted)', fontSize: 14 }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <ActivityBlock emoji="🔥" label="Calentamiento" options={WARMUP_OPTIONS} kcalTable={WARMUP_KCAL} defaultRate={WARMUP_DEFAULT_RATE} multi weightFactor={weightFactor}
            defaultDuration={day.warmup_duration} choice={warmupChoice} setChoice={setWarmupChoice}
            mins={warmupMins} setMins={setWarmupMins} done={warmupDone} setDone={setWarmupDone}
            history={allActivities.filter(a => a.type === 'warmup')} />
          <ActivityBlock emoji="🏃‍♀️" label="Cardio inicio" options={CARDIO_INICIO_OPTIONS} kcalTable={CARDIO_INICIO_KCAL} defaultRate={CARDIO_DEFAULT_RATE} weightFactor={weightFactor}
            choice={ciChoice} setChoice={setCiChoice}
            mins={ciMins} setMins={setCiMins} done={ciDone} setDone={setCiDone}
            history={allActivities.filter(a => a.type === 'cardio_inicio')} />
          {day.exercises.map(ex => (
            <ExerciseCard key={ex.id} exercise={ex} onLogged={() => onLogged(false)} weightFactor={weightFactor} bodyWeight={bodyWeight}
              onKcalChange={kcal => setExKcal(prev => ({ ...prev, [ex.id]: kcal }))} />
          ))}
          <ExtraExercises dayId={day.id} onKcalChange={setExtraKcal} weightFactor={weightFactor} bodyWeight={bodyWeight} />
          <ActivityBlock emoji="🏃" label="Cardio final" options={CARDIO_INICIO_OPTIONS} kcalTable={CARDIO_INICIO_KCAL} defaultRate={CARDIO_DEFAULT_RATE} weightFactor={weightFactor}
            defaultDuration={day.cardio_duration} choice={cardioChoice} setChoice={setCardioChoice}
            mins={cardioMins} setMins={setCardioMins} done={cardioDone} setDone={setCardioDone}
            history={allActivities.filter(a => a.type === 'cardio')} />
          <div style={{ background: 'var(--coral-light)', borderRadius: 12, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontWeight: 700, fontSize: 13, color: 'var(--coral)' }}>🔥 Total estimado del día</p>
              <p style={{ fontSize: 11, color: 'var(--coral)', marginTop: 2 }}>
                {warmupKcal > 0 && `Calent. ${warmupKcal} + `}{ciKcal > 0 && `Cardio ini. ${ciKcal} + `}Fuerza {strengthKcal}{cardioKcal > 0 && ` + Cardio ${cardioKcal}`} kcal
              </p>
            </div>
            <p style={{ fontSize: 28, fontWeight: 900, color: 'var(--coral)' }}>~{totalKcal}</p>
          </div>
          {completedToday ? (
            <button onClick={() => onToggleComplete(totalKcal, today)} style={{
              width: '100%', padding: '11px', borderRadius: 12, border: 'none', cursor: 'pointer',
              fontWeight: 700, fontSize: 14, background: '#065f46', color: '#fff',
            }}>
              ✅ Día completado — desmarcar
            </button>
          ) : confirmingDate ? (
            <div style={{ background: 'var(--bg)', borderRadius: 12, padding: '14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p style={{ fontSize: 13, fontWeight: 700 }}>¿Cuándo hiciste este entrenamiento?</p>
              <input className="input" type="date" value={selectedDate}
                max={today}
                onChange={e => setSelectedDate(e.target.value)}
                style={{ fontSize: 13, padding: '8px 10px' }} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setConfirmingDate(false)} style={{
                  flex: 1, padding: '10px', borderRadius: 10, border: 'none', cursor: 'pointer',
                  fontWeight: 700, fontSize: 13, background: 'var(--border)', color: 'var(--muted)',
                }}>Cancelar</button>
                <button onClick={() => { setConfirmingDate(false); onToggleComplete(totalKcal, selectedDate); }} style={{
                  flex: 2, padding: '10px', borderRadius: 10, border: 'none', cursor: 'pointer',
                  fontWeight: 700, fontSize: 13, background: 'var(--coral)', color: '#fff',
                }}>🏁 Confirmar</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setConfirmingDate(true)} style={{
              width: '100%', padding: '11px', borderRadius: 12, border: 'none', cursor: 'pointer',
              fontWeight: 700, fontSize: 14, background: 'var(--coral)', color: '#fff',
            }}>
              🏁 Marcar día como completado
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function ExerciseCard({ exercise: ex, onLogged, onKcalChange, weightFactor = 1, bodyWeight = 65 }) {
  const [showLog, setShowLog]     = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory]     = useState(null);
  const plannedSets = ex.sets || 0;
  // Valores de la última vez: se muestran como PISTA (placeholder), no pre-llenados,
  // para que la sesión arranque en blanco y las calorías no cuenten antes de registrar.
  const lastW = ex.last_session?.weights   ? ex.last_session.weights.split(',')   : [];
  const lastR = ex.last_session?.reps      ? ex.last_session.reps.split(',')      : [];
  const lastD = ex.last_session?.durations ? ex.last_session.durations.split(',') : [];
  const [setWeights, setSetWeights] = useState(() =>
    Array.from({ length: plannedSets }, () => ({ weight_kg: '', reps_done: '', duration_secs: '' }))
  );
  function addSet() {
    setSetWeights(w => [...w, { weight_kg: '', reps_done: '', duration_secs: '' }]);
    setShowLog(true);
  }
  function removeSet(i) { setSetWeights(w => w.filter((_, j) => j !== i)); }
  const [saving, setSaving]           = useState(false);
  const [showVariations, setShowVariations] = useState(false);

  // Report kcal to parent whenever weights change
  useEffect(() => {
    onKcalChange?.(calcStrengthKcal(setWeights, bodyWeight));
  }, [setWeights, onKcalChange, bodyWeight]); // eslint-disable-line

  const today = new Date().toLocaleDateString('en-CA');
  const lastSession = ex.last_session;
  const lastWeights = lastSession?.weights ? lastSession.weights.split(',') : [];

  async function logSets() {
    setSaving(true);
    try {
      const sets = setWeights.map((s, i) => ({
        set_number: i + 1,
        weight_kg: s.weight_kg ? Number(s.weight_kg) : null,
        reps_done: s.reps_done ? Number(s.reps_done) : null,
        duration_secs: s.duration_secs ? Number(s.duration_secs) : null,
      }));
      await api.workout.log(ex.id, today, sets);
      setShowLog(false);
      onLogged();
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  }

  async function loadHistory() {
    if (history) { setShowHistory(h => !h); return; }
    try {
      const res = await api.workout.history(ex.id);
      setHistory(res.history);
      setShowHistory(true);
    } catch (e) {
      alert('No se pudo cargar el historial.');
    }
  }

  const isLoggedToday = lastSession?.logged_date &&
    (lastSession.logged_date instanceof Date
      ? lastSession.logged_date.toISOString().slice(0, 10)
      : String(lastSession.logged_date).slice(0, 10)) === today;

  // Si ya registró hoy, recarga las series EXACTAS guardadas (incluidas extra e
  // isometrías) para que al re-editar y guardar no se pierda nada.
  useEffect(() => {
    if (!isLoggedToday) return;
    api.workout.history(ex.id).then(res => {
      const todays = (res.history || []).find(h => h.date === today);
      if (todays?.sets?.length) {
        setSetWeights(todays.sets.map(s => ({
          weight_kg: s.weight_kg ?? '',
          reps_done: s.reps_done ?? '',
          duration_secs: s.duration_secs ?? '',
        })));
      }
    }).catch(() => {});
  }, []); // eslint-disable-line

  return (
    <div style={{ background: 'var(--bg)', borderRadius: 14, padding: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div style={{ flex: 1 }}>
          <p style={{ fontWeight: 700, fontSize: 15 }}>{ex.name}</p>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>
            {ex.sets} series × {ex.reps} {ex.tracking_type === 'time' ? 'seg' : 'reps'}{ex.weight_kg ? ` · ${ex.weight_kg} kg` : ''}
          </p>
        </div>
        {ex.youtube_url && (
          <a href={ex.youtube_url} target="_blank" rel="noreferrer" style={{
            display: 'flex', alignItems: 'center', gap: 5, background: '#FF0000', color: '#fff',
            padding: '6px 12px', borderRadius: 8, textDecoration: 'none', fontSize: 12, fontWeight: 700,
            marginLeft: 10, flexShrink: 0,
          }}>
            ▶ Ver video
          </a>
        )}
      </div>

      {lastSession && (
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>
          {isLoggedToday ? '✅ Registrado hoy' : `Última vez: ${parseDate(lastSession.logged_date).toLocaleDateString('es', { day: 'numeric', month: 'short' })}`}
          {lastWeights.length > 0 && ` · ${lastWeights.filter(Boolean).map((w, i) => `S${i+1}: ${w}kg`).join(' ')}`}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => setShowLog(l => !l)} style={{
          flex: 1, padding: '8px', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13,
          background: showLog ? 'var(--coral)' : 'var(--coral-light)', color: showLog ? '#fff' : 'var(--coral)',
        }}>
          {isLoggedToday ? '✏️ Editar registro' : '📝 Registrar sesión'}
        </button>
        {ex.variations?.length > 0 && (
          <button onClick={() => setShowVariations(v => !v)} title="Ver variaciones" style={{
            padding: '8px 12px', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13,
            background: showVariations ? 'var(--gold)' : 'var(--card)', color: showVariations ? '#fff' : 'var(--muted)',
          }}>⇄</button>
        )}
        <button onClick={loadHistory} style={{
          padding: '8px 12px', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13,
          background: 'var(--card)', color: 'var(--muted)',
        }}>
          📈
        </button>
      </div>

      {showVariations && ex.variations?.length > 0 && (
        <div style={{ marginTop: 10, background: 'var(--card)', borderRadius: 12, padding: 12 }}>
          <p style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, color: 'var(--gold)' }}>⇄ Variaciones disponibles</p>
          {ex.variations.map(v => (
            <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <p style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{v.name}</p>
              {v.youtube_url && (
                <a href={v.youtube_url} target="_blank" rel="noreferrer" style={{
                  background: '#FF0000', color: '#fff', padding: '4px 10px', borderRadius: 6,
                  textDecoration: 'none', fontSize: 12, fontWeight: 700,
                }}>▶</a>
              )}
            </div>
          ))}
        </div>
      )}

      {showLog && (
        <div style={{ marginTop: 12, background: 'var(--card)', borderRadius: 12, padding: 12 }}>
          <p style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>Registrar sesión de hoy</p>
          {ex.tracking_type === 'time' && (
            <p style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6, background: 'var(--bg)', borderRadius: 8, padding: '6px 9px' }}>
              💪 Las calorías ya cuentan con tu peso corporal ({Math.round(bodyWeight)} kg). El campo de peso es solo si usas peso extra (disco, mancuerna).
            </p>
          )}
          <div style={{ display: 'flex', gap: 6, marginBottom: 4, paddingLeft: 42 }}>
            <span style={{ flex: 1, fontSize: 10, color: 'var(--muted)', textAlign: 'center' }}>Peso (kg)</span>
            {ex.tracking_type === 'time' ? (
              <span style={{ flex: 1, fontSize: 10, color: 'var(--muted)', textAlign: 'center' }}>⏱️ Tiempo (seg)</span>
            ) : (
              <>
                <span style={{ flex: 1, fontSize: 10, color: 'var(--muted)', textAlign: 'center' }}>Reps</span>
                <span style={{ flex: 1, fontSize: 10, color: 'var(--muted)', textAlign: 'center' }}>Iso (seg)</span>
              </>
            )}
            <span style={{ width: 18, flexShrink: 0 }} />
          </div>
          {setWeights.map((s, i) => {
            const isExtra = i >= plannedSets;
            return (
            <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: isExtra ? 'var(--coral)' : 'var(--muted)', width: 36, flexShrink: 0 }}>
                {i + 1}{isExtra ? '+' : ''}
              </span>
              <input className="input" type="number" step="0.5" min="0" max="999"
                placeholder={ex.tracking_type === 'time' ? (lastW[i] || ex.weight_kg || 'opc.') : (lastW[i] || ex.weight_kg || '0')} value={s.weight_kg}
                onChange={e => setSetWeights(w => w.map((x, j) => j === i ? { ...x, weight_kg: e.target.value } : x))}
                style={{ flex: 1, padding: '8px 4px', textAlign: 'center', minWidth: 0 }} />
              {ex.tracking_type === 'time' ? (
                <input className="input" type="number" min="0"
                  placeholder={lastD[i] || ex.reps || '30'} value={s.duration_secs}
                  onChange={e => setSetWeights(w => w.map((x, j) => j === i ? { ...x, duration_secs: e.target.value } : x))}
                  style={{ flex: 1, padding: '8px 4px', textAlign: 'center', minWidth: 0 }} />
              ) : (
                <>
                  <input className="input" type="number" min="0"
                    placeholder={lastR[i] || ex.reps || '10'} value={s.reps_done}
                    onChange={e => setSetWeights(w => w.map((x, j) => j === i ? { ...x, reps_done: e.target.value } : x))}
                    style={{ flex: 1, padding: '8px 4px', textAlign: 'center', minWidth: 0 }} />
                  <input className="input" type="number" min="0"
                    placeholder="–" value={s.duration_secs}
                    onChange={e => setSetWeights(w => w.map((x, j) => j === i ? { ...x, duration_secs: e.target.value } : x))}
                    style={{ flex: 1, padding: '8px 4px', textAlign: 'center', minWidth: 0 }} />
                </>
              )}
              <button onClick={() => removeSet(i)} title="Quitar serie" style={{
                width: 18, background: 'none', border: 'none', color: isExtra ? '#E05252' : 'var(--border)', cursor: 'pointer', fontSize: 16, padding: 0, flexShrink: 0,
              }}>×</button>
            </div>
          )})}
          <button onClick={addSet} style={{
            width: '100%', padding: '7px', borderRadius: 8, border: '1px dashed var(--border)', cursor: 'pointer',
            fontWeight: 700, fontSize: 12, background: 'var(--bg)', color: 'var(--muted)', marginTop: 4, marginBottom: 10,
          }}>➕ Añadir serie</button>
          <button className="btn-primary" onClick={logSets} disabled={saving} style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}>
            {saving ? <><span className="spinner" /> Guardando…</> : '✓ Guardar sesión'}
          </button>
        </div>
      )}

      {showHistory && history && (
        <div style={{ marginTop: 12 }}>
          {history.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center' }}>Sin historial aún</p>
          ) : (
            <>
              {history.length >= 2 && (() => {
                const chartData = [...history].reverse().map(s => ({
                  fecha: parseDate(s.date).toLocaleDateString('es', { day: 'numeric', month: 'short' }),
                  max: Math.max(...s.sets.map(x => x.weight_kg || 0)),
                }));
                return (
                  <div style={{ marginBottom: 12 }}>
                    <p style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, marginBottom: 6 }}>PROGRESIÓN DE PESO MÁXIMO</p>
                    <ResponsiveContainer width="100%" height={90}>
                      <LineChart data={chartData}>
                        <XAxis dataKey="fecha" tick={{ fontSize: 10, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                        <Tooltip formatter={v => [`${v} kg`, 'Máx']} contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', fontSize: 12 }} />
                        <Line type="monotone" dataKey="max" stroke="var(--coral)" strokeWidth={2.5} dot={{ r: 3, fill: 'var(--coral)' }} connectNulls />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                );
              })()}
              <p style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, marginBottom: 8 }}>HISTORIAL DE SESIONES</p>
              {history.map(session => (
                <div key={session.date} style={{ background: 'var(--card)', borderRadius: 10, padding: '10px 12px', marginBottom: 8 }}>
                  <p style={{ fontWeight: 700, fontSize: 13, marginBottom: 6, color: 'var(--coral)' }}>
                    {parseDate(session.date).toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </p>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {session.sets.map((s, i) => (
                      <span key={i} style={{ fontSize: 12, background: 'var(--bg)', padding: '4px 10px', borderRadius: 6, fontWeight: 600 }}>
                        {setChipText(s, i)}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// Texto de una serie: peso + reps y/o isometría, según lo que tenga
function setChipText(s, i) {
  const w    = s.weight_kg ?? s.weight;
  const reps = s.reps_done ?? s.reps;
  const dur  = s.duration_secs;
  const hasReps = reps != null && reps !== '';
  const hasDur  = dur  != null && dur  !== '';
  const wtxt = (w != null && w !== '') ? `${w}kg` : '—kg';
  const parts = [];
  if (hasReps) parts.push(`× ${reps}`);
  if (hasDur)  parts.push(`${dur}s`);
  const prefix = hasDur && !hasReps ? '⏱️ ' : `S${i + 1}: `;
  return `${prefix}${wtxt}${parts.length ? ' ' + parts.join(' · ') : ''}`;
}

// Ejercicios que la clienta agrega al día de HOY (solo para esta sesión)
function ExtraExercises({ dayId, onKcalChange, weightFactor = 1, bodyWeight = 65 }) {
  const today = new Date().toLocaleDateString('en-CA');
  const [list, setList]     = useState([]);
  const [adding, setAdding] = useState(false);
  const [name, setName]     = useState('');
  const [sets, setSets]     = useState([{ weight_kg: '', reps_done: '', duration_secs: '' }]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.workout.getExtraExercises(dayId, today).then(r => setList(r.exercises || [])).catch(() => {});
  }, [dayId, today]);

  // Reporta al día las kcal de los ejercicios extra guardados
  useEffect(() => {
    const k = (list || []).reduce((sum, item) => sum + calcStrengthKcal(item.sets, bodyWeight), 0);
    onKcalChange?.(k);
  }, [list, onKcalChange, bodyWeight]);

  function addRow()     { setSets(s => [...s, { weight_kg: '', reps_done: '', duration_secs: '' }]); }
  function rmRow(i)     { setSets(s => s.filter((_, j) => j !== i)); }
  function upd(i, k, v) { setSets(s => s.map((x, j) => j === i ? { ...x, [k]: v } : x)); }

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await api.workout.addExtraExercise(dayId, name.trim(), sets, today);
      const r = await api.workout.getExtraExercises(dayId, today);
      setList(r.exercises || []);
      setName(''); setSets([{ weight_kg: '', reps_done: '', duration_secs: '' }]); setAdding(false);
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  }
  async function del(id) {
    if (!window.confirm('¿Quitar este ejercicio de hoy?')) return;
    await api.workout.deleteExtraExercise(id).catch(() => {});
    setList(l => l.filter(x => x.id !== id));
  }

  const chip = (s, i) => (
    <span key={i} style={{ fontSize: 12, background: 'var(--bg)', padding: '4px 10px', borderRadius: 6, fontWeight: 600 }}>
      {setChipText(s, i)}
    </span>
  );

  return (
    <div style={{ background: 'var(--bg)', borderRadius: 14, padding: 14 }}>
      <p style={{ fontWeight: 700, fontSize: 14, marginBottom: list.length || adding ? 10 : 0 }}>➕ Ejercicios extra de hoy</p>

      {list.map(item => (
        <div key={item.id} style={{ background: 'var(--card)', borderRadius: 10, padding: '10px 12px', marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <p style={{ fontWeight: 700, fontSize: 14 }}>{item.name}</p>
            <button onClick={() => del(item.id)} style={{ background: 'none', border: 'none', color: '#E05252', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>Quitar</button>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{(item.sets || []).map(chip)}</div>
        </div>
      ))}

      {adding ? (
        <div style={{ background: 'var(--card)', borderRadius: 12, padding: 12, marginTop: list.length ? 4 : 0 }}>
          <input className="input" placeholder="Nombre del ejercicio (ej: Peso muerto)" value={name}
            onChange={e => setName(e.target.value)} style={{ marginBottom: 10 }} />
          <div style={{ display: 'flex', gap: 6, marginBottom: 4, paddingLeft: 42 }}>
            <span style={{ flex: 1, fontSize: 10, color: 'var(--muted)', textAlign: 'center' }}>Peso (kg)</span>
            <span style={{ flex: 1, fontSize: 10, color: 'var(--muted)', textAlign: 'center' }}>Reps</span>
            <span style={{ flex: 1, fontSize: 10, color: 'var(--muted)', textAlign: 'center' }}>Iso (seg)</span>
            <span style={{ width: 18, flexShrink: 0 }} />
          </div>
          {sets.map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', width: 36, flexShrink: 0 }}>{i + 1}</span>
              <input className="input" type="number" step="0.5" min="0" max="999" placeholder="0"
                value={s.weight_kg} onChange={e => upd(i, 'weight_kg', e.target.value)} style={{ flex: 1, padding: '8px 4px', textAlign: 'center', minWidth: 0 }} />
              <input className="input" type="number" min="0" placeholder="10"
                value={s.reps_done} onChange={e => upd(i, 'reps_done', e.target.value)} style={{ flex: 1, padding: '8px 4px', textAlign: 'center', minWidth: 0 }} />
              <input className="input" type="number" min="0" placeholder="–"
                value={s.duration_secs} onChange={e => upd(i, 'duration_secs', e.target.value)} style={{ flex: 1, padding: '8px 4px', textAlign: 'center', minWidth: 0 }} />
              <button onClick={() => rmRow(i)} style={{ width: 18, background: 'none', border: 'none', color: sets.length > 1 ? '#E05252' : 'var(--border)', cursor: 'pointer', fontSize: 16, flexShrink: 0, padding: 0 }}>×</button>
            </div>
          ))}
          <button onClick={addRow} style={{ width: '100%', padding: '7px', borderRadius: 8, border: '1px dashed var(--border)', cursor: 'pointer', fontWeight: 700, fontSize: 12, background: 'var(--bg)', color: 'var(--muted)', marginTop: 4, marginBottom: 10 }}>➕ Añadir serie</button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { setAdding(false); setName(''); }} style={{ flex: 1, padding: '9px', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, background: 'var(--border)', color: 'var(--muted)' }}>Cancelar</button>
            <button className="btn-primary" onClick={save} disabled={saving || !name.trim()} style={{ flex: 2, justifyContent: 'center' }}>{saving ? 'Guardando…' : '✓ Guardar ejercicio'}</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} style={{
          width: '100%', padding: '9px', borderRadius: 10, border: '1px dashed var(--coral)', cursor: 'pointer',
          fontWeight: 700, fontSize: 13, background: 'var(--coral-light)', color: 'var(--coral)', marginTop: list.length ? 4 : 0,
        }}>➕ Añadir ejercicio a hoy</button>
      )}
    </div>
  );
}

const EXERCISE_TYPES = [
  { key: 'strength', label: '🏋️ Fuerza', fields: ['sets', 'reps', 'weight_kg'] },
  { key: 'time',     label: '⏱️ Tiempo', fields: ['sets', 'duration_secs'] },
  { key: 'cardio',   label: '🏃 Cardio',  fields: ['duration_mins'] },
];

function emptyExercise() {
  return { name: '', type: 'strength', sets: '', reps: '', weight_kg: '', duration_secs: '', duration_mins: '' };
}

function FreeWorkout({ onCompleted, weightFactor = 1, bodyWeight = 65 }) {
  const [open, setOpen] = useState(false);
  const [exercises, setExercises] = useState([emptyExercise()]);
  const [note, setNote] = useState('');
  const [date, setDate] = useState(new Date().toLocaleDateString('en-CA'));
  const [saving, setSaving] = useState(false);
  const [sessions, setSessions] = useState(null);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    api.workout.getFree().then(r => setSessions(r.sessions || [])).catch(() => {});
  }, []);

  function updateEx(i, field, value) {
    setExercises(prev => prev.map((e, j) => j === i ? { ...e, [field]: value } : e));
  }

  function addExercise() { setExercises(prev => [...prev, emptyExercise()]); }
  function removeExercise(i) { setExercises(prev => prev.filter((_, j) => j !== i)); }

  async function save() {
    const valid = exercises.filter(e => e.name.trim());
    if (valid.length === 0) return;
    setSaving(true);
    try {
      const payload = valid.map(e => {
        const base = { name: e.name.trim(), type: e.type };
        if (e.type === 'strength') { base.sets = Number(e.sets)||null; base.reps = Number(e.reps)||null; base.weight_kg = Number(e.weight_kg)||null; }
        if (e.type === 'time')     { base.sets = Number(e.sets)||null; base.duration_secs = Number(e.duration_secs)||null; }
        if (e.type === 'cardio')   { base.duration_mins = Number(e.duration_mins)||null; }
        return base;
      });
      await api.workout.saveFree(payload, note || null, date);
      // refresh history
      const r = await api.workout.getFree(); setSessions(r.sessions || []);
      // calc kcal approx (ajustado al peso corporal)
      const kcal = payload.reduce((sum, e) => {
        // Cardio: por minutos, escalado al peso real (tabla base a 65 kg)
        if (e.type === 'cardio') return sum + (e.duration_mins || 0) * 7 * (bodyWeight / 65);
        // Fuerza / isometría: por esfuerzo × peso corporal REAL + bono por peso externo
        const effReps = (e.sets || (e.type === 'time' ? 1 : 3)) * ((e.reps || 0) + (e.duration_secs || 0) / 3 || (e.type === 'time' ? 0 : 10));
        return sum + effReps * (bodyWeight * 0.01 + (e.weight_kg || 0) * 0.004);
      }, 0);
      setExercises([emptyExercise()]); setNote(''); setOpen(false);
      onCompleted(Math.round(kcal), date);
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="card" style={{ marginTop: 8, marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: open ? 16 : 0 }}>
        <div>
          <p style={{ fontWeight: 800, fontSize: 15 }}>🆓 Entrenamiento libre</p>
          {!open && <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>Ejercicios fuera de tu rutina</p>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {sessions && sessions.length > 0 && (
            <button onClick={() => setShowHistory(h => !h)} style={{
              background: 'var(--bg)', border: 'none', borderRadius: 10, padding: '7px 12px',
              fontSize: 13, fontWeight: 700, color: 'var(--muted)', cursor: 'pointer',
            }}>📋</button>
          )}
          <button onClick={() => setOpen(o => !o)} style={{
            background: open ? 'var(--coral)' : 'var(--coral-light)', border: 'none', borderRadius: 10,
            padding: '7px 14px', fontSize: 13, fontWeight: 700,
            color: open ? '#fff' : 'var(--coral)', cursor: 'pointer',
          }}>
            {open ? '✕ Cancelar' : '➕ Registrar'}
          </button>
        </div>
      </div>

      {showHistory && sessions && (
        <div style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, marginBottom: 8 }}>SESIONES ANTERIORES</p>
          {sessions.map(s => {
            const exs = typeof s.exercises === 'string' ? JSON.parse(s.exercises) : s.exercises;
            const dateLabel = new Date(`${String(s.session_date).slice(0,10)}T00:00:00`)
              .toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'short' });
            return (
              <div key={s.id} style={{ background: 'var(--bg)', borderRadius: 12, padding: '12px 14px', marginBottom: 8 }}>
                <p style={{ fontWeight: 700, fontSize: 13, color: 'var(--coral)', marginBottom: 6, textTransform: 'capitalize' }}>{dateLabel}</p>
                {s.note && <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6, fontStyle: 'italic' }}>"{s.note}"</p>}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {exs.map((e, i) => (
                    <p key={i} style={{ fontSize: 13 }}>
                      <span style={{ fontWeight: 600 }}>{e.name}</span>
                      {e.type === 'strength' && e.sets && ` · ${e.sets}×${e.reps||'?'}${e.weight_kg ? ` a ${e.weight_kg}kg` : ''}`}
                      {e.type === 'time'     && e.sets && ` · ${e.sets}×${e.duration_secs||'?'}seg`}
                      {e.type === 'cardio'   && e.duration_mins && ` · ${e.duration_mins} min`}
                    </p>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Date picker */}
          <div>
            <label style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, display: 'block', marginBottom: 4 }}>FECHA</label>
            <input className="input" type="date" value={date} onChange={e => setDate(e.target.value)}
              style={{ fontSize: 13, padding: '8px 10px' }} />
          </div>

          {exercises.map((ex, i) => (
            <div key={i} style={{ background: 'var(--bg)', borderRadius: 14, padding: '14px' }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <input className="input" placeholder="Nombre del ejercicio" value={ex.name}
                  onChange={e => updateEx(i, 'name', e.target.value)}
                  style={{ flex: 1, fontSize: 13, padding: '8px 10px', fontWeight: 600 }} />
                {exercises.length > 1 && (
                  <button onClick={() => removeExercise(i)} style={{
                    background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 18, flexShrink: 0,
                  }}>✕</button>
                )}
              </div>

              {/* Type selector */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                {EXERCISE_TYPES.map(t => (
                  <button key={t.key} onClick={() => updateEx(i, 'type', t.key)} style={{
                    flex: 1, padding: '6px 4px', borderRadius: 8, border: 'none', cursor: 'pointer',
                    fontSize: 11, fontWeight: 700,
                    background: ex.type === t.key ? 'var(--coral)' : 'var(--card)',
                    color: ex.type === t.key ? '#fff' : 'var(--muted)',
                  }}>{t.label}</button>
                ))}
              </div>

              {/* Fields por tipo */}
              <div style={{ display: 'flex', gap: 8 }}>
                {ex.type === 'strength' && (
                  <>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 10, color: 'var(--muted)', display: 'block', marginBottom: 3 }}>Series</label>
                      <input className="input" type="number" min="1" placeholder="3" value={ex.sets}
                        onChange={e => updateEx(i, 'sets', e.target.value)} style={{ padding: '7px', textAlign: 'center' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 10, color: 'var(--muted)', display: 'block', marginBottom: 3 }}>Reps</label>
                      <input className="input" type="number" min="1" placeholder="12" value={ex.reps}
                        onChange={e => updateEx(i, 'reps', e.target.value)} style={{ padding: '7px', textAlign: 'center' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 10, color: 'var(--muted)', display: 'block', marginBottom: 3 }}>Peso (kg)</label>
                      <input className="input" type="number" min="0" step="0.5" placeholder="0" value={ex.weight_kg}
                        onChange={e => updateEx(i, 'weight_kg', e.target.value)} style={{ padding: '7px', textAlign: 'center' }} />
                    </div>
                  </>
                )}
                {ex.type === 'time' && (
                  <>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 10, color: 'var(--muted)', display: 'block', marginBottom: 3 }}>Series</label>
                      <input className="input" type="number" min="1" placeholder="3" value={ex.sets}
                        onChange={e => updateEx(i, 'sets', e.target.value)} style={{ padding: '7px', textAlign: 'center' }} />
                    </div>
                    <div style={{ flex: 2 }}>
                      <label style={{ fontSize: 10, color: 'var(--muted)', display: 'block', marginBottom: 3 }}>Duración (seg)</label>
                      <input className="input" type="number" min="1" placeholder="30" value={ex.duration_secs}
                        onChange={e => updateEx(i, 'duration_secs', e.target.value)} style={{ padding: '7px', textAlign: 'center' }} />
                    </div>
                  </>
                )}
                {ex.type === 'cardio' && (
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 10, color: 'var(--muted)', display: 'block', marginBottom: 3 }}>Duración (min)</label>
                    <input className="input" type="number" min="1" placeholder="20" value={ex.duration_mins}
                      onChange={e => updateEx(i, 'duration_mins', e.target.value)} style={{ padding: '7px', textAlign: 'center' }} />
                  </div>
                )}
              </div>
            </div>
          ))}

          <button onClick={addExercise} style={{
            background: 'var(--bg)', border: '2px dashed var(--border)', borderRadius: 12,
            padding: '10px', fontSize: 13, fontWeight: 700, color: 'var(--muted)', cursor: 'pointer',
          }}>
            ➕ Agregar otro ejercicio
          </button>

          <input className="input" placeholder="Nota opcional (ej: Hotel en Madrid)" value={note}
            onChange={e => setNote(e.target.value)} style={{ fontSize: 13, padding: '9px 12px' }} />

          <button className="btn-primary" onClick={save} disabled={saving}
            style={{ width: '100%', justifyContent: 'center' }}>
            {saving ? <><span className="spinner" /> Guardando…</> : '✓ Guardar entrenamiento'}
          </button>
        </div>
      )}
    </div>
  );
}

const MILESTONES = { 7: '¡1 SEMANA DE RACHA!', 14: '¡2 SEMANAS DE RACHA!', 30: '¡1 MES DE RACHA!', 50: '¡50 DÍAS DE RACHA!', 100: '¡100 DÍAS! IMPARABLE', 200: '¡200 DÍAS! LEYENDA', 365: '¡1 AÑO DE RACHA! 👑' };

// Separa "Lunes — Pecho" / "Martes: Espalda Imponente" en { weekday, routine }
function splitDayName(fullName) {
  const raw = (fullName || '').trim();
  const m = raw.match(/^(.*?)\s*[—–\-:·]\s*(.+)$/);
  if (m) return { weekday: m[1].trim(), routine: m[2].trim() };
  const DAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'miercoles', 'jueves', 'viernes', 'sábado', 'sabado'];
  if (DAYS.includes(raw.toLowerCase())) return { weekday: raw, routine: '' };
  return { weekday: '', routine: raw };
}

// Mini Vic (llama con carita) en estado "celebrando" para la tarjeta de racha
function MiniVic({ size = 28 }) {
  const CX = 60, EY = 78, MY = 96, ELX = 42, ERX = 78;
  const face = `<svg viewBox="0 0 120 130" style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none">
    <text x="4" y="18" font-size="13">⭐</text><text x="95" y="16" font-size="13">⭐</text>
    <text x="${ELX}" y="${EY + 6}" text-anchor="middle" font-size="18">⭐</text>
    <text x="${ERX}" y="${EY + 6}" text-anchor="middle" font-size="18">⭐</text>
    <path d="M ${CX - 12} ${MY - 3} Q ${CX} ${MY + 14} ${CX + 12} ${MY - 3}" fill="#CC1800" stroke="#881000" stroke-width="1.5"/>
    <ellipse cx="${CX}" cy="${MY - 1}" rx="9" ry="3.5" fill="rgba(255,255,255,.75)"/>
  </svg>`;
  return (
    <span style={{ position: 'relative', display: 'inline-block', width: size, height: Math.round(size * 1.08), flexShrink: 0, verticalAlign: 'middle' }}>
      <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: Math.round(size * 0.86), lineHeight: 1 }}>🔥</span>
      <span dangerouslySetInnerHTML={{ __html: face }} />
    </span>
  );
}

function CelebrationModal({ dayName, kcal, streak, completedDate, completedDays, onClose }) {
  const shareRef = useRef(null);
  // Fecha de referencia = la del entrenamiento completado (no la de hoy). Así, si
  // registras el sábado un día domingo, la tarjeta muestra el sábado correctamente.
  const refDate = completedDate ? new Date(`${completedDate}T00:00:00`) : new Date();
  const refDateStr = refDate.toLocaleDateString('en-CA');
  const dateLabel = refDate.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' });
  const milestone = MILESTONES[streak] || null;
  const { weekday, routine } = splitDayName(dayName);
  const bigTitle = routine || weekday || 'Entrenamiento';
  const subtitle = weekday ? `Rutina del día · "${weekday}"` : 'Rutina del día';

  // Fechas completadas esta semana
  const completedDates = new Set(
    Object.values(completedDays || {})
      .filter(v => typeof v === 'string')
  );

  const dow = refDate.getDay();
  const monday = new Date(refDate); monday.setDate(refDate.getDate() - ((dow + 6) % 7));
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday); d.setDate(monday.getDate() + i);
    const dateStr = d.toLocaleDateString('en-CA');
    const isToday = dateStr === refDateStr;
    const isDone  = completedDates.has(dateStr) || isToday;
    return { label: ['L','M','M','J','V','S','D'][i], date: d.getDate(), isToday, isDone };
  });

  async function handleShare() {
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(shareRef.current, {
        backgroundColor: '#1a1a1a',
        scale: 2,
        useCORS: true,
        allowTaint: true,
      });
      canvas.toBlob(async blob => {
        const file = new File([blob], 'lovic-entrenamiento.png', { type: 'image/png' });
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: milestone ? `🏅 ${milestone}` : '¡Entrené hoy! 💪', text: milestone ? `${milestone} #LovicGym #YoEntreno` : `#LovicGym #YoEntreno` });
        } else {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a'); a.href = url; a.download = 'lovic-entrenamiento.png'; a.click();
          URL.revokeObjectURL(url);
        }
      }, 'image/png');
    } catch (e) {
      if (navigator.share) {
        navigator.share({ title: '¡Entrené hoy! 💪', text: `Rutina de ${dayName} completada. ¡${streak} día${streak !== 1 ? 's' : ''} de racha! #LovicGym` }).catch(() => {});
      }
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px',
      overflowY: 'auto',
    }}>
      <div style={{ width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Todo lo que va en la imagen al compartir */}
        <div ref={shareRef} style={{
          background: '#1a1a1a',
          borderRadius: 24,
          padding: '28px 24px',
        }}>
          {/* Trofeo y título */}
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 60, lineHeight: 1, marginBottom: 10 }}>{milestone ? '🏅' : '🏆'}</div>
            <h2 style={{ color: '#ffffff', fontSize: 24, fontWeight: 900, marginBottom: 4 }}>¡Rutina completada!</h2>
            <p style={{ color: '#FF6B4A', fontWeight: 600, fontSize: 13, textTransform: 'capitalize' }}>{dateLabel}</p>
          </div>

          {/* Banner de hito */}
          {milestone && (
            <div style={{
              background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
              borderRadius: 14, padding: '12px 16px', marginBottom: 20, textAlign: 'center',
            }}>
              <p style={{ fontSize: 18, fontWeight: 900, color: '#1a1a1a', letterSpacing: 1 }}>🏅 {milestone}</p>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(0,0,0,0.6)', marginTop: 2 }}>Hito desbloqueado</p>
            </div>
          )}

          {/* Semana */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
            {weekDays.map((d, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                <span style={{ fontSize: 11, color: '#666', fontWeight: 600 }}>{d.label}</span>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: d.isToday ? '#FF6B4A' : d.isDone ? '#ff9a7a' : '#2a2a2a',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: d.isDone ? '#ffffff' : '#555', fontWeight: 700, fontSize: 13,
                  border: d.isToday ? '2px solid #fff' : 'none',
                }}>
                  {d.isDone ? '✓' : d.date}
                </div>
              </div>
            ))}
          </div>

          {/* Tarjeta naranja */}
          <div style={{
            background: 'linear-gradient(135deg, #FF6B4A 0%, #e8440f 100%)',
            borderRadius: 20, padding: '24px 20px',
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', top: -30, right: -30, width: 130, height: 130, background: 'rgba(255,255,255,0.08)', borderRadius: '50%' }} />
            <p style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.7)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}>LOVIC GYM</p>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', fontWeight: 600, marginBottom: 4 }}>{subtitle}</p>
            <p style={{ fontSize: 22, fontWeight: 900, color: '#ffffff', marginBottom: 16 }}>{bigTitle} 💪</p>
            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
              <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: '10px 14px', flex: 1 }}>
                <p style={{ fontSize: 24, fontWeight: 900, color: '#ffffff', lineHeight: 1, display: 'flex', alignItems: 'center', gap: 6 }}><MiniVic size={28} /> {streak}</p>
                <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.75)', fontWeight: 600, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>días de racha</p>
              </div>
              {kcal > 0 && (
                <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: '10px 14px', flex: 1 }}>
                  <p style={{ fontSize: 24, fontWeight: 900, color: '#ffffff', lineHeight: 1 }}>~{kcal}</p>
                  <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.75)', fontWeight: 600, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>kcal quemadas</p>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>#LovicGym #YoEntreno</span>
              <span style={{ fontSize: 14, fontWeight: 900, color: '#ffffff' }}>LOVIC</span>
            </div>
          </div>
        </div>

        <button onClick={handleShare} style={{
          background: '#FF6B4A', color: '#fff', border: 'none', borderRadius: 16,
          padding: '16px', fontSize: 16, fontWeight: 800, cursor: 'pointer',
          boxShadow: '0 4px 20px rgba(255,107,74,0.4)',
        }}>
          📤 Compartir en redes
        </button>
        <button onClick={onClose} style={{
          background: 'transparent', color: '#666', border: 'none',
          padding: '12px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
        }}>
          Ir al inicio
        </button>
      </div>
    </div>
  );
}
