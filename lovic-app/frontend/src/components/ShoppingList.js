import React, { useState } from 'react';

const PERIODS = [
  { value: 'weekly', label: 'Semanal' },
  { value: 'biweekly', label: 'Quincenal' },
  { value: 'monthly', label: 'Mensual' },
];
const CAT_ICON = {
  'Proteínas': '🍗', 'Carbohidratos': '🍚', 'Frutas y verduras': '🥦', 'Lácteos': '🥛', 'Grasas y otros': '🥑',
};

// fetcher: (period) => Promise<{ categories, note, period }>
export default function ShoppingList({ fetcher, clientName }) {
  const [period, setPeriod] = useState('weekly');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [loadedPeriod, setLoadedPeriod] = useState(null);

  async function generate(p) {
    setLoading(true); setError(null);
    try {
      const res = await fetcher(p);
      if (res.error) throw new Error(res.error);
      setData(res); setLoadedPeriod(p);
    } catch (e) { setError(e.message || 'No se pudo generar la lista'); }
    finally { setLoading(false); }
  }

  function shareText() {
    if (!data) return '';
    const pLabel = PERIODS.find(x => x.value === loadedPeriod)?.label || '';
    let t = `🛒 Lista de mercado${clientName ? ` — ${clientName}` : ''} (${pLabel})\n`;
    for (const cat of data.categories) {
      t += `\n*${CAT_ICON[cat.category] || ''} ${cat.category}*\n`;
      for (const it of cat.items) t += `• ${it.name} — ${it.qty} ${it.unit}\n`;
    }
    return t.trim();
  }

  async function share() {
    const text = shareText();
    if (navigator.share) {
      try { await navigator.share({ text }); return; } catch { /* cancelado */ }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {PERIODS.map(p => (
          <button key={p.value} onClick={() => setPeriod(p.value)} style={{
            flex: 1, padding: '9px 4px', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 12.5,
            background: period === p.value ? 'var(--coral)' : 'var(--card)', color: period === p.value ? '#fff' : 'var(--muted)', boxShadow: 'var(--shadow)',
          }}>{p.label}</button>
        ))}
      </div>
      <button className="btn-primary" onClick={() => generate(period)} disabled={loading} style={{ width: '100%', justifyContent: 'center', marginBottom: 14 }}>
        {loading ? <><span className="spinner" /> Generando…</> : '🛒 Generar lista de mercado'}
      </button>

      {error && <p style={{ color: '#dc2626', fontSize: 13, textAlign: 'center', marginBottom: 12 }}>{error}</p>}

      {data && !loading && (
        data.categories.length === 0 ? (
          <div className="empty-state"><div className="icon">🛒</div><p>{data.note || 'No hay comidas en el plan para armar la lista.'}</p></div>
        ) : (
          <>
            {data.note && <p style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 12, fontStyle: 'italic' }}>{data.note}</p>}
            {data.categories.map(cat => (
              <div key={cat.category} className="card" style={{ marginBottom: 10, padding: '12px 15px' }}>
                <p style={{ fontWeight: 800, fontSize: 13, color: 'var(--coral)', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 8 }}>
                  {CAT_ICON[cat.category] || ''} {cat.category}
                </p>
                {cat.items.map((it, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, padding: '4px 0', borderTop: i ? '1px solid var(--border)' : 'none' }}>
                    <span>{it.name}</span>
                    <span style={{ fontWeight: 700, color: 'var(--muted)' }}>{it.qty} {it.unit}</span>
                  </div>
                ))}
              </div>
            ))}
            <button onClick={share} style={{
              width: '100%', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: 8, marginTop: 6,
              padding: '13px', borderRadius: 12, border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: 14,
              background: '#25D366', color: '#fff',
            }}>📲 Compartir por WhatsApp</button>
          </>
        )
      )}
    </div>
  );
}
