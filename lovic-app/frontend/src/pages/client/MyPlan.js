import React, { useEffect, useState, useCallback, useRef } from 'react';
import { LineChart, Line, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { api } from '../../services/api';

export default function MyPlan() {
  const [tab, setTab]         = useState('routine');
  const [plan, setPlan]       = useState(null);
  const [nutrition, setNutrition] = useState(null);
  const [loading, setLoading] = useState(true);
  const [streak, setStreak]   = useState(0);

  const [completedDays, setCompletedDays] = useState({});
  const [celebration, setCelebration] = useState(null); // { dayName, kcal }

  const load = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    try {
      const [wRes, dRes, cRes] = await Promise.all([api.workout.plan(), api.dashboard.get(), api.workout.completedDays()]);
      setPlan(wRes.plan);
      setNutrition(dRes.nutrition_plan);
      setStreak(dRes.streak || 0);
      const map = {};
      (cRes.completed || []).forEach(r => {
        if (typeof r === 'string') map[r] = true;
        else map[r.day_id] = r.last_completed ? String(r.last_completed).slice(0, 10) : true;
      });
      setCompletedDays(map);
    } finally { if (showSpinner) setLoading(false); }
  }, []);

  async function toggleDay(dayId, dayName, kcal, date) {
    const done = !completedDays[dayId];
    const useDate = date || new Date().toLocaleDateString('en-CA');
    setCompletedDays(prev => ({ ...prev, [dayId]: done ? useDate : undefined }));
    try { await api.workout.completeDay(dayId, done, useDate); } catch (_) {}
    if (done) {
      const dRes = await api.dashboard.get().catch(() => null);
      const newStreak = dRes?.streak || streak + 1;
      setStreak(newStreak);
      setCelebration({ dayName, kcal, streak: newStreak });
    }
  }

  useEffect(() => { load(); }, [load]);

  if (loading) return <div style={{ textAlign: 'center', padding: 48 }}><div className="spinner" style={{ borderTopColor: 'var(--coral)', borderColor: 'var(--border)', width: 28, height: 28 }} /></div>;

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
          onClose={() => setCelebration(null)}
        />
      )}

      {tab === 'routine' && (
        <>
          {plan ? (
            <div>
              {plan.duration_days && <PlanProgress startDate={plan.start_date || plan.created_at} durationDays={plan.duration_days} />}
              {plan.days.map(day => (
                <DayCard key={day.id} day={day} onLogged={load}
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
            <FreeWorkout onCompleted={(kcal) => {
              api.dashboard.get().then(d => {
                setCelebration({ dayName: 'Entrenamiento libre', kcal, streak: d.streak || streak });
                setStreak(d.streak || streak);
              }).catch(() => setCelebration({ dayName: 'Entrenamiento libre', kcal, streak }));
            }} />
          </div>
        </>
      )}

      {tab === 'nutrition' && (
        nutrition ? <NutritionView content={nutrition.content} updatedAt={nutrition.created_at} /> : (
          <div className="empty-state">
            <div className="icon">🥗</div>
            <p>Tu entrenadora aún no ha asignado un plan nutricional.<br />¡Pronto lo tendrás!</p>
          </div>
        )
      )}
    </div>
  );
}

const WARMUP_OPTIONS = ['Movilidad articular', 'Trote suave', 'Saltos', 'Sentadillas sin peso', 'Jumping jacks', 'Estiramientos dinámicos', 'Remo', 'Otro'];
const CARDIO_OPTIONS = ['Cuerda', 'Caminadora', 'Escaleras', 'Elíptica', 'Stepper', 'Bicicleta', 'Remo'];

// kcal/min approx for 65kg person
const WARMUP_KCAL = { 'Movilidad articular': 2.5, 'Trote suave': 7, 'Saltos': 6, 'Sentadillas sin peso': 4, 'Jumping jacks': 6, 'Estiramientos dinámicos': 2 };
const CARDIO_KCAL = { 'Cuerda': 12, 'Caminadora': 6, 'Escaleras': 9, 'Elíptica': 8, 'Stepper': 7, 'Bicicleta': 7, 'Remo': 8 };

function calcKcal(table, type, mins) {
  if (!type || !mins) return null;
  const rate = table[type];
  return rate ? Math.round(rate * mins) : null;
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
  const start = new Date(startDate);
  const elapsed = Math.floor((Date.now() - start) / 86400000);
  const dayOfPlan = Math.min(elapsed + 1, durationDays);
  const pct = Math.min(Math.round((elapsed / durationDays) * 100), 100);
  const daysLeft = durationDays - elapsed;
  const expired = elapsed >= durationDays;
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

function ActivityBlock({ emoji, label, options, kcalTable, defaultDuration, choice, setChoice, mins, setMins, done, setDone, history = [] }) {
  const kcal = calcKcal(kcalTable, choice, Number(mins));
  const [showHistory, setShowHistory] = useState(false);
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
      <select className="input" value={choice === 'Otro' || (!options.includes(choice) && choice) ? 'Otro' : choice} onChange={e => { setChoice(e.target.value); setDone(false); }} style={{ fontSize: 13, padding: '8px 10px', marginBottom: 8 }}>
        <option value="">Sin {label.toLowerCase()} hoy</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
      {(choice === 'Otro' || (!options.includes(choice) && choice)) && (
        <input className="input" placeholder="¿Qué hiciste?" value={choice === 'Otro' ? '' : choice}
          onChange={e => setChoice(e.target.value || 'Otro')}
          style={{ fontSize: 13, padding: '8px 10px', marginBottom: 8 }} autoFocus />
      )}
      {choice && choice !== 'Otro' && (
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

// kcal from real logged sets: weight(kg) × reps × sets × 0.1 (aprox)
function calcStrengthKcal(setWeights) {
  return Math.round(setWeights.reduce((sum, s) => {
    const w = parseFloat(s.weight_kg) || 0;
    const r = parseFloat(s.reps_done) || 0;
    return sum + w * r * 0.1;
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

function DayCard({ day, onLogged, completedDate, onToggleComplete }) {
  const todayDayEs = DAYS_ES[new Date().getDay()];
  const isToday = day.day_name.toLowerCase().startsWith(todayDayEs);
  const [open, setOpen] = useState(isToday);

  const [warmupChoice, setWarmupChoice] = useState('');
  const [warmupMins, setWarmupMins]     = useState(day.warmup_duration || '');
  const [warmupDone, setWarmupDone]     = useState(false);
  const [cardioChoice, setCardioChoice] = useState('');
  const [cardioMins, setCardioMins]     = useState(day.cardio_duration || '');
  const [cardioDone, setCardioDone]     = useState(false);
  const [activityLoaded, setActivityLoaded] = useState(false);
  const [allActivities, setAllActivities] = useState([]);
  const [confirmingDate, setConfirmingDate] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toLocaleDateString('en-CA'));

  const today = new Date().toLocaleDateString('en-CA');

  // Load today's activity from backend on mount
  useEffect(() => {
    api.workout.getActivity(day.id).then(res => {
      const acts = res.activities || [];
      setAllActivities(acts);
      // Find most recent entry for each type
      const w = acts.find(a => a.type === 'warmup');
      const c = acts.find(a => a.type === 'cardio');
      if (w) { setWarmupChoice(w.activity_name); setWarmupMins(w.duration_mins || ''); setWarmupDone(true); }
      if (c) { setCardioChoice(c.activity_name); setCardioMins(c.duration_mins || ''); setCardioDone(true); }
      setActivityLoaded(true);
    }).catch(err => { console.error('Activity load error:', err); setActivityLoaded(true); });
  }, [day.id]); // eslint-disable-line

  // Save to backend when done is toggled or choice/mins change (only after initial load)
  useEffect(() => {
    if (!activityLoaded) return;
    if (warmupChoice && warmupChoice !== 'Otro') {
      api.workout.saveActivity(day.id, 'warmup', warmupChoice, Number(warmupMins) || null).catch(() => {});
    }
  }, [warmupChoice, warmupMins, warmupDone, activityLoaded]); // eslint-disable-line

  useEffect(() => {
    if (!activityLoaded) return;
    if (cardioChoice && cardioChoice !== 'Otro') {
      api.workout.saveActivity(day.id, 'cardio', cardioChoice, Number(cardioMins) || null).catch(() => {});
    }
  }, [cardioChoice, cardioMins, cardioDone, activityLoaded]); // eslint-disable-line
  // kcal per exercise keyed by ex.id, updated by ExerciseCard
  const [exKcal, setExKcal] = useState({});

  const warmupKcal = calcKcal(WARMUP_KCAL, warmupChoice, Number(warmupMins)) || 0;
  const cardioKcal = calcKcal(CARDIO_KCAL, cardioChoice, Number(cardioMins)) || 0;
  const strengthKcal = Object.values(exKcal).reduce((a, b) => a + b, 0);
  const totalKcal = warmupKcal + strengthKcal + cardioKcal;

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
          {completedLabel && (
            <p style={{ fontSize: 11, color: '#059669', marginTop: 2, fontWeight: 600 }}>✅ Completado el {completedLabel}</p>
          )}
          {lastSessionLabel && (
            <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Última sesión: {lastSessionLabel}</p>
          )}
        </div>
        <span style={{ color: 'var(--muted)', fontSize: 14 }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <ActivityBlock emoji="🔥" label="Calentamiento" options={WARMUP_OPTIONS} kcalTable={WARMUP_KCAL}
            defaultDuration={day.warmup_duration} choice={warmupChoice} setChoice={setWarmupChoice}
            mins={warmupMins} setMins={setWarmupMins} done={warmupDone} setDone={setWarmupDone}
            history={allActivities.filter(a => a.type === 'warmup')} />
          {day.exercises.map(ex => (
            <ExerciseCard key={ex.id} exercise={ex} onLogged={() => onLogged(false)}
              onKcalChange={kcal => setExKcal(prev => ({ ...prev, [ex.id]: kcal }))} />
          ))}
          <ActivityBlock emoji="🏃" label="Cardio" options={CARDIO_OPTIONS} kcalTable={CARDIO_KCAL}
            defaultDuration={day.cardio_duration} choice={cardioChoice} setChoice={setCardioChoice}
            mins={cardioMins} setMins={setCardioMins} done={cardioDone} setDone={setCardioDone}
            history={allActivities.filter(a => a.type === 'cardio')} />
          <div style={{ background: 'var(--coral-light)', borderRadius: 12, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontWeight: 700, fontSize: 13, color: 'var(--coral)' }}>🔥 Total estimado del día</p>
              <p style={{ fontSize: 11, color: 'var(--coral)', marginTop: 2 }}>
                {warmupKcal > 0 && `Calent. ${warmupKcal} + `}Fuerza {strengthKcal}{cardioKcal > 0 && ` + Cardio ${cardioKcal}`} kcal
              </p>
            </div>
            <p style={{ fontSize: 28, fontWeight: 900, color: 'var(--coral)' }}>~{totalKcal}</p>
          </div>
          {completedDate ? (
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

function ExerciseCard({ exercise: ex, onLogged, onKcalChange }) {
  const [showLog, setShowLog]     = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory]     = useState(null);
  const [setWeights, setSetWeights] = useState(() => {
    const lastW = ex.last_session?.weights ? ex.last_session.weights.split(',') : [];
    const lastR = ex.last_session?.reps    ? ex.last_session.reps.split(',')    : [];
    return Array.from({ length: ex.sets }, (_, i) => ({
      weight_kg: lastW[i] || ex.weight_kg || '',
      reps_done: lastR[i] || ex.reps || '',
    }));
  });
  const [saving, setSaving]           = useState(false);
  const [showVariations, setShowVariations] = useState(false);

  // Report kcal to parent whenever weights change
  useEffect(() => {
    onKcalChange?.(calcStrengthKcal(setWeights));
  }, [setWeights]); // eslint-disable-line

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
      }));
      await api.workout.log(ex.id, today, sets);
      setShowLog(false);
      onLogged();
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  }

  async function loadHistory() {
    if (history) { setShowHistory(h => !h); return; }
    const res = await api.workout.history(ex.id);
    setHistory(res.history);
    setShowHistory(true);
  }

  const isLoggedToday = lastSession?.logged_date &&
    (lastSession.logged_date instanceof Date
      ? lastSession.logged_date.toISOString().slice(0, 10)
      : String(lastSession.logged_date).slice(0, 10)) === today;

  return (
    <div style={{ background: 'var(--bg)', borderRadius: 14, padding: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div style={{ flex: 1 }}>
          <p style={{ fontWeight: 700, fontSize: 15 }}>{ex.name}</p>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>
            {ex.sets} series × {ex.reps} reps{ex.weight_kg ? ` · ${ex.weight_kg} kg` : ''}
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
          <p style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Registrar pesos de hoy</p>
          {setWeights.map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', width: 60, flexShrink: 0 }}>Serie {i + 1}</span>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 2 }}>Peso (kg)</label>
                <input
                  className="input"
                  type="number" step="0.5" min="0"
                  placeholder={ex.weight_kg || '0'}
                  value={s.weight_kg}
                  onChange={e => setSetWeights(w => w.map((x, j) => j === i ? { ...x, weight_kg: e.target.value } : x))}
                  style={{ padding: '8px', textAlign: 'center' }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 2 }}>Reps</label>
                <input
                  className="input"
                  type="number" min="0"
                  placeholder={ex.reps || '10'}
                  value={s.reps_done}
                  onChange={e => setSetWeights(w => w.map((x, j) => j === i ? { ...x, reps_done: e.target.value } : x))}
                  style={{ padding: '8px', textAlign: 'center' }}
                />
              </div>
            </div>
          ))}
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
                    {session.sets.map(s => (
                      <span key={s.set_number} style={{ fontSize: 12, background: 'var(--bg)', padding: '4px 10px', borderRadius: 6, fontWeight: 600 }}>
                        S{s.set_number}: {s.weight_kg ?? '—'}kg × {s.reps_done ?? '—'}
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

const EXERCISE_TYPES = [
  { key: 'strength', label: '🏋️ Fuerza', fields: ['sets', 'reps', 'weight_kg'] },
  { key: 'time',     label: '⏱️ Tiempo', fields: ['sets', 'duration_secs'] },
  { key: 'cardio',   label: '🏃 Cardio',  fields: ['duration_mins'] },
];

function emptyExercise() {
  return { name: '', type: 'strength', sets: '', reps: '', weight_kg: '', duration_secs: '', duration_mins: '' };
}

function FreeWorkout({ onCompleted }) {
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
      // calc kcal approx
      const kcal = payload.reduce((sum, e) => {
        if (e.type === 'cardio') return sum + (e.duration_mins || 0) * 7;
        if (e.type === 'time')   return sum + ((e.sets || 1) * (e.duration_secs || 0) / 60) * 4;
        return sum + ((e.sets || 3) * (e.reps || 10) * (e.weight_kg || 0) * 0.1);
      }, 0);
      setExercises([emptyExercise()]); setNote(''); setOpen(false);
      onCompleted(Math.round(kcal));
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

function CelebrationModal({ dayName, kcal, streak, onClose }) {
  const shareRef = useRef(null);
  const today = new Date();
  const dateLabel = today.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' });

  const dow = today.getDay();
  const monday = new Date(today); monday.setDate(today.getDate() - ((dow + 6) % 7));
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday); d.setDate(monday.getDate() + i);
    return { label: ['L','M','M','J','V','S','D'][i], date: d.getDate(), isToday: d.toDateString() === today.toDateString() };
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
          await navigator.share({ files: [file], title: '¡Entrené hoy! 💪', text: `#LovicGym #YoEntreno` });
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
            <div style={{ fontSize: 60, lineHeight: 1, marginBottom: 10 }}>🏆</div>
            <h2 style={{ color: '#ffffff', fontSize: 24, fontWeight: 900, marginBottom: 4 }}>¡Rutina completada!</h2>
            <p style={{ color: '#FF6B4A', fontWeight: 600, fontSize: 13, textTransform: 'capitalize' }}>{dateLabel}</p>
          </div>

          {/* Semana */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
            {weekDays.map((d, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                <span style={{ fontSize: 11, color: '#666', fontWeight: 600 }}>{d.label}</span>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: d.isToday ? '#FF6B4A' : '#2a2a2a',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: d.isToday ? '#ffffff' : '#555', fontWeight: 700, fontSize: 13,
                }}>
                  {d.isToday ? '✓' : d.date}
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
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', fontWeight: 600, marginBottom: 4, textTransform: 'capitalize' }}>{today.toLocaleDateString('es', { weekday: 'long' })} · Rutina del día</p>
            <p style={{ fontSize: 22, fontWeight: 900, color: '#ffffff', marginBottom: 16 }}>{dayName} 💪</p>
            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
              <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: '10px 14px', flex: 1 }}>
                <p style={{ fontSize: 24, fontWeight: 900, color: '#ffffff', lineHeight: 1 }}>🔥 {streak}</p>
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
