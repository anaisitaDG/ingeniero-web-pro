import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../../services/api';

const MUSCLE_GROUPS = [
  'Pecho', 'Espalda', 'Hombros', 'Bíceps', 'Tríceps', 'Antebrazos',
  'Core / Abdomen', 'Cuádriceps', 'Isquiotibiales', 'Glúteos', 'Pantorrillas',
  'Cuerpo completo', 'Cardio', 'Otro',
];

const EMPTY_FORM = { name: '', muscle_group: '', youtube_url: '', notes: '' };
const EMPTY_VAR  = { name: '', youtube_url: '' };

export default function ExerciseLibrary() {
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [filterGroup, setFilterGroup] = useState('');

  const [showForm, setShowForm]   = useState(false);
  const [editing, setEditing]     = useState(null); // exercise being edited
  const [form, setForm]           = useState(EMPTY_FORM);
  const [saving, setSaving]       = useState(false);

  const [expandedId, setExpandedId] = useState(null);
  const [varForm, setVarForm]       = useState({});   // { [exId]: { name, youtube_url } }
  const [addingVar, setAddingVar]   = useState(null); // exId

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.trainer.getLibrary();
      setExercises(res.exercises || []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function saveExercise() {
    if (!form.name.trim()) return alert('Nombre requerido');
    setSaving(true);
    try {
      if (editing) {
        await api.trainer.updateLibrary(editing.id, form);
        setExercises(prev => prev.map(e => e.id === editing.id ? { ...e, ...form, variations: e.variations } : e));
      } else {
        const created = await api.trainer.addLibrary(form);
        setExercises(prev => [...prev, created]);
      }
      setShowForm(false);
      setEditing(null);
      setForm(EMPTY_FORM);
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  }

  async function deleteExercise(ex) {
    if (!window.confirm(`¿Eliminar "${ex.name}" de la biblioteca?`)) return;
    try {
      await api.trainer.deleteLibrary(ex.id);
      setExercises(prev => prev.filter(e => e.id !== ex.id));
    } catch (e) { alert(e.message); }
  }

  async function saveVariation(exId) {
    const v = varForm[exId] || {};
    if (!v.name?.trim()) return alert('Nombre requerido');
    try {
      const created = await api.trainer.addVariation(exId, v);
      setExercises(prev => prev.map(e => e.id === exId ? { ...e, variations: [...(e.variations || []), created] } : e));
      setVarForm(f => ({ ...f, [exId]: EMPTY_VAR }));
      setAddingVar(null);
    } catch (e) { alert(e.message); }
  }

  async function deleteVariation(exId, varId) {
    try {
      await api.trainer.deleteVariation(varId);
      setExercises(prev => prev.map(e => e.id === exId ? { ...e, variations: e.variations.filter(v => v.id !== varId) } : e));
    } catch (e) { alert(e.message); }
  }

  function openAdd() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function openEdit(ex) {
    setEditing(ex);
    setForm({ name: ex.name, muscle_group: ex.muscle_group || '', youtube_url: ex.youtube_url || '', notes: ex.notes || '' });
    setShowForm(true);
  }

  const grouped = {};
  const filtered = exercises.filter(e =>
    (!filterGroup || e.muscle_group === filterGroup) &&
    (!search || e.name.toLowerCase().includes(search.toLowerCase()))
  );
  for (const ex of filtered) {
    const g = ex.muscle_group || 'Sin grupo';
    if (!grouped[g]) grouped[g] = [];
    grouped[g].push(ex);
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800 }}>📚 Biblioteca de Ejercicios</h1>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 2 }}>{exercises.length} ejercicios guardados</p>
        </div>
        <button className="btn-primary" onClick={openAdd} style={{ padding: '10px 18px', fontSize: 14 }}>
          + Nuevo ejercicio
        </button>
      </div>

      {/* Search & filter */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <input className="input" placeholder="Buscar ejercicio..." value={search}
          onChange={e => setSearch(e.target.value)} style={{ flex: 1 }} />
        <select className="input" value={filterGroup} onChange={e => setFilterGroup(e.target.value)}
          style={{ width: 'auto', minWidth: 160 }}>
          <option value="">Todos los grupos</option>
          {MUSCLE_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
      </div>

      {/* Form modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="card" style={{ width: '100%', maxWidth: 480 }}>
            <p style={{ fontWeight: 800, fontSize: 16, marginBottom: 16 }}>
              {editing ? '✏️ Editar ejercicio' : '+ Nuevo ejercicio'}
            </p>
            <label className="label">Nombre del ejercicio *</label>
            <input className="input" placeholder="Ej: Sentadilla en Smith"
              value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              style={{ marginBottom: 12 }} />
            <label className="label">Grupo muscular</label>
            <select className="input" value={form.muscle_group} onChange={e => setForm(f => ({ ...f, muscle_group: e.target.value }))}
              style={{ marginBottom: 12 }}>
              <option value="">Sin grupo</option>
              {MUSCLE_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
            <label className="label">Link de YouTube</label>
            <input className="input" placeholder="https://youtube.com/..."
              value={form.youtube_url} onChange={e => setForm(f => ({ ...f, youtube_url: e.target.value }))}
              style={{ marginBottom: 12 }} />
            <label className="label">Notas / indicaciones</label>
            <input className="input" placeholder="Ej: Máquina Smith, enfoque en excéntrico"
              value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              style={{ marginBottom: 20 }} />
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn-ghost" onClick={() => setShowForm(false)} style={{ flex: 1 }}>Cancelar</button>
              <button className="btn-primary" onClick={saveExercise} disabled={saving} style={{ flex: 2, justifyContent: 'center' }}>
                {saving ? <span className="spinner" /> : (editing ? 'Guardar cambios' : 'Agregar a biblioteca')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Exercises list */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <div className="spinner" style={{ borderTopColor: 'var(--coral)', borderColor: 'var(--border)', width: 32, height: 32 }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="icon">📚</div>
          <p>{search || filterGroup ? 'No se encontraron ejercicios' : 'Tu biblioteca está vacía. ¡Agrega tu primer ejercicio!'}</p>
        </div>
      ) : (
        Object.entries(grouped).map(([group, exs]) => (
          <div key={group} style={{ marginBottom: 24 }}>
            <p style={{ fontWeight: 800, fontSize: 13, color: 'var(--coral)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
              {group}
            </p>
            {exs.map(ex => (
              <ExerciseCard
                key={ex.id}
                ex={ex}
                expanded={expandedId === ex.id}
                onToggle={() => setExpandedId(expandedId === ex.id ? null : ex.id)}
                onEdit={() => openEdit(ex)}
                onDelete={() => deleteExercise(ex)}
                addingVar={addingVar === ex.id}
                varFormValue={varForm[ex.id] || EMPTY_VAR}
                onVarFormChange={v => setVarForm(f => ({ ...f, [ex.id]: { ...(f[ex.id] || EMPTY_VAR), ...v } }))}
                onStartAddVar={() => setAddingVar(ex.id)}
                onCancelAddVar={() => setAddingVar(null)}
                onSaveVar={() => saveVariation(ex.id)}
                onDeleteVar={varId => deleteVariation(ex.id, varId)}
              />
            ))}
          </div>
        ))
      )}
    </div>
  );
}

function ExerciseCard({ ex, expanded, onToggle, onEdit, onDelete, addingVar, varFormValue, onVarFormChange, onStartAddVar, onCancelAddVar, onSaveVar, onDeleteVar }) {
  return (
    <div className="card" style={{ marginBottom: 10, padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, cursor: 'pointer' }} onClick={onToggle}>
          <p style={{ fontWeight: 700, fontSize: 15 }}>{ex.name}</p>
          {ex.notes && <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{ex.notes}</p>}
          <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
            {ex.youtube_url && (
              <a href={ex.youtube_url} target="_blank" rel="noreferrer"
                onClick={e => e.stopPropagation()}
                style={{ fontSize: 12, color: '#FF0000', fontWeight: 600, textDecoration: 'none' }}>
                ▶ Ver video
              </a>
            )}
            {ex.variations?.length > 0 && (
              <span style={{ fontSize: 12, color: 'var(--muted)', background: 'var(--bg)', borderRadius: 6, padding: '2px 8px' }}>
                {ex.variations.length} variación{ex.variations.length !== 1 ? 'es' : ''}
              </span>
            )}
          </div>
        </div>
        <button onClick={onEdit} style={{ background: 'var(--bg)', border: 'none', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontSize: 14, color: 'var(--muted)' }}>✏️</button>
        <button onClick={onToggle} style={{ background: 'var(--bg)', border: 'none', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontSize: 14, color: 'var(--coral)', fontWeight: 700 }}>
          {expanded ? '▲' : '▼'}
        </button>
        <button onClick={onDelete} style={{ background: 'none', border: 'none', padding: '6px 8px', cursor: 'pointer', fontSize: 16, color: 'var(--muted)' }}>✕</button>
      </div>

      {expanded && (
        <div style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <p style={{ fontWeight: 700, fontSize: 13 }}>⇄ Variaciones</p>
            {!addingVar && (
              <button onClick={onStartAddVar} style={{ fontSize: 13, color: 'var(--coral)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>
                + Agregar variación
              </button>
            )}
          </div>

          {ex.variations?.length === 0 && !addingVar && (
            <p style={{ fontSize: 13, color: 'var(--muted)', fontStyle: 'italic' }}>Sin variaciones. Agrega alternativas para este ejercicio.</p>
          )}

          {ex.variations?.map(v => (
            <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--bg)', borderRadius: 10, marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 600, fontSize: 14 }}>{v.name}</p>
                {v.youtube_url && (
                  <a href={v.youtube_url} target="_blank" rel="noreferrer"
                    style={{ fontSize: 12, color: '#FF0000', fontWeight: 600, textDecoration: 'none' }}>
                    ▶ Ver video
                  </a>
                )}
              </div>
              <button onClick={() => onDeleteVar(v.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, color: 'var(--muted)', padding: '4px 8px' }}>✕</button>
            </div>
          ))}

          {addingVar && (
            <div style={{ background: 'var(--bg)', borderRadius: 12, padding: 14, marginTop: 8 }}>
              <input className="input" placeholder="Nombre de la variación *"
                value={varFormValue.name} onChange={e => onVarFormChange({ name: e.target.value })}
                style={{ marginBottom: 8 }} />
              <input className="input" placeholder="Link de YouTube (opcional)"
                value={varFormValue.youtube_url} onChange={e => onVarFormChange({ youtube_url: e.target.value })}
                style={{ marginBottom: 12 }} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn-ghost" onClick={onCancelAddVar} style={{ flex: 1, fontSize: 13 }}>Cancelar</button>
                <button className="btn-primary" onClick={onSaveVar} style={{ flex: 2, justifyContent: 'center', fontSize: 13 }}>Guardar variación</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
