import React, { useEffect, useRef, useState } from 'react';
import { api } from '../services/api';

const ANGLES = [
  { key: 'frente',  label: 'Frente'  },
  { key: 'espalda', label: 'Espalda' },
  { key: 'perfil',  label: 'Perfil'  },
];

const BASE = process.env.REACT_APP_API_URL || '';

function imgUrl(path) {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${BASE}/progress-photos/f/${path.split('/').pop()}`;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = String(dateStr).slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── Before/After Slider ───────────────────────────────────────────────────────
function BeforeAfterSlider({ before, after, dateBefore, dateAfter }) {
  const [pos, setPos] = useState(50);
  const [width, setWidth] = useState(0);
  const wrapRef = useRef(null);
  const dragging = useRef(false);

  useEffect(() => {
    function measure() { if (wrapRef.current) setWidth(wrapRef.current.getBoundingClientRect().width); }
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  function setFromClientX(clientX) {
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setPos(Math.max(0, Math.min(100, pct)));
  }
  function onDown(e) { dragging.current = true; setFromClientX((e.touches ? e.touches[0] : e).clientX); }
  function onMove(e) { if (dragging.current) setFromClientX((e.touches ? e.touches[0] : e).clientX); }
  function onUp()    { dragging.current = false; }

  useEffect(() => {
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove);
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };
  }, []);

  return (
    <div
      ref={wrapRef}
      onMouseDown={onDown}
      onTouchStart={onDown}
      style={{ position: 'relative', width: '100%', aspectRatio: '3/4', borderRadius: 12, overflow: 'hidden', userSelect: 'none', touchAction: 'none', background: 'var(--surface)' }}
    >
      <img src={after} alt="Después" draggable={false} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      <div style={{ position: 'absolute', inset: 0, width: `${pos}%`, overflow: 'hidden' }}>
        <img src={before} alt="Antes" draggable={false}
          style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: width || '100%', maxWidth: 'none', objectFit: 'cover' }} />
      </div>
      <span style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 11, padding: '2px 8px', borderRadius: 20 }}>Antes · {dateBefore}</span>
      <span style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 11, padding: '2px 8px', borderRadius: 20 }}>Después · {dateAfter}</span>
      <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${pos}%`, width: 2, background: '#fff', boxShadow: '0 0 4px rgba(0,0,0,0.5)' }}>
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 34, height: 34, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 6px rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, color: '#333' }}>⇄</div>
      </div>
    </div>
  );
}

// ── Zonas ─────────────────────────────────────────────────────────────────────
const TREND = {
  mejora:   { icon: '▲', color: '#2E9E6B', label: 'Mejora' },
  atencion: { icon: '!',  color: '#E0A32E', label: 'A cuidar' },
  estable:  { icon: '≈',  color: '#8A8F98', label: 'Estable' },
};
const AREA_META = {
  hombros:  { label: 'Hombros',  x: 50, y: 15 },
  pecho:    { label: 'Pecho',    x: 50, y: 26 },
  espalda:  { label: 'Espalda',  x: 50, y: 28 },
  brazos:   { label: 'Brazos',   x: 16, y: 33 },
  cintura:  { label: 'Cintura',  x: 50, y: 43 },
  abdomen:  { label: 'Abdomen',  x: 50, y: 48 },
  gluteos:  { label: 'Glúteos',  x: 50, y: 60 },
  piernas:  { label: 'Piernas',  x: 50, y: 80 },
  postura:  { label: 'Postura',  x: 82, y: 20 },
  general:  { label: 'General',  x: 82, y: 52 },
};

function ZoneMarkers({ src, zones }) {
  const positioned = zones.filter(z => AREA_META[z.area]);
  return (
    <div style={{ position: 'relative', width: '100%', aspectRatio: '3/4', borderRadius: 12, overflow: 'hidden', background: 'var(--surface)' }}>
      <img src={src} alt="Zonas de cambio" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      {positioned.map((z, i) => {
        const meta = AREA_META[z.area];
        const t = TREND[z.trend] || TREND.estable;
        return (
          <div key={i} style={{
            position: 'absolute', left: `${meta.x}%`, top: `${meta.y}%`, transform: 'translate(-50%,-50%)',
            width: 24, height: 24, borderRadius: '50%', background: t.color, color: '#fff',
            fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid #fff', boxShadow: '0 1px 4px rgba(0,0,0,0.5)',
          }}>{i + 1}</div>
        );
      })}
    </div>
  );
}

function BioCompare({ bioBefore, bioAfter, dateBefore, dateAfter }) {
  if (!bioBefore && !bioAfter) return null;
  const rows = [
    { key: 'weight_kg',      label: 'Peso',            unit: 'kg', better: 'down' },
    { key: 'body_fat_pct',   label: 'Grasa corporal',  unit: '%',  better: 'down' },
    { key: 'muscle_mass_kg', label: 'Músculo',         unit: 'kg', better: 'up'   },
    { key: 'visceral_fat',   label: 'Grasa visceral',  unit: '',   better: 'down' },
  ];
  const num = (v) => (v == null || v === '' ? null : Number(v));
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <p style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>📊 Números reales</p>
      <p style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 12 }}>Bioimpedancia más cercana a cada fecha</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 0.7fr', gap: 6, fontSize: 12, alignItems: 'center' }}>
        <span style={{ color: 'var(--muted)' }} />
        <span style={{ color: 'var(--muted)', textAlign: 'center', fontWeight: 700 }}>{dateBefore?.slice(5)}</span>
        <span style={{ color: 'var(--muted)', textAlign: 'center', fontWeight: 700 }}>{dateAfter?.slice(5)}</span>
        <span style={{ color: 'var(--muted)', textAlign: 'center' }}>Δ</span>
        {rows.map(r => {
          const bv = num(bioBefore?.[r.key]);
          const av = num(bioAfter?.[r.key]);
          if (bv == null && av == null) return null;
          const delta = (bv != null && av != null) ? +(av - bv).toFixed(1) : null;
          let color = 'var(--muted)';
          if (delta != null && delta !== 0) {
            const good = r.better === 'down' ? delta < 0 : delta > 0;
            color = good ? '#2E9E6B' : '#E0A32E';
          }
          return (
            <React.Fragment key={r.key}>
              <span style={{ fontWeight: 600 }}>{r.label}</span>
              <span style={{ textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{bv != null ? `${bv}${r.unit}` : '—'}</span>
              <span style={{ textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{av != null ? `${av}${r.unit}` : '—'}</span>
              <span style={{ textAlign: 'center', color, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                {delta == null ? '—' : delta === 0 ? '=' : (delta > 0 ? `+${delta}` : delta)}
              </span>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

// ── Vista de comparación (compartida cliente / entrenadora) ───────────────────
// Props: a, b (registros), onClose, userId (opcional: si la entrenadora compara
// las fotos de una clienta), embedded (sin overlay fijo, para incrustar en tab).
export default function PhotoCompareView({ a, b, onClose, userId, embedded }) {
  const [activeAngle, setActiveAngle] = useState('frente');
  const [analysis, setAnalysis]   = useState(null);
  const [zones, setZones]         = useState([]);
  const [bio, setBio]             = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [aiError, setAiError]     = useState(null);

  const [older, newer] = [a, b].sort((x, y) => String(x.date).localeCompare(String(y.date)));

  async function runAnalysis(refresh) {
    setAnalyzing(true);
    setAiError(null);
    try {
      const res = await api.progressPhotos.compare(a.id, b.id, userId, refresh);
      setAnalysis(res.analysis);
      setZones(res.zones || []);
      setBio({ bioBefore: res.bioBefore, bioAfter: res.bioAfter, dateBefore: res.dateBefore, dateAfter: res.dateAfter });
    } catch (e) {
      setAiError(e.message || 'No se pudo generar el análisis');
    } finally {
      setAnalyzing(false);
    }
  }

  const beforeSrc = older.photos[activeAngle] ? imgUrl(older.photos[activeAngle].image_url) : null;
  const afterSrc  = newer.photos[activeAngle] ? imgUrl(newer.photos[activeAngle].image_url) : null;

  const wrapStyle = embedded
    ? {}
    : { position: 'fixed', inset: 0, background: 'var(--bg)', zIndex: 1000, overflowY: 'auto', padding: '16px 16px 40px' };

  return (
    <div style={wrapStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--text)' }}>←</button>
        <h2 style={{ fontSize: 16, fontWeight: 700 }}>Comparar registros</h2>
      </div>

      {/* Análisis IA */}
      <div className="card" style={{ marginBottom: 16 }}>
        {analysis ? (
          <>
            <p style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>✨ Análisis del progreso</p>
            <p style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--text)', whiteSpace: 'pre-wrap' }}>{analysis}</p>

            {zones.length > 0 && (
              <>
                <p style={{ fontWeight: 700, fontSize: 13, marginTop: 16, marginBottom: 8 }}>Cambios por zona</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {zones.filter(z => AREA_META[z.area]).map((z, i) => {
                    const t = TREND[z.trend] || TREND.estable;
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          flexShrink: 0, width: 20, height: 20, borderRadius: '50%', background: t.color, color: '#fff',
                          fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>{i + 1}</span>
                        <span style={{ fontSize: 12.5 }}>
                          <b>{AREA_META[z.area].label}:</b> {z.change}
                          <span style={{ color: t.color, fontWeight: 700 }}> · {t.label}</span>
                        </span>
                      </div>
                    );
                  })}
                </div>

                {afterSrc && (
                  <div style={{ marginTop: 14, maxWidth: 220, marginLeft: 'auto', marginRight: 'auto' }}>
                    <ZoneMarkers src={afterSrc} zones={zones} />
                    <p style={{ fontSize: 10, color: 'var(--muted)', textAlign: 'center', marginTop: 4 }}>
                      Zonas señaladas sobre la foto más reciente ({activeAngle})
                    </p>
                  </div>
                )}
              </>
            )}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, gap: 8 }}>
              <p style={{ fontSize: 10, color: 'var(--muted)', margin: 0 }}>
                Análisis por IA a partir de las fotos. Orientativo, no un diagnóstico médico.
              </p>
              <button
                onClick={() => runAnalysis(true)}
                disabled={analyzing}
                style={{ flexShrink: 0, fontSize: 11, color: 'var(--coral)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}
              >
                {analyzing ? '…' : '↻ Regenerar'}
              </button>
            </div>
          </>
        ) : (
          <>
            <p style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>✨ Análisis con IA</p>
            <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>
              La IA compara las fotos y describe los cambios visibles entre ambos registros.
            </p>
            <button
              className="btn-primary"
              onClick={runAnalysis}
              disabled={analyzing}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              {analyzing ? <><span className="spinner" /> Analizando…</> : 'Analizar progreso'}
            </button>
            {aiError && <p style={{ fontSize: 12, color: '#E05252', marginTop: 8 }}>{aiError}</p>}
          </>
        )}
      </div>

      {bio && <BioCompare {...bio} />}

      {/* Tabs de ángulo */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {ANGLES.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveAngle(key)}
            style={{
              flex: 1, padding: '8px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
              fontWeight: 700, fontSize: 13,
              background: activeAngle === key ? 'var(--coral)' : 'var(--surface)',
              color: activeAngle === key ? '#fff' : 'var(--text)',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Slider antes/después */}
      {beforeSrc && afterSrc ? (
        <div style={{ marginBottom: 8 }}>
          <BeforeAfterSlider before={beforeSrc} after={afterSrc} dateBefore={formatDate(older.date)} dateAfter={formatDate(newer.date)} />
          <p style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center', marginTop: 6 }}>Desliza para ver el antes y el después</p>
        </div>
      ) : (
        <p style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', marginBottom: 8 }}>
          Falta la foto de {activeAngle} en uno de los registros para el deslizador.
        </p>
      )}

      {/* Lado a lado */}
      <p style={{ fontWeight: 700, fontSize: 13, marginTop: 16, marginBottom: 8 }}>Lado a lado</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {[older, newer].map((reg, i) => (
          <div key={i}>
            <p style={{ fontSize: 12, fontWeight: 700, textAlign: 'center', marginBottom: 6 }}>{formatDate(reg.date)}</p>
            {reg.photos[activeAngle] ? (
              <img src={imgUrl(reg.photos[activeAngle].image_url)} alt={activeAngle} style={{ width: '100%', borderRadius: 12, display: 'block' }} />
            ) : (
              <div style={{ width: '100%', aspectRatio: '3/4', borderRadius: 12, background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: 'var(--muted)', fontSize: 13 }}>Sin foto</span>
              </div>
            )}
            {reg.note && <p style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center', marginTop: 4 }}>{reg.note}</p>}
          </div>
        ))}
      </div>

      {/* Todos los ángulos */}
      <p style={{ fontWeight: 700, fontSize: 13, marginTop: 24, marginBottom: 10 }}>Todos los ángulos</p>
      {ANGLES.map(({ key, label }) => (
        <div key={key} style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700, marginBottom: 6 }}>{label}</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[older, newer].map((reg, i) => (
              <div key={i}>
                <p style={{ fontSize: 10, textAlign: 'center', color: 'var(--muted)', marginBottom: 3 }}>{formatDate(reg.date)}</p>
                {reg.photos[key] ? (
                  <img src={imgUrl(reg.photos[key].image_url)} alt={label} style={{ width: '100%', borderRadius: 10 }} />
                ) : (
                  <div style={{ width: '100%', aspectRatio: '3/4', borderRadius: 10, background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: 10, color: 'var(--muted)' }}>Sin foto</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
