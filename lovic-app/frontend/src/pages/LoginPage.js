import React, { useState } from 'react';
import { api } from '../services/api';

export default function LoginPage() {
  const [email, setEmail]     = useState('');
  const [sent, setSent]       = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  async function handleSubmit(e) {
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
          </div>
        ) : (
          <>
            <h1 style={styles.title}>Bienvenida 👋</h1>
            <p style={styles.sub}>Ingresa tu correo y te enviamos un enlace de acceso directo.</p>

            <form onSubmit={handleSubmit}>
              <label className="label">Correo electrónico</label>
              <input
                className="input"
                type="email"
                placeholder="tu@correo.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                style={{ marginBottom: 16 }}
              />

              {error && <p style={styles.error}>{error}</p>}

              <button className="btn-primary" type="submit" disabled={loading} style={{ width: '100%', justifyContent: 'center' }}>
                {loading ? <span className="spinner" /> : 'Enviar enlace'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

const styles = {
  wrap:  { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'var(--bg)' },
  card:  { background: 'var(--card)', borderRadius: 24, padding: '40px 36px', width: '100%', maxWidth: 400, boxShadow: '0 4px 32px rgba(0,0,0,0.1)' },
  logo:  { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 },
  brand: { fontSize: 20, fontWeight: 800 },
  title: { fontSize: 26, fontWeight: 800, marginBottom: 8 },
  sub:   { color: 'var(--muted)', fontSize: 15, marginBottom: 28 },
  error: { color: 'var(--coral)', fontSize: 14, marginBottom: 12 },
  sentBox: { textAlign: 'center', padding: '8px 0' },
};
