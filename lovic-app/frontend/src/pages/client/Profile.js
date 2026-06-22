import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';

const GOALS = [
  { key: 'fat_loss',    label: 'Perder grasa',  icon: '🔥' },
  { key: 'muscle_gain', label: 'Ganar músculo', icon: '💪' },
  { key: 'maintenance', label: 'Mantenerme',    icon: '⚖️' },
];

export default function Profile() {
  const { user, setUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [form, setForm] = useState({
    name:           user?.name || '',
    fitness_goal:   user?.fitness_goal || 'maintenance',
    calorie_target: user?.calorie_target || '',
  });

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await api.profile.update(form);
      setUser(u => ({ ...u, ...res.user }));
      setEditing(false);
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  }

  const goalLabel = GOALS.find(g => g.key === user?.fitness_goal)?.label || '—';

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Mi Perfil 👤</h1>
        {!editing && (
          <button className="btn-primary" onClick={() => setEditing(true)} style={{ padding: '10px 18px', fontSize: 14 }}>
            Editar
          </button>
        )}
      </div>

      {/* Avatar */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 28 }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--coral-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, fontWeight: 800, color: 'var(--coral)', marginBottom: 10 }}>
          {user?.name?.charAt(0).toUpperCase()}
        </div>
        <p style={{ fontWeight: 800, fontSize: 18 }}>{user?.name}</p>
        <p style={{ color: 'var(--muted)', fontSize: 13 }}>{user?.email}</p>
      </div>

      {editing ? (
        <div className="card" style={{ marginBottom: 16 }}>
          <p style={{ fontWeight: 700, marginBottom: 16 }}>Editar datos</p>

          <label className="label">Nombre</label>
          <input className="input" value={form.name} onChange={e => set('name', e.target.value)} style={{ marginBottom: 14 }} />

          <label className="label">Objetivo principal</label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            {GOALS.map(g => (
              <button key={g.key} type="button" onClick={() => set('fitness_goal', g.key)} style={{
                flex: 1, padding: '10px 6px', borderRadius: 10, border: 'none', cursor: 'pointer',
                fontWeight: 700, fontSize: 12,
                background: form.fitness_goal === g.key ? 'var(--coral)' : 'var(--card)',
                color: form.fitness_goal === g.key ? '#fff' : 'var(--muted)',
                boxShadow: 'var(--shadow)',
              }}>
                {g.icon}<br />{g.label}
              </button>
            ))}
          </div>

          <label className="label">Meta calórica diaria (kcal)</label>
          <input className="input" type="number" value={form.calorie_target} onChange={e => set('calorie_target', e.target.value)} placeholder="Ej: 1800" style={{ marginBottom: 16 }} />

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn-primary" onClick={handleSave} disabled={saving} style={{ flex: 1, justifyContent: 'center' }}>
              {saving ? <span className="spinner" /> : 'Guardar'}
            </button>
            <button className="btn-ghost" onClick={() => setEditing(false)} style={{ flex: 1, justifyContent: 'center' }}>
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="card">
            <p style={{ fontWeight: 700, marginBottom: 12 }}>🎯 Objetivo y calorías</p>
            <Row label="Objetivo" value={goalLabel} />
            <Row label="Meta calórica" value={user?.calorie_target ? `${user.calorie_target} kcal/día` : '—'} />
          </div>
          <div className="card">
            <p style={{ fontWeight: 700, marginBottom: 12 }}>📧 Cuenta</p>
            <Row label="Email" value={user?.email} />
            <Row label="Rol" value={user?.role === 'client' ? 'Cliente' : 'Entrenador'} />
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }) {
  if (!value) return null;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--border)', fontSize: 14 }}>
      <span style={{ color: 'var(--muted)' }}>{label}</span>
      <span style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );
}
