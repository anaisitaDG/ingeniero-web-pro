import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const navItems = [
  { to: '/',             label: 'Inicio',   icon: '🏠' },
  { to: '/food',         label: 'Comida',   icon: '🥗' },
  { to: '/measurements', label: 'Medidas',  icon: '📏' },
  { to: '/plan',         label: 'Mi Plan',  icon: '💪' },
];

export default function ClientLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div style={styles.wrap}>
      {/* Top header */}
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <div style={styles.logo}>
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="10" fill="#FF6B6B" />
              <text x="50%" y="57%" dominantBaseline="middle" textAnchor="middle" fill="white" fontSize="16" fontWeight="800" fontFamily="Plus Jakarta Sans, sans-serif">L</text>
            </svg>
            <span style={{ fontWeight: 800, fontSize: 16 }}>Lovic</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>Hola, {user?.name?.split(' ')[0]}</span>
            <button className="btn-ghost" onClick={handleLogout} style={{ padding: '6px 12px', fontSize: 13 }}>Salir</button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main style={styles.main}>
        <Outlet />
      </main>

      {/* Bottom nav */}
      <nav style={styles.nav}>
        {navItems.map(item => (
          <NavLink key={item.to} to={item.to} end={item.to === '/'} style={({ isActive }) => ({ ...styles.navItem, ...(isActive ? styles.navActive : {}) })}>
            <span style={{ fontSize: 20 }}>{item.icon}</span>
            <span style={{ fontSize: 11, fontWeight: 600 }}>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

const styles = {
  wrap:       { display: 'flex', flexDirection: 'column', minHeight: '100vh', maxWidth: 480, margin: '0 auto', position: 'relative' },
  header:     { background: 'var(--card)', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 10 },
  headerInner:{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px' },
  logo:       { display: 'flex', alignItems: 'center', gap: 8 },
  main:       { flex: 1, padding: '20px 20px 96px' },
  nav:        { position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, background: 'var(--card)', borderTop: '1px solid var(--border)', display: 'flex', zIndex: 10 },
  navItem:    { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '10px 0 14px', color: 'var(--muted)', textDecoration: 'none' },
  navActive:  { color: 'var(--coral)' },
};
