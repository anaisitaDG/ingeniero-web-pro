import React, { useEffect, useState } from 'react';
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
  return new Date(dateStr).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' });
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
            <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={e => pickAngle(key, e)} />
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
function RegisterCard({ register, onDelete, onSelect, selected }) {
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
        {selected && <span style={{ fontSize: 12, color: 'var(--coral)', fontWeight: 700 }}>Seleccionado</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
        {ANGLES.map(({ key, label }) => (
          <div key={key} style={{ position: 'relative' }}>
            {register.photos[key] ? (
              <img
                src={imgUrl(register.photos[key].image_url)}
                alt={label}
                style={{ width: '100%', aspectRatio: '3/4', objectFit: 'cover', borderRadius: 8, display: 'block' }}
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

// ── Comparison View ───────────────────────────────────────────────────────────
function CompareView({ a, b, onClose }) {
  const [activeAngle, setActiveAngle] = useState('frente');

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--bg)', zIndex: 200, overflowY: 'auto', padding: '16px 16px 40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--text)' }}>←</button>
        <h2 style={{ fontSize: 16, fontWeight: 700 }}>Comparar registros</h2>
      </div>

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

      {/* Side by side */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {[a, b].map((reg, i) => (
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
            {[a, b].map((reg, i) => (
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

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ProgressPhotos() {
  const [registers, setRegisters] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [selected, setSelected]   = useState([]);
  const [comparing, setComparing] = useState(false);
  const [view, setView]           = useState('list'); // 'list' | 'upload'

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
    await api.progressPhotos.removeRegister(id);
    setSelected(s => s.filter(sid => sid !== id));
    load();
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
    return <CompareView a={a} b={b} onClose={() => setComparing(false)} />;
  }

  return (
    <div>
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
                />
              ))}
            </>
          )}
        </>
      )}
    </div>
  );
}
