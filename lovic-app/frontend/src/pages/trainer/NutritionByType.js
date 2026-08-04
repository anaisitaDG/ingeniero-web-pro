import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../../services/api';

const MEAL_TYPES = [
  { value: 'desayuno', label: '🌅 Desayuno' },
  { value: 'almuerzo', label: '☀️ Almuerzo' },
  { value: 'merienda', label: '🍎 Merienda' },
  { value: 'cena',     label: '🌙 Cena' },
];
const ZONES = [
  { value: 'superior', label: '💪 Tren superior' },
  { value: 'inferior', label: '🦵 Tren inferior' },
];

export default function NutritionByType({ clientId }) {
  const [mode, setMode]       = useState('simple'); // simple | rotativo
  const [slots, setSlots]     = useState([]);       // { _key, week_no, body_zone, meal_type, library_id, name, description, calories, protein_g, carbs_g, fat_g, sort_order }
  const [library, setLibrary] = useState([]);
  const [week, setWeek]       = useState(1);
  const [zone, setZone]       = useState('superior');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [picker, setPicker]   = useState(null);     // { meal_type } cuando se está eligiendo

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cfg, lib] = await Promise.all([
        api.trainer.getNutritionConfig(clientId),
        api.trainer.getMealLibrary(),
      ]);
      setMode(cfg.nutrition_mode || 'simple');
      setSlots((cfg.slots || []).map(s => ({ ...s, _key: s.id || Math.random() })));
      setLibrary(lib.meals || []);
    } catch (e) { /* ignore */ }
    finally { setLoading(false); }
  }, [clientId]);
  useEffect(() => { load(); }, [load]);

  async function changeMode(newMode) {
    if (newMode === mode) return;
    setMode(newMode);
    if (newMode === 'simple') setWeek(1);
    try { await api.trainer.setNutritionMode(clientId, newMode); } catch { /* ignore */ }
  }

  const weeks = mode === 'rotativo' ? [1, 2, 3, 4] : [1];
  const effWeek = mode === 'simple' ? 1 : week;

  function slotsFor(mealType) {
    return slots
      .filter(s => s.week_no === effWeek && s.body_zone === zone && s.meal_type === mealType)
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  }

  function addFromLibrary(meal) {
    setSlots(prev => [...prev, {
      _key: Math.random(), week_no: effWeek, body_zone: zone, meal_type: picker.meal_type,
      library_id: meal.id, name: meal.name, description: meal.description,
      calories: meal.calories, protein_g: meal.protein_g, carbs_g: meal.carbs_g, fat_g: meal.fat_g,
      sort_order: slotsFor(picker.meal_type).length,
    }]);
    setPicker(null);
  }

  function removeSlot(key) { setSlots(prev => prev.filter(s => s._key !== key)); }

  function copyZone(fromZone) {
    const src = slots.filter(s => s.week_no === effWeek && s.body_zone === fromZone);
    setSlots(prev => [
      ...prev.filter(s => !(s.week_no === effWeek && s.body_zone === zone)),
      ...src.map(s => ({ ...s, _key: Math.random(), body_zone: zone })),
    ]);
  }
  function copyWeek(fromWeek) {
    const src = slots.filter(s => s.week_no === fromWeek);
    setSlots(prev => [
      ...prev.filter(s => s.week_no !== effWeek),
      ...src.map(s => ({ ...s, _key: Math.random(), week_no: effWeek })),
    ]);
  }

  async function save() {
    setSaving(true);
    try {
      await api.trainer.saveMealSlots(clientId, slots);
      setSaveMsg('✅ Nutrición guardada'); setTimeout(() => setSaveMsg(''), 3000);
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 40 }}><div className="spinner" style={{ borderTopColor: 'var(--coral)', borderColor: 'var(--border)', width: 28, height: 28 }} /></div>;

  // Comidas de biblioteca disponibles para el picker: del momento pedido, priorizando la zona actual
  const pickerMeals = picker ? library
    .filter(m => m.meal_type === picker.meal_type)
    .filter(m => !m.body_zone || m.body_zone === zone)
    .sort((a, b) => (b.body_zone === zone ? 1 : 0) - (a.body_zone === zone ? 1 : 0)) : [];

  return (
    <div>
      {/* Modo */}
      <div className="card" style={{ marginBottom: 14, padding: 14 }}>
        <p style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Modo de nutrición</p>
        <div style={{ display: 'flex', gap: 8 }}>
          {[['simple', '🔁 Simple', 'Se repite las 4 semanas'], ['rotativo', '🗓️ Rotativo', '4 semanas distintas']].map(([val, lbl, desc]) => (
            <button key={val} onClick={() => changeMode(val)} style={{
              flex: 1, padding: '10px 8px', borderRadius: 12, cursor: 'pointer', textAlign: 'center',
              border: mode === val ? '2px solid var(--gold)' : '1px solid var(--border)',
              background: mode === val ? 'var(--gold-light)' : 'var(--card)',
            }}>
              <div style={{ fontWeight: 800, fontSize: 13, color: mode === val ? 'var(--gold)' : 'var(--text)' }}>{lbl}</div>
              <div style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 2 }}>{desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Semana (solo rotativo) */}
      {mode === 'rotativo' && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          {weeks.map(w => {
            const n = slots.filter(s => s.week_no === w).length;
            return (
            <button key={w} onClick={() => setWeek(w)} style={{
              flex: 1, padding: '8px 4px', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 12,
              background: week === w ? 'var(--gold)' : 'var(--card)', color: week === w ? '#fff' : 'var(--muted)', boxShadow: 'var(--shadow)',
            }}>Semana {w}{n > 0 && <span style={{ display: 'block', fontSize: 9, opacity: 0.8 }}>{n} comidas</span>}</button>
          );})}
        </div>
      )}

      {/* Zona */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        {ZONES.map(z => (
          <button key={z.value} onClick={() => setZone(z.value)} style={{
            flex: 1, padding: '10px', borderRadius: 12, cursor: 'pointer', fontWeight: 800, fontSize: 13,
            border: zone === z.value ? '2px solid var(--coral)' : '1px solid var(--border)',
            background: zone === z.value ? 'var(--coral)' : 'var(--card)', color: zone === z.value ? '#fff' : 'var(--muted)',
          }}>{z.label}</button>
        ))}
      </div>

      {/* Atajos de copia */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <select onChange={e => { if (e.target.value) copyZone(e.target.value); e.target.value = ''; }}
          style={{ fontSize: 11.5, padding: '4px 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--muted)', cursor: 'pointer' }}>
          <option value="">Copiar de otra zona…</option>
          {ZONES.filter(z => z.value !== zone).map(z => <option key={z.value} value={z.value}>{z.label}</option>)}
        </select>
        {mode === 'rotativo' && (
          <select onChange={e => { if (e.target.value) copyWeek(Number(e.target.value)); e.target.value = ''; }}
            style={{ fontSize: 11.5, padding: '4px 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--muted)', cursor: 'pointer' }}>
            <option value="">Copiar de otra semana…</option>
            {weeks.filter(w => w !== effWeek).map(w => <option key={w} value={w}>Semana {w}</option>)}
          </select>
        )}
      </div>

      {/* Momentos */}
      {MEAL_TYPES.map(mt => {
        const items = slotsFor(mt.value);
        return (
          <div key={mt.value} className="card" style={{ marginBottom: 12, padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <p style={{ fontWeight: 700, fontSize: 14 }}>{mt.label}</p>
              <button onClick={() => setPicker({ meal_type: mt.value })} style={{
                background: 'var(--coral)', color: '#fff', border: 'none', borderRadius: 8, padding: '4px 12px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              }}>+ Agregar</button>
            </div>
            {items.length === 0 && <p style={{ fontSize: 13, color: 'var(--muted)', fontStyle: 'italic' }}>Sin comida — toca "Agregar" (puedes poner varias, ej. 2 meriendas)</p>}
            {items.map(s => (
              <div key={s._key} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 0', borderTop: '1px solid var(--border)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 600, fontSize: 14 }}>{s.name}</p>
                  {s.description && <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{s.description}</p>}
                  {s.calories != null && <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>🔥 {s.calories} kcal{s.protein_g != null ? ` · P ${s.protein_g}` : ''}{s.carbs_g != null ? ` · C ${s.carbs_g}` : ''}{s.fat_g != null ? ` · G ${s.fat_g}` : ''}</p>}
                </div>
                <button onClick={() => removeSlot(s._key)} style={{ background: 'none', border: 'none', color: '#E05252', fontSize: 20, cursor: 'pointer', flexShrink: 0 }}>×</button>
              </div>
            ))}
          </div>
        );
      })}

      <button className="btn-primary" onClick={save} disabled={saving} style={{ width: '100%', justifyContent: 'center', background: 'var(--gold)', marginTop: 4 }}>
        {saving ? <><span className="spinner" /> Guardando…</> : '💾 Guardar nutrición'}
      </button>
      {saveMsg && <p style={{ textAlign: 'center', color: '#2D9B5A', fontWeight: 700, fontSize: 13, marginTop: 8 }}>{saveMsg}</p>}

      {/* Picker de biblioteca */}
      {picker && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={e => e.target === e.currentTarget && setPicker(null)}>
          <div className="card" style={{ width: '100%', maxWidth: 520, maxHeight: '80vh', overflowY: 'auto', borderRadius: '20px 20px 0 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <p style={{ fontWeight: 800, fontSize: 15 }}>Elegir {MEAL_TYPES.find(m => m.value === picker.meal_type)?.label} · {ZONES.find(z => z.value === zone)?.label}</p>
              <button onClick={() => setPicker(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--muted)' }}>✕</button>
            </div>
            {pickerMeals.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--muted)', padding: '20px 0', textAlign: 'center' }}>
                No hay comidas de este momento en tu biblioteca.<br />Agrégalas primero en la pestaña <b>🍽️ Comidas</b>.
              </p>
            ) : pickerMeals.map(m => (
              <button key={m.id} onClick={() => addFromLibrary(m)} style={{
                width: '100%', textAlign: 'left', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12,
                padding: 12, marginBottom: 8, cursor: 'pointer',
              }}>
                <p style={{ fontWeight: 700, fontSize: 14 }}>
                  {m.name}
                  {m.body_zone && <span style={{ fontSize: 10.5, fontWeight: 700, marginLeft: 6, padding: '1px 6px', borderRadius: 5, background: 'var(--coral-light)', color: 'var(--coral)' }}>{m.body_zone === 'superior' ? '💪' : '🦵'}</span>}
                </p>
                {m.description && <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{m.description}</p>}
                {m.calories != null && <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>🔥 {m.calories} kcal</p>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
