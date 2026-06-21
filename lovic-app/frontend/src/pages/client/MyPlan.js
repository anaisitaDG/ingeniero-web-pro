import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';

export default function MyPlan() {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]       = useState('routine');

  useEffect(() => {
    api.dashboard.get()
      .then(d => setData(d))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ textAlign: 'center', padding: 48 }}><div className="spinner" style={{ borderTopColor: 'var(--coral)', borderColor: 'var(--border)', width: 28, height: 28 }} /></div>;

  const { routine, nutrition_plan } = data || {};

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Mi Plan 💪</h1>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, background: 'var(--border)', padding: 4, borderRadius: 12 }}>
        {[{ key: 'routine', label: '💪 Rutina' }, { key: 'nutrition', label: '🥗 Nutrición' }].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            flex: 1, padding: '10px', borderRadius: 10, fontWeight: 700, fontSize: 14, border: 'none',
            background: tab === t.key ? 'var(--card)' : 'transparent',
            color: tab === t.key ? 'var(--coral)' : 'var(--muted)',
            boxShadow: tab === t.key ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
            cursor: 'pointer', transition: 'all 0.2s',
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'routine' && (
        routine ? (
          <div className="card">
            <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 14, lineHeight: 1.7 }}>{routine.content}</pre>
            <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 12 }}>Actualizado: {new Date(routine.created_at).toLocaleDateString('es')}</p>
          </div>
        ) : (
          <div className="empty-state">
            <div className="icon">💪</div>
            <p>Tu entrenadora aún no ha asignado una rutina.<br />¡Pronto la tendrás!</p>
          </div>
        )
      )}

      {tab === 'nutrition' && (
        nutrition_plan ? (
          <div className="card">
            <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 14, lineHeight: 1.7 }}>{nutrition_plan.content}</pre>
            <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 12 }}>Actualizado: {new Date(nutrition_plan.created_at).toLocaleDateString('es')}</p>
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
