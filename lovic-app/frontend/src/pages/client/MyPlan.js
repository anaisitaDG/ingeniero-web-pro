import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../../services/api';

export default function MyPlan() {
  const [tab, setTab]         = useState('routine');
  const [plan, setPlan]       = useState(null);
  const [nutrition, setNutrition] = useState(null);
  const [loading, setLoading] = useState(true);
  const [todayDone, setTodayDone] = useState(false);
  const [completing, setCompleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [wRes, dRes, doneRes] = await Promise.all([api.workout.plan(), api.dashboard.get(), api.workout.todayDone()]);
      setPlan(wRes.plan);
      setNutrition(dRes.nutrition_plan);
      setTodayDone(doneRes.done);
    } finally { setLoading(false); }
  }, []);

  async function markComplete() {
    setCompleting(true);
    try {
      await api.workout.complete();
      setTodayDone(true);
    } catch (e) { alert(e.message); }
    finally { setCompleting(false); }
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
            <button
              onClick={markComplete}
              disabled={completing || todayDone}
              style={{
                width: '100%', padding: '14px', borderRadius: 14, border: 'none', cursor: todayDone ? 'default' : 'pointer',
                fontWeight: 800, fontSize: 16, marginTop: 8, marginBottom: 16,
                background: todayDone ? '#d1fae5' : 'var(--coral)', color: todayDone ? '#065f46' : '#fff',
                transition: 'all 0.2s',
              }}
            >
              {completing ? '⏳ Guardando…' : todayDone ? '✅ Rutina completada hoy' : '🏁 Completé mi rutina hoy'}
            </button>
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

function DayCard({ day, onLogged }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: '100%', background: 'none', border: 'none', cursor: 'pointer',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 0,
      }}>
        <p style={{ fontWeight: 800, fontSize: 16 }}>{day.day_name}</p>
        <span style={{ color: 'var(--muted)', fontSize: 18 }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {day.warmup_type && (
            <div style={{ background: 'var(--bg)', borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 20 }}>🔥</span>
              <div>
                <p style={{ fontWeight: 700, fontSize: 13 }}>Calentamiento: {day.warmup_type}</p>
                {day.warmup_duration && <p style={{ fontSize: 12, color: 'var(--muted)' }}>{day.warmup_duration} min</p>}
              </div>
            </div>
          )}
          {day.exercises.map(ex => (
            <ExerciseCard key={ex.id} exercise={ex} onLogged={onLogged} />
          ))}
          {day.cardio_type && (
            <div style={{ background: 'var(--bg)', borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 20 }}>🏃</span>
              <div>
                <p style={{ fontWeight: 700, fontSize: 13 }}>Cardio: {day.cardio_type}</p>
                {day.cardio_duration && <p style={{ fontSize: 12, color: 'var(--muted)' }}>{day.cardio_duration} min</p>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ExerciseCard({ exercise: ex, onLogged }) {
  const [showLog, setShowLog]     = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory]     = useState(null);
  const [setWeights, setSetWeights] = useState(() =>
    Array.from({ length: ex.sets }, (_, i) => ({ weight_kg: ex.weight_kg || '', reps_done: ex.reps || '' }))
  );
  const [saving, setSaving] = useState(false);

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
          {isLoggedToday ? '✅ Registrado hoy' : `Última vez: ${new Date(lastSession.logged_date).toLocaleDateString('es', { day: 'numeric', month: 'short' })}`}
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
            history.map(session => (
              <div key={session.date} style={{ background: 'var(--card)', borderRadius: 10, padding: '10px 12px', marginBottom: 8 }}>
                <p style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
                  {new Date(session.date).toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' })}
                </p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {session.sets.map(s => (
                    <span key={s.set_number} style={{ fontSize: 12, background: 'var(--bg)', padding: '4px 8px', borderRadius: 6 }}>
                      S{s.set_number}: {s.weight_kg ?? '—'}kg × {s.reps_done ?? '—'}
                    </span>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
