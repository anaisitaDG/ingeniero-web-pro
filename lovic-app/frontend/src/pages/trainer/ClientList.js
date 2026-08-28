import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import Avatar from '../../components/Avatar';

const GOAL_LABELS = { fat_loss: 'Pérdida de grasa', muscle_gain: 'Ganar músculo', maintenance: 'Mantenimiento', health: 'Salud general' };

function goals(g) {
  try {
    const a = typeof g === 'string' ? JSON.parse(g) : g;
    const arr = Array.isArray(a) ? a : [a];
    return arr.map(k => GOAL_LABELS[k] || k).join(', ');
  } catch { return g; }
}

function statusBadge(last_trained, workouts_this_week) {
  if (!last_trained) return { label: 'Sin actividad', color: '#6b7280', bg: '#f3f4f6' };
  const days = Math.floor((Date.now() - new Date(last_trained)) / 86400000);
  if (days <= 2) return { label: '🟢 Activa', color: '#16a34a', bg: '#dcfce7' };
  if (days <= 6) return { label: '🟡 ' + days + 'd sin entrenar', color: '#ca8a04', bg: '#fef9c3' };
  return { label: '🔴 ' + days + 'd inactiva', color: '#dc2626', bg: '#fee2e2' };
}

function weightDiff(initial, current) {
  if (!initial || !current) return null;
  const diff = Number(current) - Number(initial);
  if (Math.abs(diff) < 0.1) return null;
  return diff;
}

// ── Radar: convierte los datos del cliente en señales de acción ───────────────
function daysAgo(dateStr) { if (!dateStr) return null; return Math.floor((Date.now() - new Date(dateStr)) / 86400000); }
function daysUntil(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr); d.setHours(0, 0, 0, 0);
  const t = new Date(); t.setHours(0, 0, 0, 0);
  return Math.round((d - t) / 86400000);
}
function planEnd(c) {
  if (!c.plan_start || !c.plan_duration) return null;
  const d = new Date(c.plan_start); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + Number(c.plan_duration));
  return d;
}
// Umbrales: plan ≤5d, pago ≤3d, inactividad ≥5d, sin medidas ≥21d, peso estancado <0.4kg
function computeAlerts(c) {
  const a = [];
  const end = planEnd(c);
  if (end) {
    const dl = daysUntil(end);
    if (dl < 0)       a.push({ label: `Plan vencido hace ${-dl}d`, sev: 'red', order: 1 });
    else if (dl <= 5) a.push({ label: dl === 0 ? 'Plan vence hoy' : `Plan vence en ${dl}d`, sev: 'amber', order: 1 });
  }
  const pd = daysUntil(c.next_payment_date);
  if (pd != null) {
    if (pd < 0)       a.push({ label: `Pago atrasado ${-pd}d`, sev: 'red', order: 2 });
    else if (pd <= 3) a.push({ label: pd === 0 ? 'Pago hoy' : `Pago en ${pd}d`, sev: 'amber', order: 2 });
  }
  const st = daysAgo(c.last_trained);
  if (st != null && st >= 5) a.push({ label: `${st}d sin entrenar`, sev: st >= 10 ? 'red' : 'amber', order: 3 });
  if (c.current_weight_kg != null && c.prev_weight_kg != null &&
      Math.abs(Number(c.current_weight_kg) - Number(c.prev_weight_kg)) < 0.4) {
    a.push({ label: 'Peso estancado', sev: 'amber', order: 4 });
  }
  const md = daysAgo(c.last_measurement);
  if (md != null && md >= 21) a.push({ label: `Sin medidas ${md}d`, sev: 'amber', order: 5 });
  return a.sort((x, y) => (x.sev === y.sev ? x.order - y.order : (x.sev === 'red' ? -1 : 1)));
}

function WeightChange({ initial, current }) {
  const diff = weightDiff(initial, current);
  if (diff === null) return null;
  const lost = diff < 0;
  return (
    <span style={{ fontWeight: 700, fontSize: 13, color: lost ? '#16a34a' : '#dc2626' }}>
      {lost ? '▼' : '▲'} {Math.abs(diff).toFixed(1)} kg
    </span>
  );
}

export default function ClientList() {
  const [clients, setClients]           = useState([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState('');
  const [view, setView]                 = useState('cards'); // 'cards' | 'table'
  const [showInvite, setShowInvite]     = useState(false);
  const [inviteName, setInviteName]     = useState('');
  const [inviteEmail, setInviteEmail]   = useState('');
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteDone, setInviteDone]     = useState(false);
  const [sendingSummary, setSendingSummary] = useState(false);
  const [summaryMsg, setSummaryMsg]     = useState('');
  const [loadError, setLoadError]       = useState(false);
  const navigate = useNavigate();

  function loadClients() {
    setLoading(true);
    setLoadError(false);
    api.trainer.clients()
      .then(d => setClients(d.clients))
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadClients(); }, []);

  async function sendTestEmail() {
    setSendingSummary(true);
    try {
      const r = await api.trainer.testEmail();
      setSummaryMsg(`✅ Correo de prueba enviado a ${r.sentTo}`);
    } catch (e) { setSummaryMsg('❌ ' + e.message); }
    finally {
      setSendingSummary(false);
      setTimeout(() => setSummaryMsg(''), 5000);
    }
  }

  async function sendWeeklySummary() {
    setSendingSummary(true);
    try {
      await api.trainer.weeklySummary();
      setSummaryMsg('✅ Resumen enviado a todos los clientes activos');
    } catch (e) { setSummaryMsg('❌ ' + e.message); }
    finally {
      setSendingSummary(false);
      setTimeout(() => setSummaryMsg(''), 4000);
    }
  }

  async function sendInvite() {
    if (!inviteName.trim() || !inviteEmail.trim()) return;
    setInviteSending(true);
    try {
      await api.trainer.inviteNew(inviteEmail.trim(), inviteName.trim());
      setInviteDone(true);
      setInviteName(''); setInviteEmail('');
      setTimeout(() => { setInviteDone(false); setShowInvite(false); }, 3000);
      api.trainer.clients().then(d => setClients(d.clients)).catch(console.error);
    } catch (e) { alert(e.message); }
    finally { setInviteSending(false); }
  }

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: summaryMsg ? 10 : 20 }}>
        <div>
          <h1 className="page-title">Clientes 👥</h1>
          <p style={{ color: 'var(--muted)', fontSize: 14 }}>{clients.length} en total</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button onClick={sendTestEmail} disabled={sendingSummary} className="btn-ghost" title="Enviarte un correo de muestra" style={{ fontSize: 13, padding: '10px 14px', border: '1.5px solid var(--border)' }}>
            ✉️ Prueba
          </button>
          <button onClick={sendWeeklySummary} disabled={sendingSummary} className="btn-ghost" style={{ fontSize: 13, padding: '10px 14px', border: '1.5px solid var(--border)' }}>
            {sendingSummary ? <span className="spinner" /> : '📧 Resumen semanal'}
          </button>
          <button onClick={() => setShowInvite(v => !v)} className="btn-primary">
            + Enviar valoración
          </button>
        </div>
      </div>
      {summaryMsg && (
        <div style={{ marginBottom: 16, padding: '10px 16px', borderRadius: 12, background: summaryMsg.startsWith('✅') ? '#dcfce7' : '#fee2e2', color: summaryMsg.startsWith('✅') ? '#15803d' : '#dc2626', fontWeight: 700, fontSize: 14 }}>
          {summaryMsg}
        </div>
      )}

      {/* Radar: quién necesita acción esta semana */}
      {!loading && clients.length > 0 && (() => {
        const flagged = clients.map(c => ({ c, alerts: computeAlerts(c) })).filter(x => x.alerts.length);
        flagged.sort((a, b) => (a.alerts.some(x => x.sev === 'red') ? 0 : 1) - (b.alerts.some(x => x.sev === 'red') ? 0 : 1));
        if (flagged.length === 0) {
          return (
            <div className="card" style={{ marginBottom: 20, padding: '12px 16px', background: '#dcfce7', border: 'none' }}>
              <span style={{ fontWeight: 700, color: '#15803d', fontSize: 14 }}>✅ Todo al día — nadie necesita acción urgente</span>
            </div>
          );
        }
        return (
          <div className="card" style={{ marginBottom: 20, padding: 16, borderLeft: '4px solid var(--coral)' }}>
            <p style={{ fontWeight: 800, fontSize: 15, marginBottom: 6 }}>⚠️ Necesitan tu atención ({flagged.length})</p>
            {flagged.map(({ c, alerts }, i) => (
              <div key={c.id} onClick={() => navigate(`/trainer/clients/${c.id}`)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderTop: i ? '1px solid var(--border)' : 'none', cursor: 'pointer' }}>
                <span style={{ fontWeight: 700, fontSize: 14, flexShrink: 0 }}>{c.name}</span>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flex: 1, justifyContent: 'flex-end' }}>
                  {alerts.map((a, j) => (
                    <span key={j} style={{ fontSize: 11.5, fontWeight: 700, padding: '3px 9px', borderRadius: 20,
                      background: a.sev === 'red' ? '#fee2e2' : '#fef9c3', color: a.sev === 'red' ? '#dc2626' : '#ca8a04' }}>{a.label}</span>
                  ))}
                </div>
                <span style={{ color: 'var(--muted)', fontSize: 16, flexShrink: 0 }}>›</span>
              </div>
            ))}
          </div>
        );
      })()}

      {/* Invite form */}
      {showInvite && (
        <div className="card" style={{ marginBottom: 20, background: 'var(--coral-light)', border: '1.5px solid var(--coral)' }}>
          <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 14, color: 'var(--coral)' }}>📋 Enviar valoración a cliente nuevo</p>
          {inviteDone ? (
            <p style={{ color: '#065f46', fontWeight: 700, textAlign: 'center', padding: '12px 0' }}>✅ ¡Valoración enviada!</p>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                <input className="input" placeholder="Nombre" value={inviteName} onChange={e => setInviteName(e.target.value)} style={{ flex: 1 }} />
                <input className="input" placeholder="Email" type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} style={{ flex: 1 }} />
              </div>
              <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>Se creará su perfil y recibirá un correo para completar el onboarding.</p>
              <button className="btn-primary" onClick={sendInvite} disabled={inviteSending || !inviteName || !inviteEmail} style={{ width: '100%', justifyContent: 'center' }}>
                {inviteSending ? '⏳ Enviando…' : '📧 Enviar valoración'}
              </button>
            </>
          )}
        </div>
      )}

      {/* Search + view toggle */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center' }}>
        <input className="input" placeholder="Buscar por nombre o email..." value={search}
          onChange={e => setSearch(e.target.value)} style={{ flex: 1, margin: 0 }} />
        <div style={{ display: 'flex', background: 'var(--card)', borderRadius: 10, padding: 3, gap: 2, boxShadow: 'var(--shadow)', flexShrink: 0 }}>
          {[{ v: 'cards', icon: '⊞' }, { v: 'table', icon: '☰' }].map(({ v, icon }) => (
            <button key={v} onClick={() => setView(v)} style={{
              padding: '7px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 16,
              background: view === v ? 'var(--coral)' : 'transparent',
              color: view === v ? '#fff' : 'var(--muted)',
            }}>{icon}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}><div className="spinner" style={{ borderTopColor: 'var(--coral)', borderColor: 'var(--border)', width: 28, height: 28 }} /></div>
      ) : loadError ? (
        <div className="empty-state"><div className="icon">📡</div><p>No se pudo cargar la lista. Revisa tu conexión.</p><button className="btn-primary" style={{ marginTop: 16 }} onClick={loadClients}>Reintentar</button></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state"><div className="icon">👥</div><p>No hay clientes todavía</p></div>
      ) : view === 'cards' ? (
        <CardView clients={filtered} navigate={navigate} />
      ) : (
        <TableView clients={filtered} navigate={navigate} />
      )}
    </div>
  );
}

function CardView({ clients, navigate }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {clients.map(c => {
        const badge = statusBadge(c.last_trained, c.workouts_this_week);
        const diff = weightDiff(c.initial_weight_kg, c.current_weight_kg);
        return (
          <div key={c.id} className="card" onClick={() => navigate(`/trainer/clients/${c.id}`)}
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', transition: 'box-shadow 0.2s' }}
            onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.12)'}
            onMouseLeave={e => e.currentTarget.style.boxShadow = 'var(--shadow)'}
          >
            {/* Avatar */}
            <Avatar user={c} size={46} />

            {/* Main info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontWeight: 700, marginBottom: 2 }}>
                {c.name}
                {(() => {
                  const dFood = c.last_food_log ? Math.floor((Date.now() - new Date(c.last_food_log)) / 86400000) : null;
                  if (dFood == null || dFood >= 3) return <span style={{ fontSize: 10.5, fontWeight: 700, marginLeft: 8, padding: '2px 7px', borderRadius: 6, background: '#fef3c7', color: '#b45309' }}>🍽️ {dFood == null ? 'sin registrar' : `${dFood}d sin registrar`}</span>;
                  return null;
                })()}
              </p>
              <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 4 }}>{c.email}</p>
              {c.main_goal && <p style={{ fontSize: 12, color: 'var(--gold)', fontWeight: 600 }}>{goals(c.main_goal)}</p>}
            </div>

            {/* Stats */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
              <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 99, background: badge.bg, color: badge.color }}>
                {badge.label}
              </span>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                {c.workouts_this_week > 0 && (
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>💪 {c.workouts_this_week} esta semana</span>
                )}
                {diff !== null && <WeightChange initial={c.initial_weight_kg} current={c.current_weight_kg} />}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TableView({ clients, navigate }) {
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)' }}>
              {['Cliente', 'Objetivo', 'Estado', 'Esta semana', 'Cambio de peso', 'Último entreno'].map(h => (
                <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{h.toUpperCase()}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {clients.map(c => {
              const badge = statusBadge(c.last_trained, c.workouts_this_week);
              const lastTrainedStr = c.last_trained
                ? new Date(c.last_trained).toLocaleDateString('es', { day: 'numeric', month: 'short' })
                : '—';
              return (
                <tr key={c.id} onClick={() => navigate(`/trainer/clients/${c.id}`)}
                  style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Avatar user={c} size={32} />
                      <div>
                        <p style={{ fontWeight: 700 }}>{c.name}</p>
                        <p style={{ fontSize: 11, color: 'var(--muted)' }}>{c.email}</p>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--gold)', fontWeight: 600, fontSize: 12 }}>
                    {c.main_goal ? goals(c.main_goal) : '—'}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 99, background: badge.bg, color: badge.color, whiteSpace: 'nowrap' }}>
                      {badge.label}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700 }}>
                    {c.workouts_this_week > 0 ? `${c.workouts_this_week} entrenos` : <span style={{ color: 'var(--muted)' }}>—</span>}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <WeightChange initial={c.initial_weight_kg} current={c.current_weight_kg} />
                    {weightDiff(c.initial_weight_kg, c.current_weight_kg) === null && <span style={{ color: 'var(--muted)' }}>—</span>}
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                    {lastTrainedStr}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
