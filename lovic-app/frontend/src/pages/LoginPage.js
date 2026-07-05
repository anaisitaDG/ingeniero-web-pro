import React, { useState } from 'react';
import { api, setToken } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function LoginPage() {
  const { setUser } = useAuth();
  const navigate    = useNavigate();
  const [mode, setMode]       = useState('password'); // 'password' | 'magic'
  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [sent, setSent]       = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  async function handlePassword(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.auth.login(email, password);
      if (res.error) throw new Error(res.error);
      setToken(res.token);
      setUser(res.user);
      navigate(res.user.role === 'trainer' ? '/trainer' : '/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleMagicLink(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.auth.magicLink(email);
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.card}>
        <div style={styles.logo}>
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <rect width="48" height="48" rx="14" fill="#FF6B6B" />
            <text x="50%" y="57%" dominantBaseline="middle" textAnchor="middle" fill="white" fontSize="22" fontWeight="800" fontFamily="Plus Jakarta Sans, sans-serif">L</text>
          </svg>
          <span style={styles.brand}>Lovic Athletica</span>
        </div>

        {sent ? (
          <div style={styles.sentBox}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📧</div>
            <h2 style={{ fontWeight: 800, marginBottom: 8 }}>Revisa tu correo</h2>
            <p style={{ color: 'var(--muted)', fontSize: 15 }}>
              Enviamos un enlace de acceso a <strong>{email}</strong>.<br />
              Válido por 15 minutos.
            </p>
            <button style={{ marginTop: 20, fontSize: 13, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => setSent(false)}>
              ← Volver
            </button>
          </div>
        ) : (
          <>
            <h1 style={styles.title}>Bienvenida 👋</h1>

            {/* Tabs */}
            <div style={{ display: 'flex', background: 'var(--surface)', borderRadius: 12, padding: 4, marginBottom: 24, gap: 4 }}>
              <button
                onClick={() => { setMode('password'); setError(''); }}
                style={{ flex: 1, padding: '9px 0', borderRadius: 9, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14,
                  background: mode === 'password' ? 'var(--card)' : 'transparent',
                  color: mode === 'password' ? 'var(--text)' : 'var(--muted)',
                  boxShadow: mode === 'password' ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                }}
              >
                🔑 Contraseña
              </button>
              <button
                onClick={() => { setMode('magic'); setError(''); }}
                style={{ flex: 1, padding: '9px 0', borderRadius: 9, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14,
                  background: mode === 'magic' ? 'var(--card)' : 'transparent',
                  color: mode === 'magic' ? 'var(--text)' : 'var(--muted)',
                  boxShadow: mode === 'magic' ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                }}
              >
                📧 Link por correo
              </button>
            </div>

            {mode === 'password' ? (
              <form onSubmit={handlePassword}>
                <label className="label">Correo electrónico</label>
                <input className="input" type="email" placeholder="tu@correo.com" value={email}
                  onChange={e => setEmail(e.target.value)} required style={{ marginBottom: 14 }} />
                <label className="label">Contraseña</label>
                <input className="input" type="password" placeholder="Tu contraseña" value={password}
                  onChange={e => setPassword(e.target.value)} required style={{ marginBottom: 16 }} />
                {error && <p style={styles.error}>{error}</p>}
                <button className="btn-primary" type="submit" disabled={loading} style={{ width: '100%', justifyContent: 'center' }}>
                  {loading ? <span className="spinner" /> : 'Entrar'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleMagicLink}>
                <label className="label">Correo electrónico</label>
                <input className="input" type="email" placeholder="tu@correo.com" value={email}
                  onChange={e => setEmail(e.target.value)} required style={{ marginBottom: 16 }} />
                {error && <p style={styles.error}>{error}</p>}
                <button className="btn-primary" type="submit" disabled={loading} style={{ width: '100%', justifyContent: 'center' }}>
                  {loading ? <span className="spinner" /> : 'Enviar enlace'}
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const styles = {
  wrap:    { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'var(--bg)' },
  card:    { background: 'var(--card)', borderRadius: 24, padding: '40px 36px', width: '100%', maxWidth: 400, boxShadow: '0 4px 32px rgba(0,0,0,0.1)' },
  logo:    { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 },
  brand:   { fontSize: 20, fontWeight: 800 },
  title:   { fontSize: 26, fontWeight: 800, marginBottom: 20 },
  error:   { color: 'var(--coral)', fontSize: 14, marginBottom: 12 },
  sentBox: { textAlign: 'center', padding: '8px 0' },
};
