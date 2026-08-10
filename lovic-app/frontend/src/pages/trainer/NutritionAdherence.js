import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';

const MEAL_ICON = { breakfast: '🌅', lunch: '☀️', dinner: '🌙', snack: '🍎' };

function fmtDay(d) {
  const [y, m, dd] = d.split('-').map(Number);
  return new Date(y, m - 1, dd).toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' });
}

export default function NutritionAdherence({ clientId }) {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen]     = useState(null);

  useEffect(() => {
    setLoading(true);
    api.trainer.getNutritionAdherence(clientId)
      .then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  }, [clientId]);

  if (loading) return <div style={{ textAlign: 'center', padding: 40 }}><div className="spinner" style={{ borderTopColor: 'var(--coral)', borderColor: 'var(--border)', width: 28, height: 28 }} /></div>;
  if (!data) return <div className="empty-state"><div className="icon">📊</div><p>No se pudo cargar la nutrición.</p></div>;

  const { last7, calorieTarget, proteinTarget, daysSinceLog, recentDays } = data;
  const noData = last7.daysLogged === 0 && (!recentDays || recentDays.length === 0);

  return (
    <div>
      {/* Alerta si dejó de registrar */}
      {daysSinceLog != null && daysSinceLog >= 3 && (
        <div style={{ background: '#fef3c7', border: '1.5px solid #fcd34d', borderRadius: 12, padding: '12px 14px', marginBottom: 14 }}>
          <p style={{ fontWeight: 700, fontSize: 13.5, color: '#b45309' }}>⚠️ No registra comidas hace {daysSinceLog} días</p>
        </div>
      )}
      {noData && (
        <div className="empty-state"><div className="icon">🍽️</div><p>Esta clienta aún no ha registrado comidas.</p></div>
      )}

      {!noData && (
        <>
          {/* Resumen 7 días */}
          <div className="card" style={{ marginBottom: 14, padding: '14px 16px' }}>
            <p style={{ fontWeight: 800, fontSize: 15, marginBottom: 12 }}>📊 Últimos 7 días</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
              <Stat label="Días en meta" value={`${last7.daysInTarget} / ${last7.daysLogged}`} sub="registrados" />
              <Stat label="Cal. promedio" value={last7.avgCalories != null ? `${last7.avgCalories}` : '—'} sub={`meta ${calorieTarget}`} />
              {proteinTarget && <Stat label="Proteína prom." value={last7.avgProtein != null ? `${last7.avgProtein}g` : '—'} sub={`meta ${proteinTarget}g`} />}
              {proteinTarget && <Stat label="Días proteína ✓" value={`${last7.proteinDaysMet} / ${last7.daysLogged}`} sub="cumplida" />}
            </div>
          </div>

          {/* Qué comió, por día */}
          <p className="label" style={{ marginBottom: 8 }}>🍽️ Qué comió (últimos 14 días)</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {recentDays.map(day => {
              const isOpen = open === day.date;
              return (
                <div key={day.date} className="card" style={{ padding: '12px 15px', borderLeft: `4px solid ${day.inTarget ? '#16a34a' : '#C99A1E'}` }}>
                  <div onClick={() => setOpen(isOpen ? null : day.date)} style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, fontSize: 13.5 }}>
                      <span style={{ color: 'var(--muted)', marginRight: 6, fontSize: 12 }}>{isOpen ? '▲' : '▼'}</span>
                      {fmtDay(day.date)}
                    </span>
                    <span style={{ fontWeight: 800, color: day.inTarget ? '#16a34a' : 'var(--coral)' }}>{day.calories} kcal</span>
                  </div>
                  {isOpen && (
                    <div style={{ marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 7 }}>
                      {day.items.map(it => {
                        let parsed = [];
                        try { parsed = typeof it.parsed_items === 'string' ? JSON.parse(it.parsed_items) : (it.parsed_items || []); } catch { parsed = []; }
                        const name = it.input_text?.startsWith('plan:') ? (parsed[0]?.name || 'Comida del plan') : it.input_text;
                        return (
                          <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13 }}>
                            <span style={{ flex: 1 }}>{MEAL_ICON[it.meal_type] || '🍽️'} {name}</span>
                            <span style={{ color: 'var(--muted)', fontWeight: 600, flexShrink: 0 }}>{Math.round(it.calories)} kcal</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, sub }) {
  return (
    <div style={{ background: 'var(--bg)', borderRadius: 12, padding: '10px 12px' }}>
      <p style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: .3 }}>{label}</p>
      <p style={{ fontSize: 19, fontWeight: 900 }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: 'var(--muted)' }}>{sub}</p>}
    </div>
  );
}
