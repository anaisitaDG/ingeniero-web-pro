import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';

function fmt(amount) {
  if (!amount) return '—';
  return '$ ' + Number(amount).toLocaleString('es-CO');
}

export default function BillingPanel() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.trainer.getBilling()
      .then(res => setClients(res.clients || []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ textAlign: 'center', padding: 64 }}><div className="spinner" style={{ borderTopColor: 'var(--coral)', borderColor: 'var(--border)', width: 36, height: 36 }} /></div>;

  const totalMonthly = clients.reduce((s, c) => s + (Number(c.monthly_fee) || 0), 0);
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = clients
    .filter(c => c.next_payment_date && String(c.next_payment_date).slice(0, 10) >= today)
    .sort((a, b) => (a.next_payment_date < b.next_payment_date ? -1 : 1));

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 20 }}>
        <h1 className="page-title">💰 Panel de ingresos</h1>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14, marginBottom: 24 }}>
        <div className="card" style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, marginBottom: 6 }}>INGRESO MENSUAL</p>
          <p style={{ fontSize: 24, fontWeight: 800, color: 'var(--coral)' }}>$ {totalMonthly.toLocaleString('es-CO')}</p>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, marginBottom: 6 }}>CLIENTAS</p>
          <p style={{ fontSize: 24, fontWeight: 800 }}>{clients.length}</p>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, marginBottom: 6 }}>PRÓXIMOS PAGOS</p>
          <p style={{ fontSize: 24, fontWeight: 800, color: 'var(--gold)' }}>{upcoming.length}</p>
        </div>
      </div>

      {/* Upcoming payments */}
      {upcoming.length > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <p style={{ fontWeight: 700, marginBottom: 12 }}>⏰ Próximos pagos</p>
          {upcoming.slice(0, 6).map(c => {
            const date = new Date(String(c.next_payment_date).slice(0, 10) + 'T00:00:00');
            const daysLeft = Math.ceil((date - new Date()) / 86400000);
            return (
              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontWeight: 600 }}>{c.name}</span>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: 'var(--muted)' }}>{date.toLocaleDateString('es', { day: 'numeric', month: 'short' })}</span>
                  <span style={{
                    fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 99,
                    background: daysLeft <= 3 ? '#fee2e2' : daysLeft <= 7 ? '#fef9c3' : '#dcfce7',
                    color: daysLeft <= 3 ? '#dc2626' : daysLeft <= 7 ? '#ca8a04' : '#16a34a',
                  }}>{daysLeft === 0 ? 'Hoy' : daysLeft === 1 ? 'Mañana' : `En ${daysLeft} días`}</span>
                  {c.monthly_fee > 0 && <span style={{ fontWeight: 800, color: 'var(--coral)' }}>{fmt(c.monthly_fee)}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Client list — read only, click to edit */}
      <div className="card">
        <p style={{ fontWeight: 700, marginBottom: 4 }}>Todas las clientas</p>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14 }}>Para editar la cuota, entra al perfil de la clienta → tab 💰 Facturación</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {clients.map(c => {
            const planEnd = c.start_date && c.duration_days
              ? (() => { const d = new Date(String(c.start_date).slice(0, 10) + 'T00:00:00'); d.setDate(d.getDate() + Number(c.duration_days)); return d; })()
              : null;
            const planDaysLeft = planEnd ? Math.ceil((planEnd - new Date()) / 86400000) : null;

            return (
              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border)', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 700 }}>{c.name}</p>
                  {planEnd && (
                    <p style={{ fontSize: 12, marginTop: 3, color: planDaysLeft <= 0 ? '#dc2626' : planDaysLeft <= 7 ? '#ca8a04' : 'var(--muted)' }}>
                      {planDaysLeft <= 0 ? '⚠️ Plan vencido' : planDaysLeft <= 7 ? `⚠️ Vence en ${planDaysLeft} días` : `Plan hasta ${planEnd.toLocaleDateString('es', { day: 'numeric', month: 'short' })}`}
                    </p>
                  )}
                  {c.notes && <p style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic', marginTop: 2 }}>{c.notes}</p>}
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexShrink: 0 }}>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontWeight: 800, color: 'var(--coral)', fontSize: 15 }}>{fmt(c.monthly_fee)}<span style={{ fontWeight: 400, fontSize: 12, color: 'var(--muted)' }}>/mes</span></p>
                    {c.next_payment_date && <p style={{ fontSize: 12, color: 'var(--muted)' }}>Pago: {new Date(String(c.next_payment_date).slice(0, 10) + 'T00:00:00').toLocaleDateString('es', { day: 'numeric', month: 'short' })}</p>}
                  </div>
                  <button className="btn-ghost" onClick={() => navigate(`/trainer/clients/${c.id}`)} style={{ fontSize: 13, padding: '6px 12px' }}>Ver →</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
