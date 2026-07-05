import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function TrainerLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

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
          </nav>
        </div>
        <button className="btn-ghost" onClick={() => { logout(); navigate('/login'); }} style={{ fontSize: 13 }}>Salir</button>
      </header>

      <main style={{ maxWidth: 900, margin: '0 auto', padding: '24px 20px' }}>
        <Outlet />
      </main>
    </div>
  );
}
