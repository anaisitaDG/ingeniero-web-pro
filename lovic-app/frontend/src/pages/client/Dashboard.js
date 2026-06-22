import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { LineChart, Line, XAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [tracking, setTracking] = useState({ workout_done: false, diet_followed: false, water_glasses: 0 });

  useEffect(() => {
    api.dashboard.get()
      .then(d => {
        setData(d);
        setTracking({
          workout_done:  !!d.tracking?.workout_done,
          diet_followed: !!d.tracking?.diet_followed,
          water_glasses: d.tracking?.water_glasses || 0,
        });
      })
      .finally(() => setLoading(false));
  }, []);

  async function saveTracking(update) {
    const next = { ...tracking, ...update };
    setTracking(next);
    setSaving(true);
    try { await api.dashboard.postTracking(next); }
    finally { setSaving(false); }
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 48 }}><div className="spinner" style={{ borderTopColor: 'var(--coral)', borderColor: 'var(--border)', width: 32, height: 32 }} /></div>;

  const { calories, macros, bio, weight_history, adherence, routine, streak } = data || {};
  const pct = calories ? Math.min(Math.round((calories.consumed / calories.target) * 100), 100) : 0;

  const weightData = (weight_history || []).map(w => ({
    date: new Date(w.logged_at).toLocaleDateString('es', { month: 'short', day: 'numeric' }),
    peso: w.weight_kg,
  })).reverse();

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <p style={{ color: 'var(--muted)', fontSize: 14 }}>{new Date().toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 style={{ fontSize: 24, fontWeight: 800 }}>Hola, {user?.name?.split(' ')[0]} 👋</h1>
          {streak > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--gold-light)', borderRadius: 20, padding: '6px 12px' }}>
              <span style={{ fontSize: 18 }}>🔥</span>
              <span style={{ fontWeight: 800, fontSize: 15, color: '#C99A1E' }}>{streak} días</span>
            </div>
          )}
        </div>
      </div>

      {/* Calories + macros */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div>
            <p className="label">Calorías de hoy</p>
            <p style={{ fontSize: 28, fontWeight: 800 }}>{calories?.consumed} <span style={{ fontSize: 16, fontWeight: 400, color: 'var(--muted)' }}>/ {calories?.target} kcal</span></p>
          </div>
          <Link to="/food" className="btn-primary" style={{ padding: '8px 16px', fontSize: 13 }}>+ Agregar</Link>
        </div>
        <div style={{ height: 8, background: 'var(--border)', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: pct >= 100 ? '#E05252' : 'var(--coral)', borderRadius: 8, transition: 'width 0.5s' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, marginBottom: 12 }}>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>{pct}% consumido</span>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>{calories?.remaining} restantes</span>
        </div>
        {macros && (macros.protein > 0 || macros.carbs > 0 || macros.fat > 0) && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <MacroBar label="Proteína" value={macros.protein} color="#2D6EA0" />
            <MacroBar label="Carbos" value={macros.carbs} color="#C99A1E" />
            <MacroBar label="Grasa" value={macros.fat} color="#8B3A14" />
          </div>
        )}
      </div>

      {/* Daily tracking */}
      <div className="card" style={{ marginBottom: 16 }}>
        <p className="label" style={{ marginBottom: 12 }}>Seguimiento de hoy {saving && <span style={{ color: 'var(--muted)', fontWeight: 400 }}>guardando…</span>}</p>
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <TrackToggle label="Entrenamiento" icon="💪" active={tracking.workout_done} onChange={v => saveTracking({ workout_done: v })} />
          <TrackToggle label="Dieta" icon="🥗" active={tracking.diet_followed} onChange={v => saveTracking({ diet_followed: v })} />
        </div>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8, fontWeight: 600 }}>💧 Agua — {tracking.water_glasses}/8 vasos</p>
        <div style={{ display: 'flex', gap: 6 }}>
          {Array.from({ length: 8 }, (_, i) => (
            <button key={i} onClick={() => saveTracking({ water_glasses: tracking.water_glasses === i + 1 ? i : i + 1 })} style={{
              flex: 1, height: 32, borderRadius: 8, border: 'none', cursor: 'pointer',
              background: i < tracking.water_glasses ? '#4A90D9' : 'var(--border)',
              transition: 'background 0.15s',
            }} />
          ))}
        </div>
      </div>

      {/* Routine preview */}
      {routine && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <p className="label">Tu rutina 💪</p>
            <Link to="/plan" style={{ fontSize: 12, color: 'var(--coral)', fontWeight: 700, textDecoration: 'none' }}>Ver completa →</Link>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
            {routine.content.slice(0, 220)}{routine.content.length > 220 ? '…' : ''}
          </p>
        </div>
      )}

      {/* Weight chart */}
      {weightData.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <p className="label" style={{ marginBottom: 12 }}>Progreso de peso</p>
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={weightData}>
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
              <Tooltip formatter={v => [`${v} kg`, 'Peso']} contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 2px 12px rgba(0,0,0,0.1)' }} />
              <Line type="monotone" dataKey="peso" stroke="#FF6B6B" strokeWidth={2.5} dot={{ r: 3, fill: '#FF6B6B' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Bio stats */}
      {bio && (
        <div className="card" style={{ marginBottom: 16 }}>
          <p className="label" style={{ marginBottom: 12 }}>Última bioimpedancia</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {bio.body_fat_pct != null && <StatBox label="Grasa corporal" value={`${bio.body_fat_pct}%`} icon="📊" />}
            {bio.muscle_mass_kg != null && <StatBox label="Masa muscular" value={`${bio.muscle_mass_kg} kg`} icon="💪" />}
            {bio.visceral_fat != null && <StatBox label="Grasa visceral" value={bio.visceral_fat} icon="🫀" />}
            {bio.bmr_kcal != null && <StatBox label="Metabolismo" value={`${bio.bmr_kcal} kcal`} icon="🔥" />}
          </div>
        </div>
      )}

      {/* Adherence */}
      {adherence && adherence.total_days > 0 && (
        <div className="card">
          <p className="label" style={{ marginBottom: 12 }}>Adherencia (últimos 30 días)</p>
          <div style={{ display: 'flex', gap: 12 }}>
            <AdherenceBar label="Entrenamientos" done={adherence.workout_days} total={adherence.total_days} color="var(--coral)" />
            <AdherenceBar label="Dieta" done={adherence.diet_days} total={adherence.total_days} color="var(--gold)" />
          </div>
        </div>
      )}
    </div>
  );
}

function MacroBar({ label, value, color }) {
  return (
    <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '8px 10px', textAlign: 'center' }}>
      <div style={{ fontWeight: 800, fontSize: 16, color }}>{value}g</div>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{label}</div>
    </div>
  );
}

function TrackToggle({ label, icon, active, onChange }) {
  return (
    <button onClick={() => onChange(!active)} style={{
      flex: 1, padding: '14px', borderRadius: 14, border: `2px solid ${active ? 'var(--coral)' : 'var(--border)'}`,
      background: active ? 'var(--coral-light)' : 'transparent', cursor: 'pointer',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, transition: 'all 0.2s',
    }}>
      <span style={{ fontSize: 24 }}>{icon}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: active ? 'var(--coral)' : 'var(--muted)' }}>{label}</span>
      <span style={{ fontSize: 11, color: active ? 'var(--coral)' : 'var(--muted)', fontWeight: 600 }}>{active ? '✓ Hecho' : 'Pendiente'}</span>
    </button>
  );
}

function StatBox({ label, value, icon }) {
  return (
    <div style={{ background: 'var(--bg)', borderRadius: 12, padding: '12px', textAlign: 'center' }}>
      <div style={{ fontSize: 20, marginBottom: 4 }}>{icon}</div>
      <div style={{ fontWeight: 800, fontSize: 18 }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{label}</div>
    </div>
  );
}

function AdherenceBar({ label, done, total, color }) {
  const pct = Math.round((done / total) * 100);
  return (
    <div style={{ flex: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color }}>{pct}%</span>
      </div>
      <div style={{ height: 8, background: 'var(--border)', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 8 }} />
      </div>
      <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{done}/{total} días</p>
    </div>
  );
}
