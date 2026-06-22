import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';

export default function ClientList() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    api.trainer.clients()
      .then(d => setClients(d.clients))
      .finally(() => setLoading(false));
  }, []);

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase())
  );

  const GOAL_LABELS = { fat_loss: 'Pérdida de grasa', muscle_gain: 'Ganar músculo', maintenance: 'Mantenimiento', health: 'Salud general' };
  const goals = (g) => {
    try {
      const a = typeof g === 'string' ? JSON.parse(g) : g;
      const arr = Array.isArray(a) ? a : [a];
      return arr.map(k => GOAL_LABELS[k] || k).join(', ');
    } catch { return g; }
  };

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div>
          <h1 className="page-title">Clientes 👥</h1>
          <p style={{ color: 'var(--muted)', fontSize: 14 }}>{clients.length} en total</p>
        </div>
      </div>

      <input
        className="input"
        placeholder="Buscar por nombre o email..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ marginBottom: 20 }}
      />

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}><div className="spinner" style={{ borderTopColor: 'var(--coral)', borderColor: 'var(--border)', width: 28, height: 28 }} /></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state"><div className="icon">👥</div><p>No hay clientes todavía</p></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(c => (
            <div key={c.id} className="card" onClick={() => navigate(`/trainer/clients/${c.id}`)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', transition: 'box-shadow 0.2s' }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.12)'}
              onMouseLeave={e => e.currentTarget.style.boxShadow = 'var(--shadow)'}
            >
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--coral-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, color: 'var(--coral)', flexShrink: 0 }}>
                {c.name.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 700, marginBottom: 2 }}>{c.name}</p>
                <p style={{ fontSize: 13, color: 'var(--muted)' }}>{c.email}</p>
                {c.main_goal && <p style={{ fontSize: 12, color: 'var(--gold)', fontWeight: 600, marginTop: 2 }}>{goals(c.main_goal)}</p>}
              </div>
              <div style={{ textAlign: 'right' }}>
                {c.weight_kg && <p style={{ fontWeight: 700, fontSize: 15 }}>{c.weight_kg} kg</p>}
                <p style={{ fontSize: 11, color: 'var(--muted)' }}>{new Date(c.created_at).toLocaleDateString('es')}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
