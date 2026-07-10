import React, { useEffect, useState } from 'react';
import { AreaChart, Area, LineChart, Line, XAxis, Tooltip, ResponsiveContainer, ReferenceDot, BarChart, Bar, Cell, LabelList } from 'recharts';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const FIELDS = [
  { key: 'weight_kg', label: 'Peso', unit: 'kg', icon: '⚖️', zone: 'General' },
  { key: 'chest_cm',  label: 'Pecho', unit: 'cm', icon: '📏', zone: 'Tren superior' },
  { key: 'arm_cm',    label: 'Brazo', unit: 'cm', icon: '💪', zone: 'Tren superior' },
  { key: 'forearm_cm',label: 'Antebrazo', unit: 'cm', icon: '💪', zone: 'Tren superior' },
  { key: 'waist_cm',  label: 'Cintura', unit: 'cm', icon: '🎯', zone: 'Tren medio' },
  { key: 'hip_cm',    label: 'Cadera', unit: 'cm', icon: '📐', zone: 'Tren medio' },
  { key: 'thigh_cm',  label: 'Muslo', unit: 'cm', icon: '🦵', zone: 'Tren inferior' },
  { key: 'calf_cm',   label: 'Pantorrilla', unit: 'cm', icon: '🦵', zone: 'Tren inferior' },
];

const FIELD_ZONES = ['General', 'Tren superior', 'Tren medio', 'Tren inferior'];

const EMPTY = FIELDS.reduce((acc, f) => ({ ...acc, [f.key]: '' }), { notes: '' });

// Parsea fechas DATE de MySQL sin conversión UTC (evita el desfase de -5h)
function fmtDate(str, opts = { day: 'numeric', month: 'short' }) {
  if (!str) return '';
  const [y, m, d] = str.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es', opts);
}

export default function Measurements() {
  const { user } = useAuth();
  const [rows, setRows]         = useState([]);
  const [form, setForm]         = useState(EMPTY);
  const [saving, setSaving]     = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [open, setOpen]         = useState(false);
  const [tab, setTab]           = useState('current');
  const [bioList, setBioList]   = useState([]);
  const [bioFiles, setBioFiles] = useState([]);
  const [bioUploading, setBioUploading] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoadError(false);
    try {
      const [d, b] = await Promise.all([api.measurements.list(20), api.bioimpedance.list()]);
      setRows(d.measurements);
      setBioList(b.bioimpedance || []);
    } catch { setLoadError(true); }
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

  // For each field, find the most recent row that has a value
  const latestByField = FIELDS.reduce((acc, f) => {
    const row = rows.find(r => r[f.key] != null);
    if (row) acc[f.key] = row[f.key];
    return acc;
  }, {});
  const latest = rows[0];
  const prev   = rows[1];

  // Build chart data per field from all rows (oldest first)
  const chartData = [...rows].reverse().map(r => ({
    date: fmtDate(r.logged_at),
    ...FIELDS.reduce((acc, f) => ({ ...acc, [f.key]: r[f.key] ?? null }), {}),
  }));

  if (loadError) return <div className="empty-state"><div className="icon">📡</div><p>No se pudo cargar. Revisa tu conexión.</p><button className="btn-primary" style={{ marginTop: 16 }} onClick={load}>Reintentar</button></div>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Medidas 📏</h1>
        <button className="btn-primary" onClick={() => setOpen(!open)} style={{ padding: '10px 18px', fontSize: 14 }}>
          {open ? 'Cancelar' : '+ Registrar'}
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, background: 'var(--border)', padding: 4, borderRadius: 12 }}>
        {[{ key: 'current', icon: '📊', label: 'Actual' }, { key: 'progress', icon: '📈', label: 'Progreso' }, { key: 'bio', icon: '🔬', label: 'Bioimpedancia' }].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            flex: 1, padding: '8px 4px', borderRadius: 10, fontWeight: 700, border: 'none',
            background: tab === t.key ? 'var(--card)' : 'transparent',
            color: tab === t.key ? 'var(--coral)' : 'var(--muted)',
            boxShadow: tab === t.key ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
            cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
          }}>
            <span style={{ fontSize: 18 }}>{t.icon}</span>
            <span style={{ fontSize: 11 }}>{t.label}</span>
          </button>
        ))}
      </div>

      {tab === 'current' && open && (
        <form onSubmit={handleSubmit} className="card" style={{ marginBottom: 20 }}>
          <p style={{ fontWeight: 700, marginBottom: 16 }}>Nueva medición</p>
          {FIELD_ZONES.map(zone => (
            <div key={zone} style={{ marginBottom: 14 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', letterSpacing: 0.5, marginBottom: 8, textTransform: 'uppercase' }}>{zone}</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {FIELDS.filter(f => f.zone === zone).map(f => (
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
            </div>
          ))}
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

      {/* TAB: Actual */}
      {tab === 'current' && (
        <>
          {latest ? (
            <div style={{ marginBottom: 20 }}>
              {FIELD_ZONES.map(zone => {
                const zoneFields = FIELDS.filter(f => f.zone === zone && latestByField[f.key] != null);
                if (zoneFields.length === 0) return null;
                return (
                  <div key={zone} style={{ marginBottom: 16 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', letterSpacing: 0.5, marginBottom: 8, textTransform: 'uppercase' }}>{zone}</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      {zoneFields.map(f => (
                        <MeasureCard key={f.key} field={f} value={latestByField[f.key]} prev={rows.slice(1).find(r => r[f.key] != null)?.[f.key]} unit={f.unit} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty-state"><div className="icon">📏</div><p>Aún no hay medidas registradas</p></div>
          )}

          {rows.length > 1 && (
            <>
              <p className="label" style={{ marginBottom: 10 }}>Historial</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {rows.slice(1).map(row => (
                  <div key={row.id} className="card" style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontWeight: 700 }}>{fmtDate(row.logged_at, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
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
        </>
      )}

      {/* TAB: Progreso */}
      {tab === 'progress' && (
        <>
          {bioList.length >= 2 && <BioBarCharts bioimpedance={bioList} />}
          {chartData.length < 2 ? (
            bioList.length < 2 ? <div className="empty-state"><div className="icon">📈</div><p>Necesitas al menos 2 registros para ver el progreso</p></div> : null
          ) : (
            <ProgressTab chartData={chartData} />
          )}
        </>
      )}

      {/* TAB: Bioimpedancia */}
      {tab === 'bio' && <div style={{ marginTop: 4 }}>
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
                <p style={{ fontWeight: 700, marginBottom: 10 }}>{fmtDate(b.logged_at, { day: 'numeric', month: 'long', year: 'numeric' })}</p>
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
                {b.ai_summary && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)', background: 'var(--coral-light)', borderRadius: 10, padding: 10 }}>
                    <p style={{ fontSize: 11, color: 'var(--coral)', fontWeight: 700, marginBottom: 6 }}>✨ Análisis de Lorena</p>
                    <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text)' }}>{b.ai_summary}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state"><div className="icon">📊</div><p>No hay registros de bioimpedancia</p></div>
        )}
      </div>}
    </div>
  );
}

const BIO_BAR_METRICS = [
  { key: 'weight_kg',          label: 'Peso',           unit: 'kg',   color: '#457B9D' },
  { key: 'body_fat_pct',       label: '% Grasa',        unit: '%',    color: '#FF6B6B' },
  { key: 'muscle_mass_kg',     label: 'Músculo',        unit: 'kg',   color: '#06D6A0' },
  { key: 'skeletal_muscle_kg', label: 'M. Esquelético', unit: 'kg',   color: '#2A9D8F' },
  { key: 'body_fat_kg',        label: 'Peso grasa',     unit: 'kg',   color: '#F4A261' },
  { key: 'body_water_pct',     label: '% Agua',         unit: '%',    color: '#00BBF9' },
  { key: 'visceral_fat',       label: 'Grasa visceral', unit: '',     color: '#E76F51' },
  { key: 'bmr_kcal',           label: 'Metabolismo',    unit: 'kcal', color: '#FF9F1C' },
];

function BioBarCharts({ bioimpedance }) {
  if (!bioimpedance || bioimpedance.length < 2) return null;
  const sorted = [...bioimpedance].reverse();
  const active = BIO_BAR_METRICS.filter(m => sorted.some(b => b[m.key] != null));
  if (!active.length) return null;

  return (
    <div style={{ marginBottom: 20 }}>
      <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>📊 Comparativa bioimpedancia</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {active.map(m => {
          const data = sorted.map(b => ({ date: b.logged_at ? b.logged_at.slice(5, 10).replace('-', '/') : '', value: b[m.key] != null ? Number(b[m.key]) : null })).filter(d => d.value != null);
          if (data.length < 2) return null;
          const first = data[0].value, last = data[data.length - 1].value;
          const diff = +(last - first).toFixed(2);
          const isGood = ['muscle_mass_kg','skeletal_muscle_kg','body_water_pct','bmr_kcal'].includes(m.key) ? diff >= 0 : diff <= 0;
          return (
            <div key={m.key} className="card" style={{ padding: '14px 14px 6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <p style={{ fontWeight: 700, fontSize: 13 }}>{m.label}</p>
                <span style={{ fontSize: 12, fontWeight: 700, color: diff === 0 ? 'var(--muted)' : isGood ? '#16a34a' : '#dc2626' }}>
                  {diff > 0 ? '+' : ''}{diff}{m.unit ? ' ' + m.unit : ''}
                </span>
              </div>
              <ResponsiveContainer width="100%" height={data.length * 36 + 20}>
                <BarChart data={data} layout="vertical" margin={{ top: 0, right: 48, left: 48, bottom: 0 }} barSize={20}>
                  <XAxis type="number" domain={['auto', 'auto']} hide />
                  <YAxis type="category" dataKey="date" tick={{ fontSize: 11, fill: 'var(--muted)' }} width={40} axisLine={false} tickLine={false} />
                  <Tooltip formatter={v => [`${v} ${m.unit}`, m.label]} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)' }} />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]} background={{ fill: 'var(--surface)', radius: 6 }}>
                    {data.map((_, i) => <Cell key={i} fill={i === data.length - 1 ? m.color : m.color + '99'} />)}
                    <LabelList dataKey="value" position="right" formatter={v => `${v}${m.unit}`} style={{ fontSize: 11, fontWeight: 700, fill: 'var(--text)' }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MetricCard({ s, idPrefix = 'grad' }) {
  const color = s.good ? '#16a34a' : s.diff === 0 ? '#6b7280' : '#dc2626';
  const gradId = `${idPrefix}-${s.key}`;
  const fewData = s.pts.length < 4;

  return (
    <div className="card" style={{ borderTop: `3px solid ${color}`, paddingTop: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: fewData ? 14 : 10 }}>
        <div>
          <p style={{ fontWeight: 700, fontSize: 15 }}>{s.icon} {s.label}</p>
          <p style={{ fontSize: 12, color, fontWeight: 700, marginTop: 2 }}>
            {s.diff > 0 ? '▲ +' : s.diff < 0 ? '▼ ' : ''}{s.diff} {s.unit}
            <span style={{ fontWeight: 400, color: 'var(--muted)', marginLeft: 6 }}>desde inicio</span>
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: 22, fontWeight: 800, color }}>{s.last}<span style={{ fontSize: 12, fontWeight: 400 }}> {s.unit}</span></p>
          <p style={{ fontSize: 11, color: 'var(--muted)' }}>antes: {s.first} {s.unit}</p>
        </div>
      </div>

      {fewData ? (
        /* Before/after visual for sparse data */
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0' }}>
          <div style={{ flex: 1, background: 'var(--bg)', borderRadius: 12, padding: '10px 14px', textAlign: 'center' }}>
            <p style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>{s.pts[0].date}</p>
            <p style={{ fontSize: 20, fontWeight: 800, color: 'var(--muted)' }}>{s.first}<span style={{ fontSize: 11, fontWeight: 400 }}> {s.unit}</span></p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{ fontSize: 22, color }}>
              {s.diff < 0 ? '▼' : s.diff > 0 ? '▲' : '→'}
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color, background: color + '18', borderRadius: 8, padding: '2px 8px' }}>
              {s.diff > 0 ? '+' : ''}{s.diff} {s.unit}
            </div>
          </div>
          <div style={{ flex: 1, background: color + '12', borderRadius: 12, padding: '10px 14px', textAlign: 'center', border: `1.5px solid ${color}30` }}>
            <p style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>{s.pts[s.pts.length - 1].date}</p>
            <p style={{ fontSize: 20, fontWeight: 800, color }}>{s.last}<span style={{ fontSize: 11, fontWeight: 400 }}> {s.unit}</span></p>
          </div>
        </div>
      ) : (
        /* Area chart for 4+ data points */
        <ResponsiveContainer width="100%" height={90}>
          <AreaChart data={s.pts} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.25} />
                <stop offset="95%" stopColor={color} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
            <Tooltip formatter={v => [`${v} ${s.unit}`, s.label]} contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 2px 12px rgba(0,0,0,0.12)', fontSize: 13 }} />
            <Area type="monotone" dataKey={s.key} stroke={color} strokeWidth={2.5} fill={`url(#${gradId})`}
              dot={(props) => {
                const isFirst = props.index === 0;
                const isLast  = props.index === s.pts.length - 1;
                if (!isFirst && !isLast) return <g key={props.key} />;
                return <circle key={props.key} cx={props.cx} cy={props.cy} r={5} fill={color} stroke="#fff" strokeWidth={2} />;
              }}
              connectNulls
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

function ProgressTab({ chartData }) {
  // Compute per-field stats
  const fieldStats = FIELDS.map(f => {
    const pts = chartData.filter(d => d[f.key] != null);
    if (pts.length < 2) return null;
    const first = pts[0][f.key];
    const last  = pts[pts.length - 1][f.key];
    const diff  = parseFloat((last - first).toFixed(1));
    const isWeight = f.key === 'weight_kg';
    const good = isWeight ? diff < 0 : diff > 0;
    return { ...f, pts, first, last, diff, good };
  }).filter(Boolean);

  if (!fieldStats.length) return <div className="empty-state"><div className="icon">📈</div><p>Sin datos suficientes</p></div>;

  // Find the biggest "win" to highlight
  const wins = fieldStats.filter(s => s.good);
  const bestWin = wins.sort((a, b) => {
    const aScore = Math.abs(a.diff) / Math.abs(a.first) * 100;
    const bScore = Math.abs(b.diff) / Math.abs(b.first) * 100;
    return bScore - aScore;
  })[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Hero achievement card */}
      {bestWin && (
        <div style={{
          background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
          borderRadius: 18, padding: '20px 22px', color: '#fff',
          display: 'flex', alignItems: 'center', gap: 16,
        }}>
          <div style={{ fontSize: 40 }}>🏆</div>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, opacity: 0.8, letterSpacing: 1, marginBottom: 4 }}>MAYOR LOGRO</p>
            <p style={{ fontSize: 20, fontWeight: 800, marginBottom: 2 }}>
              {bestWin.key === 'weight_kg' ? '▼' : '▲'} {Math.abs(bestWin.diff)} {bestWin.unit} de {bestWin.label}
            </p>
            <p style={{ fontSize: 13, opacity: 0.85 }}>
              {bestWin.first} → {bestWin.last} {bestWin.unit} · {bestWin.pts.length} mediciones
            </p>
          </div>
        </div>
      )}

      {/* Per-metric cards */}
      {fieldStats.map(s => <MetricCard key={s.key} s={s} idPrefix="grad" />)}
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

function MeasureCard({ field, value: val, prev: pval }) {
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
