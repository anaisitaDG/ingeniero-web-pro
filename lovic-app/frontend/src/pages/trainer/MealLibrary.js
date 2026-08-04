import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../../services/api';

const MEAL_TYPES = [
  { value: 'desayuno', label: '🌅 Desayuno' },
  { value: 'almuerzo', label: '☀️ Almuerzo' },
  { value: 'merienda', label: '🍎 Merienda' },
  { value: 'cena',     label: '🌙 Cena' },
];
const ZONE_LABEL = { superior: '💪 Superior', inferior: '🦵 Inferior' };
const EMPTY_FORM = { name: '', description: '', meal_type: 'desayuno', body_zone: '', calories: '', protein_g: '', carbs_g: '', fat_g: '' };

export default function MealLibrary() {
  const [meals, setMeals]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [search, setSearch]   = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterZone, setFilterZone] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]   = useState(null);
  const [form, setForm]         = useState(EMPTY_FORM);
  const [saving, setSaving]     = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setLoadError(false);
    try { const res = await api.trainer.getMealLibrary(); setMeals(res.meals || []); }
    catch { setLoadError(true); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function saveMeal() {
    if (!form.name.trim()) return alert('Nombre requerido');
    setSaving(true);
    try {
      if (editing) {
        await api.trainer.updateMealLibrary(editing.id, form);
        setMeals(prev => prev.map(m => m.id === editing.id ? { ...m, ...form } : m));
      } else {
        const { id } = await api.trainer.addMealLibrary(form);
        setMeals(prev => [...prev, { ...form, id }]);
      }
      setShowForm(false); setEditing(null); setForm(EMPTY_FORM);
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  }

  async function deleteMeal(m) {
    if (!window.confirm(`¿Eliminar "${m.name}" de la biblioteca?`)) return;
    try { await api.trainer.deleteMealLibrary(m.id); setMeals(prev => prev.filter(x => x.id !== m.id)); }
    catch (e) { alert(e.message); }
  }

  function openAdd(mealType) { setEditing(null); setForm({ ...EMPTY_FORM, meal_type: mealType || 'desayuno' }); setShowForm(true); }
  function openEdit(m) {
    setEditing(m);
    setForm({
      name: m.name, description: m.description || '', meal_type: m.meal_type, body_zone: m.body_zone || '',
      calories: m.calories ?? '', protein_g: m.protein_g ?? '', carbs_g: m.carbs_g ?? '', fat_g: m.fat_g ?? '',
    });
    setShowForm(true);
  }

  const filtered = meals.filter(m =>
    (!filterType || m.meal_type === filterType) &&
    (!filterZone || m.body_zone === filterZone || (filterZone === '_none' && !m.body_zone)) &&
    (!search || m.name.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800 }}>🍽️ Biblioteca de Comidas</h1>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 2 }}>{meals.length} comidas guardadas</p>
        </div>
        <button className="btn-primary" onClick={() => openAdd()} style={{ padding: '10px 18px', fontSize: 14 }}>+ Nueva comida</button>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <input className="input" placeholder="Buscar comida..." value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1, minWidth: 160 }} />
        <select className="input" value={filterType} onChange={e => setFilterType(e.target.value)} style={{ width: 'auto' }}>
          <option value="">Todos los momentos</option>
          {MEAL_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <select className="input" value={filterZone} onChange={e => setFilterZone(e.target.value)} style={{ width: 'auto' }}>
          <option value="">Todas las zonas</option>
          <option value="superior">💪 Superior</option>
          <option value="inferior">🦵 Inferior</option>
          <option value="_none">Sin zona</option>
        </select>
      </div>

      {/* Modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="card" style={{ width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}>
            <p style={{ fontWeight: 800, fontSize: 16, marginBottom: 16 }}>{editing ? '✏️ Editar comida' : '+ Nueva comida'}</p>

            <label className="label">Nombre *</label>
            <input className="input" placeholder="Ej: Avena con fruta y huevos"
              value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={{ marginBottom: 12 }} />

            <label className="label">Descripción / preparación</label>
            <textarea className="input" rows={2} placeholder="Ej: 1/2 taza de avena, 1 banano, 2 huevos revueltos"
              value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={{ marginBottom: 12, resize: 'vertical' }} />

            <label className="label">Momento *</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, marginBottom: 12 }}>
              {MEAL_TYPES.map(t => (
                <button key={t.value} type="button" onClick={() => setForm(f => ({ ...f, meal_type: t.value }))} style={{
                  padding: '9px 4px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  border: form.meal_type === t.value ? '2px solid var(--coral)' : '1px solid var(--border)',
                  background: form.meal_type === t.value ? 'var(--coral-light)' : 'var(--card)',
                  color: form.meal_type === t.value ? 'var(--coral)' : 'var(--muted)',
                }}>{t.label}</button>
              ))}
            </div>

            <label className="label">Zona (para qué tipo de día es)</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {[['', 'Cualquiera'], ['superior', '💪 Superior'], ['inferior', '🦵 Inferior']].map(([val, lbl]) => (
                <button key={val} type="button" onClick={() => setForm(f => ({ ...f, body_zone: val }))} style={{
                  flex: 1, padding: '9px 6px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  border: form.body_zone === val ? '2px solid var(--coral)' : '1px solid var(--border)',
                  background: form.body_zone === val ? 'var(--coral-light)' : 'var(--card)',
                  color: form.body_zone === val ? 'var(--coral)' : 'var(--muted)',
                }}>{lbl}</button>
              ))}
            </div>

            <label className="label">Calorías y macros (opcional)</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 20 }}>
              <div><input className="input" type="number" min="0" placeholder="kcal" value={form.calories} onChange={e => setForm(f => ({ ...f, calories: e.target.value }))} /><p style={{ fontSize: 10, color: 'var(--muted)', textAlign: 'center', marginTop: 2 }}>kcal</p></div>
              <div><input className="input" type="number" min="0" placeholder="P" value={form.protein_g} onChange={e => setForm(f => ({ ...f, protein_g: e.target.value }))} /><p style={{ fontSize: 10, color: 'var(--muted)', textAlign: 'center', marginTop: 2 }}>Prot</p></div>
              <div><input className="input" type="number" min="0" placeholder="C" value={form.carbs_g} onChange={e => setForm(f => ({ ...f, carbs_g: e.target.value }))} /><p style={{ fontSize: 10, color: 'var(--muted)', textAlign: 'center', marginTop: 2 }}>Carbs</p></div>
              <div><input className="input" type="number" min="0" placeholder="G" value={form.fat_g} onChange={e => setForm(f => ({ ...f, fat_g: e.target.value }))} /><p style={{ fontSize: 10, color: 'var(--muted)', textAlign: 'center', marginTop: 2 }}>Grasa</p></div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn-ghost" onClick={() => setShowForm(false)} style={{ flex: 1 }}>Cancelar</button>
              <button className="btn-primary" onClick={saveMeal} disabled={saving} style={{ flex: 2, justifyContent: 'center' }}>
                {saving ? <span className="spinner" /> : (editing ? 'Guardar cambios' : 'Agregar a biblioteca')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lista agrupada por momento */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}><div className="spinner" style={{ borderTopColor: 'var(--coral)', borderColor: 'var(--border)', width: 32, height: 32 }} /></div>
      ) : loadError ? (
        <div className="empty-state"><div className="icon">📡</div><p>No se pudo cargar la biblioteca.</p><button className="btn-primary" style={{ marginTop: 16 }} onClick={load}>Reintentar</button></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state"><div className="icon">🍽️</div><p>{search || filterType || filterZone ? 'No se encontraron comidas' : 'Tu biblioteca de comidas está vacía. ¡Agrega la primera!'}</p></div>
      ) : (
        MEAL_TYPES.filter(t => filtered.some(m => m.meal_type === t.value)).map(t => (
          <div key={t.value} style={{ marginBottom: 24 }}>
            <p style={{ fontWeight: 800, fontSize: 13, color: 'var(--coral)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>{t.label}</p>
            {filtered.filter(m => m.meal_type === t.value).map(m => (
              <div key={m.id} className="card" style={{ marginBottom: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 700, fontSize: 15 }}>
                    {m.name}
                    {m.body_zone && <span style={{ fontSize: 11, fontWeight: 700, marginLeft: 8, padding: '2px 8px', borderRadius: 6, background: 'var(--coral-light)', color: 'var(--coral)' }}>{ZONE_LABEL[m.body_zone]}</span>}
                  </p>
                  {m.description && <p style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 3 }}>{m.description}</p>}
                  {(m.calories != null) && (
                    <p style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 4 }}>
                      🔥 {m.calories} kcal
                      {m.protein_g != null ? ` · P ${m.protein_g}g` : ''}{m.carbs_g != null ? ` · C ${m.carbs_g}g` : ''}{m.fat_g != null ? ` · G ${m.fat_g}g` : ''}
                    </p>
                  )}
                </div>
                <button onClick={() => openEdit(m)} style={{ background: 'var(--bg)', border: 'none', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontSize: 14 }}>✏️</button>
                <button onClick={() => deleteMeal(m)} style={{ background: 'none', border: 'none', padding: '6px 8px', cursor: 'pointer', fontSize: 16, color: 'var(--muted)' }}>✕</button>
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );
}
