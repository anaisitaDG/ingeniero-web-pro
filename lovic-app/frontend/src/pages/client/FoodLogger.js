import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { api } from '../../services/api';

const MEALS = [
  { key: 'breakfast', label: 'Desayuno', icon: '🌅' },
  { key: 'lunch',     label: 'Almuerzo', icon: '☀️' },
  { key: 'dinner',    label: 'Cena',     icon: '🌙' },
  { key: 'snack',     label: 'Merienda', icon: '🍎' },
];

function defaultMeal() {
  const h = new Date().getHours();
  if (h < 11) return 'breakfast';
  if (h < 15) return 'lunch';
  if (h < 19) return 'snack';
  return 'dinner';
}

export default function FoodLogger() {
  const [logs, setLogs]         = useState([]);
  const [daily, setDaily]       = useState(null);
  const [status, setStatus]     = useState(null);
  const [input, setInput]       = useState('');
  const [mealType, setMealType] = useState(defaultMeal());
  const [loading, setLoading]   = useState(false);
  const [fetching, setFetching] = useState(true);
  const [tab, setTab]           = useState('today');
  const [history, setHistory]   = useState([]);
  const [histLoading, setHistLoading] = useState(false);

  useEffect(() => { fetchToday(); }, []);

  useEffect(() => {
    if (tab === 'history' && history.length === 0) fetchHistory();
  }, [tab]);

  async function fetchToday() {
    setFetching(true);
    try {
      const d = await api.food.today();
      setLogs(d.logs);
      setDaily(d.daily);
      setStatus(d.status);
    } finally {
      setFetching(false);
    }
  }

  async function fetchHistory() {
    setHistLoading(true);
    try {
      const d = await api.food.history(14);
      setHistory(d.history.map(r => ({
        date: new Date(r.logged_at).toLocaleDateString('es', { day: 'numeric', month: 'short' }),
        kcal: Math.round(r.calories),
        prot: Math.round(r.protein_g),
        carbs: Math.round(r.carbs_g),
        fat: Math.round(r.fat_g),
        target: d.target,
      })));
    } finally {
      setHistLoading(false);
    }
  }

  async function handleLog(e) {
    e.preventDefault();
    if (!input.trim()) return;
    setLoading(true);
    try {
      const res = await api.food.log(input.trim(), mealType);
      setInput('');
      setDaily(res.daily);
      await fetchToday();
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id) {
    await api.food.remove(id);
    fetchToday();
  }

  const pct = daily ? Math.min(Math.round((daily.consumed / daily.target) * 100), 100) : 0;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Registro de comida 🥗</h1>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, background: 'var(--border)', padding: 4, borderRadius: 12 }}>
        {[{ key: 'today', label: 'Hoy' }, { key: 'history', label: 'Historial' }].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            flex: 1, padding: '10px', borderRadius: 10, fontWeight: 700, fontSize: 14, border: 'none',
            background: tab === t.key ? 'var(--card)' : 'transparent',
            color: tab === t.key ? 'var(--coral)' : 'var(--muted)',
            boxShadow: tab === t.key ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
            cursor: 'pointer',
          }}>{t.label}</button>
        ))}
      </div>

      {tab === 'today' && (
        <>
          {/* Log input */}
          <form onSubmit={handleLog} style={{ marginBottom: 20 }}>
            <label className="label">Tipo de comida</label>
            <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
              {MEALS.map(m => (
                <button key={m.key} type="button" onClick={() => setMealType(m.key)} style={{
                  flex: 1, minWidth: 70, padding: '8px 6px', borderRadius: 10, border: 'none', cursor: 'pointer',
                  fontWeight: 700, fontSize: 13,
                  background: mealType === m.key ? 'var(--coral)' : 'var(--card)',
                  color: mealType === m.key ? '#fff' : 'var(--muted)',
                  boxShadow: 'var(--shadow)',
                }}>
                  {m.icon}<br />{m.label}
                </button>
              ))}
            </div>
            <label className="label">¿Qué comiste?</label>
            <div style={{ display: 'flex', gap: 10 }}>
              <input className="input" placeholder="Ej: 2 huevos revueltos, 1 arepa, café con leche" value={input} onChange={e => setInput(e.target.value)} />
              <button className="btn-primary" type="submit" disabled={loading} style={{ whiteSpace: 'nowrap', padding: '12px 18px' }}>
                {loading ? <span className="spinner" /> : 'Registrar'}
              </button>
            </div>
            <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>La IA calculará las calorías automáticamente</p>
          </form>

          {/* Daily summary */}
          {daily && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontWeight: 700 }}>{daily.consumed} kcal consumidas</span>
                {status && <span className="pill" style={{ background: status.color, color: '#fff', fontWeight: 700 }}>{status.label}</span>}
              </div>
              <div style={{ height: 8, background: 'var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: pct >= 100 ? '#E05252' : 'var(--coral)', borderRadius: 8 }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                <span style={{ fontSize: 13, color: 'var(--muted)' }}>{daily.remaining} kcal restantes</span>
                <span style={{ fontSize: 13, color: 'var(--muted)' }}>Meta: {daily.target}</span>
              </div>
            </div>
          )}

          {status && (
            <div style={{ background: 'var(--gold-light)', borderRadius: 14, padding: '14px 16px', marginBottom: 20, borderLeft: `4px solid ${status.color}` }}>
              <p style={{ fontSize: 14, lineHeight: 1.5 }}>{status.message}</p>
            </div>
          )}

          <p className="label">Registros de hoy</p>
          {fetching ? (
            <div style={{ textAlign: 'center', padding: 32 }}><div className="spinner" style={{ borderTopColor: 'var(--coral)', borderColor: 'var(--border)', width: 28, height: 28 }} /></div>
          ) : logs.length === 0 ? (
            <div className="empty-state"><div className="icon">🍽️</div><p>Aún no has registrado nada hoy</p></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
              {logs.map(log => <LogCard key={log.id} log={log} onDelete={() => handleDelete(log.id)} />)}
            </div>
          )}
        </>
      )}

      {tab === 'history' && (
        histLoading ? (
          <div style={{ textAlign: 'center', padding: 48 }}><div className="spinner" style={{ borderTopColor: 'var(--coral)', borderColor: 'var(--border)', width: 28, height: 28 }} /></div>
        ) : history.length === 0 ? (
          <div className="empty-state"><div className="icon">📊</div><p>Aún no hay historial</p></div>
        ) : (
          <>
            <div className="card" style={{ marginBottom: 16 }}>
              <p style={{ fontWeight: 700, marginBottom: 14 }}>Calorías últimos 14 días</p>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={history} barSize={14}>
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(v, name) => [name === 'kcal' ? `${v} kcal` : `${v}g`, name === 'kcal' ? 'Calorías' : name]}
                    contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 2px 12px rgba(0,0,0,0.1)' }}
                  />
                  {history[0]?.target && <ReferenceLine y={history[0].target} stroke="#E05252" strokeDasharray="4 3" />}
                  <Bar dataKey="kcal" fill="var(--coral)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              {history[0]?.target && <p style={{ fontSize: 11, color: '#E05252', marginTop: 6, textAlign: 'right' }}>— meta {history[0].target} kcal</p>}
            </div>

            <div className="card" style={{ marginBottom: 16 }}>
              <p style={{ fontWeight: 700, marginBottom: 14 }}>Macros promedio</p>
              {(() => {
                const avg = (key) => Math.round(history.reduce((s, r) => s + r[key], 0) / history.length);
                return (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                    <MacroBox label="Proteína" value={`${avg('prot')}g`} color="#2D6EA0" />
                    <MacroBox label="Carbos" value={`${avg('carbs')}g`} color="#C99A1E" />
                    <MacroBox label="Grasa" value={`${avg('fat')}g`} color="#8B3A14" />
                  </div>
                );
              })()}
            </div>

            <p className="label" style={{ marginBottom: 10 }}>Detalle por día</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[...history].reverse().map((r, i) => (
                <div key={i} className="card" style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontWeight: 700 }}>{r.date}</span>
                    <span className="pill pill-coral">{r.kcal} kcal</span>
                  </div>
                  <div style={{ display: 'flex', gap: 10, fontSize: 12, color: 'var(--muted)' }}>
                    <span>P <strong>{r.prot}g</strong></span>
                    <span>C <strong>{r.carbs}g</strong></span>
                    <span>G <strong>{r.fat}g</strong></span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )
      )}
    </div>
  );
}

function MacroBox({ label, value, color }) {
  return (
    <div style={{ background: 'var(--bg)', borderRadius: 12, padding: '12px 8px', textAlign: 'center' }}>
      <div style={{ fontWeight: 800, fontSize: 18, color }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{label}</div>
    </div>
  );
}

function LogCard({ log, onDelete }) {
  const [open, setOpen] = useState(false);
  const items = typeof log.parsed_items === 'string' ? JSON.parse(log.parsed_items) : (log.parsed_items || []);
  const mealIcons = { breakfast: '🌅', lunch: '☀️', dinner: '🌙', snack: '🍎' };

  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span>{mealIcons[log.meal_type] || '🍽️'}</span>
            <span style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>{log.input_text}</span>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <span className="pill pill-coral">{log.calories} kcal</span>
            <span className="pill" style={{ background: '#F0F8FF', color: '#2D6EA0' }}>P {log.protein_g}g</span>
            <span className="pill" style={{ background: '#FFF8E8', color: '#8B6914' }}>C {log.carbs_g}g</span>
            <span className="pill" style={{ background: '#FFF0E8', color: '#8B3A14' }}>G {log.fat_g}g</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, marginLeft: 8 }}>
          {items.length > 0 && <button onClick={() => setOpen(!open)} className="btn-ghost" style={{ padding: '4px 8px', fontSize: 12 }}>{open ? '▲' : '▼'}</button>}
          <button onClick={onDelete} className="btn-ghost" style={{ padding: '4px 8px', fontSize: 16, color: '#E05252' }}>×</button>
        </div>
      </div>
      {open && items.length > 0 && (
        <div style={{ marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
          {items.map((item, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '3px 0', color: 'var(--muted)' }}>
              <span>{item.name} <span style={{ color: 'var(--text)' }}>{item.quantity}</span></span>
              <span style={{ fontWeight: 600 }}>{item.calories} kcal</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
