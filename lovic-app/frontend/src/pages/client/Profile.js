import React, { useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import Avatar from '../../components/Avatar';

function SetPasswordCard() {
  const [pw, setPw]       = useState('');
  const [pw2, setPw2]     = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg]     = useState('');

  async function handleSave(e) {
    e.preventDefault();
    if (pw !== pw2) { setMsg('Las contraseñas no coinciden'); return; }
    if (pw.length < 6) { setMsg('Mínimo 6 caracteres'); return; }
    setSaving(true);
    try {
      const res = await api.auth.setPassword(pw);
      if (res.error) throw new Error(res.error);
      setMsg('✅ Contraseña guardada');
      setPw(''); setPw2('');
    } catch (e) { setMsg(e.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="card">
      <p style={{ fontWeight: 700, marginBottom: 12 }}>🔑 Contraseña</p>
      <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14 }}>
        Establece una contraseña para entrar sin necesitar el link del correo.
      </p>
      <form onSubmit={handleSave}>
        <input className="input" type="password" placeholder="Nueva contraseña" value={pw}
          onChange={e => setPw(e.target.value)} style={{ marginBottom: 10 }} />
        <input className="input" type="password" placeholder="Repite la contraseña" value={pw2}
          onChange={e => setPw2(e.target.value)} style={{ marginBottom: 12 }} />
        {msg && <p style={{ fontSize: 13, marginBottom: 10, color: msg.startsWith('✅') ? 'var(--green)' : 'var(--coral)' }}>{msg}</p>}
        <button className="btn-primary" type="submit" disabled={saving} style={{ width: '100%', justifyContent: 'center', fontSize: 14 }}>
          {saving ? <span className="spinner" /> : 'Guardar contraseña'}
        </button>
      </form>
    </div>
  );
}

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
    name:         user?.name || '',
    fitness_goal: user?.fitness_goal || 'maintenance',
  });

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  const fileRef = useRef(null);
  const [avatarBusy, setAvatarBusy] = useState(false);

  async function handleAvatarPick(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarBusy(true);
    try {
      const fd = new FormData();
      fd.append('avatar', file);
      const res = await api.profile.uploadAvatar(fd);
      if (res.error) throw new Error(res.error);
      setUser(u => ({ ...u, avatar_url: res.avatar_url }));
    } catch (err) {
      alert(err.message || 'No se pudo subir la foto');
    } finally {
      setAvatarBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function handleAvatarRemove() {
    if (!window.confirm('¿Quitar tu foto de perfil?')) return;
    setAvatarBusy(true);
    try {
      await api.profile.removeAvatar();
      setUser(u => ({ ...u, avatar_url: null }));
    } catch (err) {
      alert(err.message || 'No se pudo quitar la foto');
    } finally {
      setAvatarBusy(false);
    }
  }

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
        <div style={{ position: 'relative', marginBottom: 10 }}>
          <Avatar user={user} size={88} style={{ opacity: avatarBusy ? 0.5 : 1 }} />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={avatarBusy}
            aria-label="Cambiar foto"
            style={{
              position: 'absolute', bottom: 0, right: 0, width: 30, height: 30, borderRadius: '50%',
              background: 'var(--coral)', color: '#fff', border: '2px solid var(--card)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, padding: 0,
            }}
          >📷</button>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarPick} />
        </div>
        <p style={{ fontWeight: 800, fontSize: 18 }}>{user?.name}</p>
        <p style={{ color: 'var(--muted)', fontSize: 13 }}>{user?.email}</p>
        <div style={{ display: 'flex', gap: 14, marginTop: 8 }}>
          <button onClick={() => fileRef.current?.click()} disabled={avatarBusy}
            style={{ background: 'none', border: 'none', color: 'var(--coral)', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
            {avatarBusy ? 'Subiendo…' : 'Cambiar foto'}
          </button>
          {user?.avatar_url && (
            <button onClick={handleAvatarRemove} disabled={avatarBusy}
              style={{ background: 'none', border: 'none', color: 'var(--muted)', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
              Quitar
            </button>
          )}
        </div>
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

          <div style={{ background: 'var(--surface)', borderRadius: 10, padding: '10px 12px', marginBottom: 16 }}>
            <p style={{ fontSize: 12, color: 'var(--muted)' }}>
              🎯 Tu meta calórica ({user?.calorie_target ? `${user.calorie_target} kcal/día` : '—'}) la define tu entrenadora. Si quieres cambiarla, coméntaselo a Lorena.
            </p>
          </div>

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
          <SetPasswordCard />
          <NotificationsCard />
        </div>
      )}
    </div>
  );
}

function NotificationsCard() {
  const { supported, permission, subscribed, loading, subscribe, unsubscribe } = usePushNotifications();
  const [testMsg, setTestMsg] = useState('');
  const [testing, setTesting] = useState(false);

  async function sendTest() {
    setTesting(true);
    setTestMsg('');
    try {
      const r = await api.push.test();
      setTestMsg(r.sent > 0 ? '✅ Enviada — revisa tu pantalla en unos segundos' : '⚠️ No se pudo entregar. Reactiva las notificaciones.');
    } catch (e) {
      setTestMsg('❌ ' + e.message);
    } finally {
      setTesting(false);
      setTimeout(() => setTestMsg(''), 6000);
    }
  }

  if (!supported) return (
    <div className="card">
      <p style={{ fontWeight: 700, marginBottom: 8 }}>🔔 Notificaciones</p>
      <p style={{ fontSize: 13, color: 'var(--muted)' }}>Abre la app desde el ícono en tu pantalla de inicio para activar notificaciones.</p>
    </div>
  );

  return (
    <div className="card">
      <p style={{ fontWeight: 700, marginBottom: 8 }}>🔔 Notificaciones</p>
      {permission === 'denied' ? (
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>
          Tienes las notificaciones bloqueadas. Ve a <strong>Ajustes → Notificaciones → Lovic</strong> y actívalas.
        </p>
      ) : subscribed ? (
        <>
          <p style={{ fontSize: 13, color: 'var(--green)', marginBottom: 12 }}>✅ Notificaciones activas</p>
          <button className="btn-primary" onClick={sendTest} disabled={testing} style={{ width: '100%', justifyContent: 'center', fontSize: 14, marginBottom: 10 }}>
            {testing ? <span className="spinner" /> : '🧪 Enviar notificación de prueba'}
          </button>
          {testMsg && <p style={{ fontSize: 13, textAlign: 'center', marginBottom: 10, color: testMsg.startsWith('✅') ? 'var(--green)' : 'var(--coral)' }}>{testMsg}</p>}
          <button className="btn-ghost" onClick={unsubscribe} disabled={loading} style={{ width: '100%', justifyContent: 'center', fontSize: 14 }}>
            {loading ? <span className="spinner" /> : 'Desactivar notificaciones'}
          </button>
        </>
      ) : (
        <>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>Recibe recordatorios de agua, entrenamiento y motivación.</p>
          <button className="btn-primary" onClick={subscribe} disabled={loading} style={{ width: '100%', justifyContent: 'center', fontSize: 14 }}>
            {loading ? <span className="spinner" /> : 'Activar notificaciones'}
          </button>
        </>
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
