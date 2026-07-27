import React, { useEffect, useRef, useState } from 'react';
import { api } from '../../services/api';

const ANGLES = [
  { key: 'frente',  label: 'Frente',  icon: '🧍' },
  { key: 'espalda', label: 'Espalda', icon: '🔄' },
  { key: 'perfil',  label: 'Perfil',  icon: '↔️'  },
];

const BASE = process.env.REACT_APP_API_URL || '';

function imgUrl(path) {
  if (!path) return null;
  return path.startsWith('http') ? path : `${BASE}/${path}`;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = String(dateStr).slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── Upload Panel ─────────────────────────────────────────────────────────────
function UploadPanel({ onSaved }) {
  const [files, setFiles]       = useState({ frente: null, espalda: null, perfil: null });
  const [previews, setPreviews] = useState({ frente: null, espalda: null, perfil: null });
  const [note, setNote]         = useState('');
  const [uploading, setUploading] = useState(false);

  function pickAngle(angle, e) {
    const f = e.target.files[0];
    if (!f) return;
    setFiles(prev => ({ ...prev, [angle]: f }));
    setPreviews(prev => ({ ...prev, [angle]: URL.createObjectURL(f) }));
  }

  const hasAny = Object.values(files).some(Boolean);

  async function handleUpload() {
    if (!hasAny) return;
    setUploading(true);
    try {
      const fd = new FormData();
      ANGLES.forEach(({ key }) => { if (files[key]) fd.append(key, files[key]); });
      fd.append('note', note);
      const res = await api.progressPhotos.uploadRegister(fd);
      if (res.error) throw new Error(res.error);
      setFiles({ frente: null, espalda: null, perfil: null });
      setPreviews({ frente: null, espalda: null, perfil: null });
      setNote('');
      onSaved();
    } catch (e) { alert(e.message); }
    finally { setUploading(false); }
  }

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <p style={{ fontWeight: 700, marginBottom: 14 }}>Nuevo registro</p>

      {/* Guías de captura para que la comparación sea justa */}
      <div style={{ background: 'var(--surface)', borderRadius: 12, padding: '12px 14px', marginBottom: 16 }}>
        <p style={{ fontWeight: 700, fontSize: 12.5, marginBottom: 8 }}>📸 Tips para fotos que se puedan comparar</p>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
          <li>Misma distancia y altura del celular cada vez (apóyalo en algo fijo).</li>
          <li>Buena luz, de frente — evita sombras o contraluz.</li>
          <li>Ropa ajustada y similar entre registros (top y short o ropa deportiva).</li>
          <li>Postura relajada, brazos a los lados, mismo fondo si puedes.</li>
          <li>Toma los 3 ángulos: frente, espalda y perfil.</li>
        </ul>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 12 }}>
        {ANGLES.map(({ key, label, icon }) => (
          <label key={key} style={{ cursor: 'pointer' }}>
            <div style={{
              border: '2px dashed var(--border)',
              borderRadius: 12,
              aspectRatio: '3/4',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              background: previews[key] ? 'transparent' : 'var(--surface)',
              position: 'relative',
            }}>
              {previews[key] ? (
                <img src={previews[key]} alt={label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <>
                  <span style={{ fontSize: 22 }}>{icon}</span>
                  <span style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{label}</span>
                </>
              )}
              {previews[key] && (
                <div style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0,
                  background: 'rgba(0,0,0,0.45)', padding: '3px 0', textAlign: 'center',
                }}>
                  <span style={{ fontSize: 10, color: '#fff' }}>{label}</span>
                </div>
              )}
            </div>
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => pickAngle(key, e)} />
          </label>
        ))}
      </div>
      <input
        className="input"
        placeholder="Nota (ej: Semana 4 — -2kg)"
        value={note}
        onChange={e => setNote(e.target.value)}
        style={{ marginBottom: 10 }}
      />
      <button
        className="btn-primary"
        onClick={handleUpload}
        disabled={!hasAny || uploading}
        style={{ width: '100%', justifyContent: 'center' }}
      >
        {uploading ? <><span className="spinner" /> Guardando…</> : '📤 Guardar registro'}
      </button>
    </div>
  );
}

// ── Register Card ─────────────────────────────────────────────────────────────
function RegisterCard({ register, onDelete, onSelect, selected, onLightbox }) {
  return (
    <div
      className="card"
      style={{
        marginBottom: 12,
        border: selected ? '2px solid var(--coral)' : '2px solid transparent',
        cursor: 'pointer',
      }}
      onClick={onSelect}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div>
          <p style={{ fontWeight: 700, fontSize: 14 }}>{formatDate(register.date)}</p>
          {register.note && <p style={{ fontSize: 12, color: 'var(--muted)' }}>{register.note}</p>}
        </div>
        {selected
          ? <span style={{ fontSize: 12, color: 'var(--coral)', fontWeight: 700 }}>✓ Seleccionado</span>
          : <span style={{ fontSize: 11, color: 'var(--muted)' }}>Toca para seleccionar</span>
        }
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
        {ANGLES.map(({ key, label }) => (
          <div key={key} style={{ position: 'relative' }}>
            {register.photos[key] ? (
              <img
                src={imgUrl(register.photos[key].image_url)}
                alt={label}
                onClick={e => { e.stopPropagation(); onLightbox(imgUrl(register.photos[key].image_url), label); }}
                style={{ width: '100%', aspectRatio: '3/4', objectFit: 'cover', borderRadius: 8, display: 'block', cursor: 'zoom-in' }}
              />
            ) : (
              <div style={{
                width: '100%', aspectRatio: '3/4', borderRadius: 8,
                background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ fontSize: 10, color: 'var(--muted)' }}>Sin foto</span>
              </div>
            )}
            <p style={{ fontSize: 9, textAlign: 'center', color: 'var(--muted)', marginTop: 2 }}>{label}</p>
          </div>
        ))}
      </div>
      <button
        onClick={e => { e.stopPropagation(); onDelete(); }}
        style={{ marginTop: 8, fontSize: 11, color: '#E05252', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
      >
        Eliminar registro
      </button>
    </div>
  );
}

// ── Before/After Slider ───────────────────────────────────────────────────────
function BeforeAfterSlider({ before, after, dateBefore, dateAfter }) {
  const [pos, setPos] = useState(50);          // % visible del "después"
  const [width, setWidth] = useState(0);       // ancho en px del contenedor
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
      {/* Después (fondo completo) */}
      <img src={after} alt="Después" draggable={false} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      {/* Antes (recortado desde la izquierda) */}
      <div style={{ position: 'absolute', inset: 0, width: `${pos}%`, overflow: 'hidden' }}>
        <img src={before} alt="Antes" draggable={false}
          style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: width || '100%', maxWidth: 'none', objectFit: 'cover' }} />
      </div>
      {/* Etiquetas */}
      <span style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 11, padding: '2px 8px', borderRadius: 20 }}>Antes · {dateBefore}</span>
      <span style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 11, padding: '2px 8px', borderRadius: 20 }}>Después · {dateAfter}</span>
      {/* Divisor */}
      <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${pos}%`, width: 2, background: '#fff', boxShadow: '0 0 4px rgba(0,0,0,0.5)' }}>
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 34, height: 34, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 6px rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, color: '#333' }}>⇄</div>
      </div>
    </div>
  );
}

// ── Zonas: metadatos, íconos, posición aproximada sobre el cuerpo ─────────────
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

// Foto "después" con marcadores numerados de las zonas de cambio
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

// Números reales de bioimpedancia al lado de las fotos
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
      <p style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>📊 Tus números reales</p>
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

// ── Comparison View ───────────────────────────────────────────────────────────
function CompareView({ a, b, onClose }) {
  const [activeAngle, setActiveAngle] = useState('frente');
  const [analysis, setAnalysis]   = useState(null);
  const [zones, setZones]         = useState([]);
  const [bio, setBio]             = useState(null); // { bioBefore, bioAfter, dateBefore, dateAfter }
  const [analyzing, setAnalyzing] = useState(false);
  const [aiError, setAiError]     = useState(null);

  // Orden cronológico: older = antes, newer = después
  const [older, newer] = [a, b].sort((x, y) => String(x.date).localeCompare(String(y.date)));

  async function runAnalysis() {
    setAnalyzing(true);
    setAiError(null);
    try {
      const res = await api.progressPhotos.compare(a.id, b.id);
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

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--bg)', zIndex: 1000, overflowY: 'auto', padding: '16px 16px 40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--text)' }}>←</button>
        <h2 style={{ fontSize: 16, fontWeight: 700 }}>Comparar registros</h2>
      </div>

      {/* AI analysis */}
      <div className="card" style={{ marginBottom: 16 }}>
        {analysis ? (
          <>
            <p style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>✨ Análisis de tu progreso</p>
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
                      Zonas señaladas sobre tu foto más reciente ({activeAngle})
                    </p>
                  </div>
                )}
              </>
            )}

            <p style={{ fontSize: 10, color: 'var(--muted)', marginTop: 12 }}>
              Análisis generado por IA a partir de las fotos. Es orientativo, no un diagnóstico médico.
            </p>
          </>
        ) : (
          <>
            <p style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>✨ Análisis con IA</p>
            <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>
              Deja que la IA compare tus fotos y te cuente los cambios visibles entre ambos registros.
            </p>
            <button
              className="btn-primary"
              onClick={runAnalysis}
              disabled={analyzing}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              {analyzing ? <><span className="spinner" /> Analizando…</> : 'Analizar mi progreso'}
            </button>
            {aiError && <p style={{ fontSize: 12, color: '#E05252', marginTop: 8 }}>{aiError}</p>}
          </>
        )}
      </div>

      {bio && <BioCompare {...bio} />}

      {/* Angle tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {ANGLES.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveAngle(key)}
            style={{
              flex: 1,
              padding: '8px 0',
              borderRadius: 10,
              border: 'none',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: 13,
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
          <BeforeAfterSlider
            before={beforeSrc}
            after={afterSrc}
            dateBefore={formatDate(older.date)}
            dateAfter={formatDate(newer.date)}
          />
          <p style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center', marginTop: 6 }}>
            Desliza para ver el antes y el después
          </p>
        </div>
      ) : (
        <p style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', marginBottom: 8 }}>
          Falta la foto de {activeAngle} en uno de los registros para el deslizador.
        </p>
      )}

      {/* Side by side */}
      <p style={{ fontWeight: 700, fontSize: 13, marginTop: 16, marginBottom: 8 }}>Lado a lado</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {[older, newer].map((reg, i) => (
          <div key={i}>
            <p style={{ fontSize: 12, fontWeight: 700, textAlign: 'center', marginBottom: 6 }}>{formatDate(reg.date)}</p>
            {reg.photos[activeAngle] ? (
              <img
                src={imgUrl(reg.photos[activeAngle].image_url)}
                alt={activeAngle}
                style={{ width: '100%', borderRadius: 12, display: 'block' }}
              />
            ) : (
              <div style={{
                width: '100%', aspectRatio: '3/4', borderRadius: 12,
                background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ color: 'var(--muted)', fontSize: 13 }}>Sin foto</span>
              </div>
            )}
            {reg.note && <p style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center', marginTop: 4 }}>{reg.note}</p>}
          </div>
        ))}
      </div>

      {/* All angles strip */}
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
                  <div style={{
                    width: '100%', aspectRatio: '3/4', borderRadius: 10,
                    background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
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

// ── Lightbox ──────────────────────────────────────────────────────────────────
function Lightbox({ src, alt, onClose }) {
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 2000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <img src={src} alt={alt} style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 10, objectFit: 'contain' }} />
      <button onClick={onClose} style={{
        position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.15)',
        border: 'none', color: '#fff', fontSize: 24, borderRadius: '50%',
        width: 40, height: 40, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>✕</button>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ProgressPhotos() {
  const [registers, setRegisters] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [selected, setSelected]   = useState([]);
  const [comparing, setComparing] = useState(false);
  const [view, setView]           = useState('list'); // 'list' | 'upload'
  const [lightbox, setLightbox]   = useState(null); // { src, alt }

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const d = await api.progressPhotos.list();
      setRegisters(d.registers || []);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('¿Eliminar este registro completo?')) return;
    try {
      await api.progressPhotos.removeRegister(id);
      setSelected(s => s.filter(sid => sid !== id));
      load();
    } catch (e) {
      alert('No se pudo eliminar. Intenta de nuevo.');
    }
  }

  function toggleSelect(id) {
    setSelected(prev => {
      if (prev.includes(id)) return prev.filter(s => s !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  }

  if (comparing && selected.length === 2) {
    const a = registers.find(r => r.id === selected[0]);
    const b = registers.find(r => r.id === selected[1]);
    if (!a || !b) { setComparing(false); setSelected([]); return null; }
    return <CompareView a={a} b={b} onClose={() => setComparing(false)} />;
  }

  return (
    <div>
      {lightbox && <Lightbox src={lightbox.src} alt={lightbox.alt} onClose={() => setLightbox(null)} />}
      <div className="page-header">
        <h1 className="page-title">Fotos de progreso 📸</h1>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button
          className={view === 'list' ? 'btn-primary' : 'btn-secondary'}
          style={{ flex: 1, justifyContent: 'center', fontSize: 14 }}
          onClick={() => setView('list')}
        >
          Mis registros
        </button>
        <button
          className={view === 'upload' ? 'btn-primary' : 'btn-secondary'}
          style={{ flex: 1, justifyContent: 'center', fontSize: 14 }}
          onClick={() => setView('upload')}
        >
          + Nuevo
        </button>
      </div>

      {view === 'upload' && (
        <UploadPanel onSaved={() => { load(); setView('list'); }} />
      )}

      {view === 'list' && (
        <>
          {selected.length > 0 && (
            <div style={{
              background: 'var(--surface)', borderRadius: 12, padding: '10px 14px',
              marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span style={{ fontSize: 13, color: 'var(--muted)' }}>
                {selected.length === 1 ? 'Selecciona otro para comparar' : '2 seleccionados'}
              </span>
              {selected.length === 2 && (
                <button
                  className="btn-primary"
                  style={{ fontSize: 13, padding: '6px 14px' }}
                  onClick={() => setComparing(true)}
                >
                  Comparar →
                </button>
              )}
              <button
                onClick={() => setSelected([])}
                style={{ fontSize: 12, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                Cancelar
              </button>
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: 'center', padding: 48 }}>
              <div className="spinner" style={{ borderTopColor: 'var(--coral)', borderColor: 'var(--border)', width: 28, height: 28 }} />
            </div>
          ) : registers.length === 0 ? (
            <div className="empty-state">
              <div className="icon">📸</div>
              <p>Aún no hay registros de progreso</p>
              <button className="btn-primary" style={{ marginTop: 12 }} onClick={() => setView('upload')}>
                Subir primer registro
              </button>
            </div>
          ) : (
            <>
              {registers.length >= 2 && selected.length === 0 && (
                <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12, textAlign: 'center' }}>
                  Toca un registro para seleccionar y comparar
                </p>
              )}
              {registers.map(r => (
                <RegisterCard
                  key={r.id}
                  register={r}
                  selected={selected.includes(r.id)}
                  onSelect={() => toggleSelect(r.id)}
                  onDelete={() => handleDelete(r.id)}
                  onLightbox={(src, alt) => setLightbox({ src, alt })}
                />
              ))}
            </>
          )}
        </>
      )}
    </div>
  );
}
