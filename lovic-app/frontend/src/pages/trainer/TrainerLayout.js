import React, { useRef, useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import Avatar from '../../components/Avatar';

export default function TrainerLayout() {
  const { user, logout, setUser } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);

  async function pickAvatar(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('avatar', file);
      const res = await api.profile.uploadAvatar(fd);
      if (res.error) throw new Error(res.error);
      setUser(u => ({ ...u, avatar_url: res.avatar_url }));
    } catch (err) {
      alert(err.message || 'No se pudo subir la foto');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  const navLinkStyle = ({ isActive }) => ({
    padding: '6px 14px', borderRadius: 8, fontWeight: 700, fontSize: 13,
    background: isActive ? 'var(--coral)' : 'transparent',
    color: isActive ? '#fff' : 'var(--muted)',
    textDecoration: 'none',
    whiteSpace: 'nowrap',
  });

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <header style={{ background: 'var(--card)', borderBottom: '1px solid var(--border)', padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="10" fill="#C49A46" />
              <text x="50%" y="57%" dominantBaseline="middle" textAnchor="middle" fill="white" fontSize="16" fontWeight="800" fontFamily="Plus Jakarta Sans, sans-serif">L</text>
            </svg>
            <div>
              <p style={{ fontWeight: 800, fontSize: 15 }}>Lovic</p>
              <p style={{ fontSize: 12, color: 'var(--muted)' }}>{user?.name}</p>
            </div>
          </div>
          <nav style={{ display: 'flex', gap: 4, marginLeft: 8 }}>
            <NavLink to="/trainer" end style={navLinkStyle}>👥 Clientes</NavLink>
            <NavLink to="/trainer/library" style={navLinkStyle}>📚 Biblioteca</NavLink>
            <NavLink to="/trainer/billing" style={navLinkStyle}>💰 Ingresos</NavLink>
          </nav>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => fileRef.current?.click()} disabled={busy} title="Cambiar foto de perfil"
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', lineHeight: 0, opacity: busy ? 0.5 : 1 }}>
            <Avatar user={user} size={32} />
          </button>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={pickAvatar} />
          <button className="btn-ghost" onClick={() => { logout(); navigate('/login'); }} style={{ fontSize: 13 }}>Salir</button>
        </div>
      </header>

      <main style={{ maxWidth: 900, margin: '0 auto', padding: '24px 20px' }}>
        <Outlet />
      </main>
    </div>
  );
}
