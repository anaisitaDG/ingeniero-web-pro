import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';

export default function ProgressPhotos() {
  const [photos, setPhotos]     = useState([]);
  const [file, setFile]         = useState(null);
  const [note, setNote]         = useState('');
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading]   = useState(true);
  const [preview, setPreview]   = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const d = await api.progressPhotos.list();
      setPhotos(d.photos || []);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append('photo', file);
    fd.append('note', note);
    try {
      const res = await api.progressPhotos.upload(fd);
      if (res.error) throw new Error(res.error);
      setFile(null);
      setNote('');
      load();
    } catch (e) { alert(e.message); }
    finally { setUploading(false); }
  }

  async function handleDelete(id) {
    if (!window.confirm('¿Eliminar esta foto?')) return;
    await api.progressPhotos.remove(id);
    load();
  }

  const BASE = process.env.REACT_APP_API_URL || '';

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Fotos de progreso 📸</h1>
      </div>

      {/* Upload */}
      <div className="card" style={{ marginBottom: 20 }}>
        <p style={{ fontWeight: 700, marginBottom: 10 }}>Nueva foto</p>
        <input type="file" accept="image/*" onChange={e => setFile(e.target.files[0])} style={{ marginBottom: 10, display: 'block' }} />
        <input className="input" placeholder="Nota (opcional, ej: semana 4)" value={note} onChange={e => setNote(e.target.value)} style={{ marginBottom: 10 }} />
        <button className="btn-primary" onClick={handleUpload} disabled={!file || uploading} style={{ width: '100%', justifyContent: 'center' }}>
          {uploading ? <><span className="spinner" /> Subiendo…</> : '📤 Subir foto'}
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}><div className="spinner" style={{ borderTopColor: 'var(--coral)', borderColor: 'var(--border)', width: 28, height: 28 }} /></div>
      ) : photos.length === 0 ? (
        <div className="empty-state"><div className="icon">📸</div><p>Aún no hay fotos de progreso</p></div>
      ) : (
        <>
          <p className="label" style={{ marginBottom: 12 }}>{photos.length} foto{photos.length !== 1 ? 's' : ''}</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {photos.map(p => (
              <div key={p.id} className="card" style={{ padding: 0, overflow: 'hidden', position: 'relative' }}>
                <img
                  src={`${BASE}/uploads/${p.image_url.split('/').pop()}`}
                  alt={p.note || 'Progreso'}
                  style={{ width: '100%', aspectRatio: '3/4', objectFit: 'cover', display: 'block', cursor: 'pointer' }}
                  onClick={() => setPreview(p)}
                />
                <div style={{ padding: '8px 10px' }}>
                  <p style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 2 }}>
                    {new Date(p.taken_at).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                  {p.note && <p style={{ fontSize: 12, fontWeight: 600 }}>{p.note}</p>}
                  <button onClick={() => handleDelete(p.id)} style={{ marginTop: 4, fontSize: 11, color: '#E05252', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Eliminar</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Lightbox */}
      {preview && (
        <div onClick={() => setPreview(null)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }}>
          <div style={{ maxWidth: 440, width: '100%' }}>
            <img src={`${BASE}/uploads/${preview.image_url.split('/').pop()}`} alt={preview.note} style={{ width: '100%', borderRadius: 16, display: 'block' }} />
            {preview.note && <p style={{ color: '#fff', textAlign: 'center', marginTop: 10, fontWeight: 600 }}>{preview.note}</p>}
            <p style={{ color: 'rgba(255,255,255,0.5)', textAlign: 'center', fontSize: 12, marginTop: 4 }}>Toca para cerrar</p>
          </div>
        </div>
      )}
    </div>
  );
}
