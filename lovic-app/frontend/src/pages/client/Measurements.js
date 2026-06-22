import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const FIELDS = [
  { key: 'weight_kg', label: 'Peso', unit: 'kg', icon: '⚖️' },
  { key: 'arm_cm',    label: 'Brazo', unit: 'cm', icon: '💪' },
  { key: 'chest_cm',  label: 'Pecho', unit: 'cm', icon: '📏' },
  { key: 'waist_cm',  label: 'Cintura', unit: 'cm', icon: '🎯' },
  { key: 'hip_cm',    label: 'Cadera', unit: 'cm', icon: '📐' },
  { key: 'thigh_cm',  label: 'Muslo', unit: 'cm', icon: '🦵' },
  { key: 'calf_cm',   label: 'Pantorrilla', unit: 'cm', icon: '🦵' },
  { key: 'forearm_cm',label: 'Antebrazo', unit: 'cm', icon: '💪' },
];

const EMPTY = FIELDS.reduce((acc, f) => ({ ...acc, [f.key]: '' }), { notes: '' });

export default function Measurements() {
  const { user } = useAuth();
  const [rows, setRows]         = useState([]);
  const [form, setForm]         = useState(EMPTY);
  const [saving, setSaving]     = useState(false);
  const [open, setOpen]         = useState(false);
  const [bioList, setBioList]   = useState([]);
  const [bioFiles, setBioFiles] = useState([]);
  const [bioUploading, setBioUploading] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    const d = await api.measurements.list(10);
    setRows(d.measurements);
    const b = await api.bioimpedance.list();
    setBioList(b.bioimpedance || []);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const body = Object.fromEntries(
        Object.entries(form).map(([k, v]) => [k, v === '' ? null : parseFloat(v) || v])
      );
      await api.measurements.add(body);
      setForm(EMPTY);
      setOpen(false);
      load();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  const latest = rows[0];
  const prev   = rows[1];

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Medidas 📏</h1>
        <button className="btn-primary" onClick={() => setOpen(!open)} style={{ padding: '10px 18px', fontSize: 14 }}>
          {open ? 'Cancelar' : '+ Registrar'}
        </button>
      </div>

      {open && (
        <form onSubmit={handleSubmit} className="card" style={{ marginBottom: 20 }}>
          <p style={{ fontWeight: 700, marginBottom: 16 }}>Nueva medición</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            {FIELDS.map(f => (
              <div key={f.key}>
                <label className="label">{f.icon} {f.label} ({f.unit})</label>
                <input
                  className="input"
                  type="number"
                  step="0.1"
                  placeholder="0"
                  value={form[f.key]}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                />
              </div>
            ))}
          </div>
          <label className="label">Notas</label>
          <textarea
            className="input"
            rows={2}
            placeholder="Opcional..."
            value={form.notes}
            onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
            style={{ marginBottom: 14, resize: 'vertical' }}
          />
          <button className="btn-primary" type="submit" disabled={saving} style={{ width: '100%', justifyContent: 'center' }}>
            {saving ? <span className="spinner" /> : 'Guardar medidas'}
          </button>
        </form>
      )}

      {/* Latest vs previous */}
      {latest && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
          {FIELDS.filter(f => latest[f.key] != null).map(f => (
            <MeasureCard key={f.key} field={f} latest={latest} prev={prev} />
          ))}
        </div>
      )}

      {/* History */}
      {rows.length > 1 && (
        <>
          <p className="label" style={{ marginBottom: 10 }}>Historial</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {rows.slice(1).map(row => (
              <div key={row.id} className="card" style={{ padding: '12px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontWeight: 700 }}>{new Date(row.logged_at).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  {row.weight_kg && <span className="pill pill-coral">{row.weight_kg} kg</span>}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {FIELDS.slice(1).filter(f => row[f.key]).map(f => (
                    <span key={f.key} style={{ fontSize: 12, color: 'var(--muted)' }}>{f.label}: <strong>{row[f.key]}{f.unit}</strong></span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {rows.length === 0 && (
        <div className="empty-state">
          <div className="icon">📏</div>
          <p>Aún no hay medidas registradas</p>
        </div>
      )}

      {/* Bioimpedancia */}
      <div style={{ marginTop: 32 }}>
        <p className="page-title" style={{ fontSize: 18, marginBottom: 16 }}>Bioimpedancia 📊</p>
        <div className="card" style={{ marginBottom: 16 }}>
          <p style={{ fontWeight: 700, marginBottom: 10 }}>Subir fotos de bioimpedancia</p>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>Selecciona hasta 4 fotos del reporte</p>
          <input type="file" accept="image/*" multiple onChange={e => setBioFiles(Array.from(e.target.files))} style={{ marginBottom: 10 }} />
          {bioFiles.length > 0 && <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>{bioFiles.length} foto(s) seleccionada(s)</p>}
          <button className="btn-primary" onClick={async () => {
            if (!bioFiles.length) return;
            setBioUploading(true);
            const fd = new FormData();
            bioFiles.forEach(f => fd.append('image', f));
            fd.append('user_id', user.id);
            try {
              const res = await api.bioimpedance.upload(fd, user.id);
              if (res.error) throw new Error(res.error);
              setBioFiles([]);
              load();
            } catch (e) { alert(e.message); }
            finally { setBioUploading(false); }
          }} disabled={!bioFiles.length || bioUploading} style={{ width: '100%', justifyContent: 'center' }}>
            {bioUploading ? <><span className="spinner" /> Procesando…</> : 'Subir y analizar'}
          </button>
        </div>
        {bioList.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {bioList.map(b => (
              <div key={b.id} className="card" style={{ padding: 16 }}>
                <p style={{ fontWeight: 700, marginBottom: 10 }}>{new Date(b.logged_at).toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {b.body_fat_pct != null && <InfoRow label="Grasa corporal" value={`${b.body_fat_pct}%`} />}
                  {b.muscle_mass_kg != null && <InfoRow label="Masa muscular" value={`${b.muscle_mass_kg} kg`} />}
                  {b.visceral_fat != null && <InfoRow label="Grasa visceral" value={b.visceral_fat} />}
                  {b.bmr_kcal != null && <InfoRow label="Metabolismo" value={`${b.bmr_kcal} kcal`} />}
                </div>
                {(b.target_muscle_kg != null || b.target_fat_loss_kg != null) && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                    <p style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6, fontWeight: 600 }}>OBJETIVOS</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      {b.target_muscle_kg != null && <InfoRow label="Músculo a ganar" value={`+${b.target_muscle_kg} kg`} />}
                      {b.target_fat_loss_kg != null && <InfoRow label="Grasa a perder" value={`-${b.target_fat_loss_kg} kg`} />}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state"><div className="icon">📊</div><p>No hay registros de bioimpedancia</p></div>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--border)', fontSize: 14 }}>
      <span style={{ color: 'var(--muted)' }}>{label}</span>
      <span style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function MeasureCard({ field, latest, prev }) {
  const val  = latest[field.key];
  const pval = prev?.[field.key];
  const diff = pval != null ? (val - pval).toFixed(1) : null;
  const up   = diff > 0;
  const isWeight = field.key === 'weight_kg';

  return (
    <div className="card" style={{ padding: '14px', textAlign: 'center' }}>
      <div style={{ fontSize: 24, marginBottom: 6 }}>{field.icon}</div>
      <div style={{ fontSize: 22, fontWeight: 800 }}>{val}<span style={{ fontSize: 13, fontWeight: 400 }}>{field.unit}</span></div>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>{field.label}</div>
      {diff != null && (
        <div style={{ fontSize: 12, fontWeight: 600, color: (isWeight ? !up : up) ? '#2D7A2D' : '#E05252' }}>
          {up ? '▲' : '▼'} {Math.abs(diff)}{field.unit}
        </div>
      )}
    </div>
  );
}
