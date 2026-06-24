import React, { useEffect, useState, useCallback } from 'react';
import { LineChart, Line, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { api } from '../../services/api';

export default function MyPlan() {
  const [tab, setTab]         = useState('routine');
  const [plan, setPlan]       = useState(null);
  const [nutrition, setNutrition] = useState(null);
  const [loading, setLoading] = useState(true);

  const [completedDays, setCompletedDays] = useState({});

  const load = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    try {
      const [wRes, dRes, cRes] = await Promise.all([api.workout.plan(), api.dashboard.get(), api.workout.completedDays()]);
      setPlan(wRes.plan);
      setNutrition(dRes.nutrition_plan);
      const map = {};
      (cRes.completed || []).forEach(id => { map[id] = true; });
      setCompletedDays(map);
    } finally { if (showSpinner) setLoading(false); }
  }, []);

  async function toggleDay(dayId) {
    const done = !completedDays[dayId];
    setCompletedDays(prev => ({ ...prev, [dayId]: done }));
    try { await api.workout.completeDay(dayId, done); } catch (_) {}
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

      {tab === 'routine' && (
        plan ? (
          <div>
            {plan.days.map(day => (
              <DayCard key={day.id} day={day} onLogged={load} />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <div className="icon">💪</div>
            <p>Tu entrenadora aún no ha asignado una rutina.<br />¡Pronto la tendrás!</p>
          </div>
        )
      )}

      {tab === 'nutrition' && (
        nutrition ? (
          <div className="card">
            <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 14, lineHeight: 1.7 }}>{nutrition.content}</pre>
            <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 12 }}>Actualizado: {new Date(nutrition.created_at).toLocaleDateString('es')}</p>
          </div>
        ) : (
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

function ActivityBlock({ emoji, label, options, kcalTable, defaultDuration, choice, setChoice, mins, setMins, done, setDone }) {
  const kcal = calcKcal(kcalTable, choice, Number(mins));
  return (
    <div style={{ background: done ? '#d1fae5' : 'var(--bg)', borderRadius: 12, padding: '12px 14px', transition: 'background 0.3s' }}>
      <p style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>{emoji} {label}</p>
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

function DayCard({ day, onLogged }) {
  const [open, setOpen] = useState(true);

  const [warmupChoice, setWarmupChoice] = useState('');
  const [warmupMins, setWarmupMins]     = useState(day.warmup_duration || '');
  const [warmupDone, setWarmupDone]     = useState(false);
  const [cardioChoice, setCardioChoice] = useState('');
  const [cardioMins, setCardioMins]     = useState(day.cardio_duration || '');
  const [cardioDone, setCardioDone]     = useState(false);
  const [activityLoaded, setActivityLoaded] = useState(false);

  const today = new Date().toLocaleDateString('en-CA');

  // Load today's activity from backend on mount
  useEffect(() => {
    api.workout.getActivity(day.id).then(res => {
      console.log('Activity response:', JSON.stringify(res));
      const acts = res.activities || [];
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

  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: '100%', background: 'none', border: 'none', cursor: 'pointer',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 0,
      }}>
        <div style={{ textAlign: 'left' }}>
          <p style={{ fontWeight: 800, fontSize: 16 }}>{day.day_name}</p>
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
            mins={warmupMins} setMins={setWarmupMins} done={warmupDone} setDone={setWarmupDone} />
          {day.exercises.map(ex => (
            <ExerciseCard key={ex.id} exercise={ex} onLogged={() => onLogged(false)}
              onKcalChange={kcal => setExKcal(prev => ({ ...prev, [ex.id]: kcal }))} />
          ))}
          <ActivityBlock emoji="🏃" label="Cardio" options={CARDIO_OPTIONS} kcalTable={CARDIO_KCAL}
            defaultDuration={day.cardio_duration} choice={cardioChoice} setChoice={setCardioChoice}
            mins={cardioMins} setMins={setCardioMins} done={cardioDone} setDone={setCardioDone} />
          <div style={{ background: 'var(--coral-light)', borderRadius: 12, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontWeight: 700, fontSize: 13, color: 'var(--coral)' }}>🔥 Total estimado del día</p>
              <p style={{ fontSize: 11, color: 'var(--coral)', marginTop: 2 }}>
                {warmupKcal > 0 && `Calent. ${warmupKcal} + `}Fuerza {strengthKcal}{cardioKcal > 0 && ` + Cardio ${cardioKcal}`} kcal
              </p>
            </div>
            <p style={{ fontSize: 28, fontWeight: 900, color: 'var(--coral)' }}>~{totalKcal}</p>
          </div>
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
  const [saving, setSaving] = useState(false);

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
        <button onClick={loadHistory} style={{
          padding: '8px 12px', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13,
          background: 'var(--card)', color: 'var(--muted)',
        }}>
          📈
        </button>
      </div>

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
