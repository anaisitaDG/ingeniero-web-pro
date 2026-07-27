import React, { useEffect, useState } from 'react';

const BASE = process.env.REACT_APP_API_URL || '';

function initials(name) {
  return (name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase() || '?';
}

// Muestra, en orden de prioridad: foto personalizada subida → Gravatar del correo
// → iniciales. Cada fallo de imagen (onError) avanza al siguiente candidato.
export default function Avatar({ user, size = 40, style }) {
  const custom = user?.avatar_url
    ? (String(user.avatar_url).startsWith('http') ? user.avatar_url : `${BASE}/${user.avatar_url}`)
    : null;

  const candidates = [];
  if (custom) candidates.push(custom);
  if (user?.gravatar_url) candidates.push(user.gravatar_url);

  const [idx, setIdx] = useState(0);
  useEffect(() => { setIdx(0); }, [custom, user?.gravatar_url]);

  const src = candidates[idx];
  const dim = { width: size, height: size, borderRadius: '50%', flexShrink: 0, ...style };

  if (!src) {
    return (
      <div style={{
        ...dim,
        background: 'linear-gradient(135deg,#FF6B6B,#FF8E53)',
        color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 700, fontSize: size * 0.4,
      }}>
        {initials(user?.name)}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={user?.name || 'perfil'}
      onError={() => setIdx(i => i + 1)}
      style={{ ...dim, objectFit: 'cover', background: 'var(--surface)' }}
    />
  );
}
