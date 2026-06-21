import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';

export default function FoodLogger() {
  const [logs, setLogs]             = useState([]);
  const [daily, setDaily]           = useState(null);
  const [recommendation, setRec]    = useState('');
  const [input, setInput]           = useState('');
  const [loading, setLoading]       = useState(false);
  const [fetching, setFetching]     = useState(true);

  useEffect(() => { fetchToday(); }, []);

  async function fetchToday() {
    setFetching(true);
    try {
      const d = await api.food.today();
      setLogs(d.logs);
      setDaily(d.daily);
      setRec(d.recommendation);
    } finally {
      setFetching(false);
    }
  }

  async function handleLog(e) {
    e.preventDefault();
    if (!input.trim()) return;
    setLoading(true);
    try {
      const res = await api.food.log(input.trim());
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

      {/* Log input */}
      <form onSubmit={handleLog} style={{ marginBottom: 20 }}>
        <label className="label">¿Qué comiste?</label>
        <div style={{ display: 'flex', gap: 10 }}>
          <input
            className="input"
            placeholder="Ej: 2 huevos revueltos, 1 arepa, café con leche"
            value={input}
            onChange={e => setInput(e.target.value)}
          />
          <button className="btn-primary" type="submit" disabled={loading} style={{ whiteSpace: 'nowrap', padding: '12px 18px' }}>
            {loading ? <span className="spinner" /> : 'Registrar'}
          </button>
        </div>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>La IA calculará las calorías automáticamente</p>
      </form>

      {/* Daily summary */}
      {daily && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 700 }}>{daily.consumed} kcal consumidas</span>
            <span style={{ color: 'var(--muted)', fontSize: 14 }}>Meta: {daily.target}</span>
          </div>
          <div style={{ height: 8, background: 'var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: pct >= 100 ? '#E05252' : 'var(--coral)', borderRadius: 8 }} />
          </div>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6 }}>{daily.remaining} kcal restantes</p>
        </div>
      )}

      {/* AI recommendation */}
      {recommendation && (
        <div style={{ background: 'var(--gold-light)', borderRadius: 14, padding: '14px 16px', marginBottom: 20, borderLeft: '4px solid var(--gold)' }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--gold)', marginBottom: 4 }}>💡 Recomendación</p>
          <p style={{ fontSize: 14, lineHeight: 1.5 }}>{recommendation}</p>
        </div>
      )}

      {/* Log list */}
      <p className="label">Registros de hoy</p>
      {fetching ? (
        <div style={{ textAlign: 'center', padding: 32 }}><div className="spinner" style={{ borderTopColor: 'var(--coral)', borderColor: 'var(--border)', width: 28, height: 28 }} /></div>
      ) : logs.length === 0 ? (
        <div className="empty-state">
          <div className="icon">🍽️</div>
          <p>Aún no has registrado nada hoy</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
          {logs.map(log => (
            <LogCard key={log.id} log={log} onDelete={() => handleDelete(log.id)} />
          ))}
        </div>
      )}
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
          {items.length > 0 && (
            <button onClick={() => setOpen(!open)} className="btn-ghost" style={{ padding: '4px 8px', fontSize: 12 }}>{open ? '▲' : '▼'}</button>
          )}
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
