import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const API_BASE = process.env.REACT_APP_API_URL || '';
function fmtDate(str, opts = { day: 'numeric', month: 'short' }) {
  if (!str) return '';
  const [y, m, d] = str.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es', opts);
}
function photoUrl(p) {
  if (!p) return '';
  return p.startsWith('http') ? p : `${API_BASE}/${p}`;
}

const AVATAR_COLORS = ['#FF6B6B','#F4A261','#2A9D8F','#E76F51','#457B9D','#9B5DE5','#F15BB5','#00BBF9','#06D6A0','#FF9F1C'];
function avatarColor(name = '') {
  let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

const EMPTY_EXERCISE = () => ({ _key: Math.random(), name: '', youtube_url: '', sets: 3, reps: '10', weight_kg: '' });
const EMPTY_DAY = () => ({ _key: Math.random(), day_name: '', warmup_type: '', warmup_duration: '', cardio_type: '', cardio_duration: '', exercises: [EMPTY_EXERCISE()] });

export default function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState('overview');
  const [inviting, setInviting] = useState(false);
  const [bioFiles, setBioFiles] = useState([]);
  const [bioUploading, setBioUploading] = useState(false);
  const [targets, setTargets]   = useState({ calorie_target: '', protein_target_g: '', carbs_target_g: '', fat_target_g: '' });
  const [savingTargets, setSavingTargets] = useState(false);

  // Workout builder state
  const [workoutDays, setWorkoutDays]     = useState([EMPTY_DAY()]);
  const [workoutLoading, setWorkoutLoading] = useState(false);
  const [savingWorkout, setSavingWorkout]   = useState(false);
  const [durationDays, setDurationDays]     = useState('');
  const [startDate, setStartDate]           = useState(new Date().toISOString().slice(0, 10));

  // Library picker
  const [library, setLibrary]           = useState(null);
  const [pickerTarget, setPickerTarget] = useState(null); // { dayIdx, exIdx }
  const [libSearch, setLibSearch]       = useState('');

  // Nutrition (text) state
  const [manualNutrition, setManualNutrition] = useState('');
  const [savingNutrition, setSavingNutrition] = useState(false);
  const [nutritionMode, setNutritionMode]     = useState('manual');
  const [genNutritionLoading, setGenNutritionLoading] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [genRoutineLoading, setGenRoutineLoading] = useState(false);
  const [routinePrompt, setRoutinePrompt]         = useState('');
  const [sendingSummary, setSendingSummary]       = useState(false);

  // New tabs state
  const [progress, setProgress]         = useState(null);
  const [adherenceDetail, setAdherence] = useState(null);
  const [lightbox, setLightbox]         = useState(null);
  const [workoutLogs, setWorkoutLogs]   = useState(null);
  const [notes, setNotes]               = useState('');
  const [savingNotes, setSavingNotes]   = useState(false);
  const [billing, setBilling]           = useState({ monthly_fee: '', next_payment_date: '', notes: '' });
  const [savingBilling, setSavingBilling] = useState(false);
  const [saveMsg, setSaveMsg]           = useState('');

  // Meal planner state
  const [mealPlan, setMealPlan]           = useState(null); // { 1: [...], 2: [...], ... }
  const [mealPlanDraft, setMealPlanDraft] = useState(null); // editing state
  const [savingMealPlan, setSavingMealPlan] = useState(false);
  const [mealPlanDow, setMealPlanDow]     = useState(1); // selected day 1-7
  const [nutritionSubTab, setNutritionSubTab] = useState('planner'); // 'planner' | 'text'

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.trainer.client(id);
      setData(d);
      if (d.nutrition_plan?.content) setManualNutrition(d.nutrition_plan.content);
      setTargets({
        calorie_target:   d.user?.calorie_target   || '',
        protein_target_g: d.user?.protein_target_g || '',
        carbs_target_g:   d.user?.carbs_target_g   || '',
        fat_target_g:     d.user?.fat_target_g      || '',
      });
    } finally { setLoading(false); }
  }, [id]);

  const loadWorkout = useCallback(async () => {
    setWorkoutLoading(true);
    try {
      const res = await api.trainer.getWorkout(id);
      if (res.plan) {
        setDurationDays(res.plan.duration_days || '');
        setStartDate(res.plan.start_date ? res.plan.start_date.slice(0, 10) : new Date().toISOString().slice(0, 10));
      }
      if (res.plan?.days?.length > 0) {
        setWorkoutDays(res.plan.days.map(d => ({
          _key: Math.random(),
          day_name: d.day_name,
          warmup_type: d.warmup_type || '',
          warmup_duration: d.warmup_duration || '',
          cardio_type: d.cardio_type || '',
          cardio_duration: d.cardio_duration || '',
          exercises: d.exercises.map(e => ({
            _key: Math.random(),
            id: e.id || null,
            name: e.name,
            youtube_url: e.youtube_url || '',
            sets: e.sets,
            reps: e.reps,
            weight_kg: e.weight_kg || '',
            library_exercise_id: e.library_exercise_id || null,
          })),
        })));
      }
    } finally { setWorkoutLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (tab === 'routine') loadWorkout(); }, [tab, loadWorkout]);
  useEffect(() => {
    if (tab === 'progreso') api.trainer.getProgress(id).then(setProgress);
    if (tab === 'adherencia') api.trainer.getAdherence(id).then(d => setAdherence(d.days));
    if (tab === 'logs') api.trainer.getWorkoutLogs(id).then(d => setWorkoutLogs(d));
    if (tab === 'notas') api.trainer.getNotes(id).then(d => setNotes(d.notes || ''));
    if (tab === 'nutrition') api.trainer.getMealPlan(id).then(res => {
      setMealPlan(res.plan || {});
      setMealPlanDraft(JSON.parse(JSON.stringify(res.plan || {})));
    });
    if (tab === 'facturacion') api.trainer.getBilling().then(res => {
      const c = (res.clients || []).find(c => String(c.id) === String(id));
      if (c) setBilling({ monthly_fee: c.monthly_fee != null ? String(c.monthly_fee) : '', next_payment_date: c.next_payment_date ? String(c.next_payment_date).slice(0, 10) : '', notes: c.notes || '' });
    });
  }, [tab]); // eslint-disable-line

  async function saveTargets() {
    setSavingTargets(true);
    try {
      await api.trainer.setTargets(id, {
        calorie_target:   targets.calorie_target   ? Number(targets.calorie_target)   : null,
        protein_target_g: targets.protein_target_g ? Number(targets.protein_target_g) : null,
        carbs_target_g:   targets.carbs_target_g   ? Number(targets.carbs_target_g)   : null,
        fat_target_g:     targets.fat_target_g      ? Number(targets.fat_target_g)     : null,
      });
      setSaveMsg('✅ Metas guardadas'); setTimeout(() => setSaveMsg(''), 3000);
    } catch(e) { setSaveMsg('❌ ' + e.message); setTimeout(() => setSaveMsg(''), 4000); }
    finally { setSavingTargets(false); }
  }

  async function saveWorkout() {
    const days = workoutDays
      .filter(d => d.day_name.trim())
      .map(d => ({
        day_name: d.day_name,
        warmup_type: d.warmup_type || null,
        warmup_duration: d.warmup_duration ? Number(d.warmup_duration) : null,
        cardio_type: d.cardio_type || null,
        cardio_duration: d.cardio_duration ? Number(d.cardio_duration) : null,
        exercises: d.exercises
          .filter(e => e.name.trim())
          .map(e => ({
            exercise_id: e.id || null,
            name: e.name,
            youtube_url: e.youtube_url || null,
            sets: Number(e.sets) || 3,
            reps: e.reps || '10',
            weight_kg: e.weight_kg ? Number(e.weight_kg) : null,
            library_exercise_id: e.library_exercise_id || null,
          })),
      }));
    if (days.length === 0) { setSaveMsg('❌ Agrega al menos un día con ejercicios'); setTimeout(() => setSaveMsg(''), 3000); return; }
    setSavingWorkout(true);
    try { await api.trainer.saveWorkout(id, days, durationDays ? Number(durationDays) : null, startDate || null); setSaveMsg('✅ Plan guardado'); setTimeout(() => setSaveMsg(''), 3000); }
    catch (e) { setSaveMsg('❌ ' + e.message); setTimeout(() => setSaveMsg(''), 4000); }
    finally { setSavingWorkout(false); }
  }

  async function saveNutrition() {
    setSavingNutrition(true);
    try { await api.trainer.saveNutrition(id, manualNutrition); await load(); setSaveMsg('✅ Plan guardado'); setTimeout(() => setSaveMsg(''), 3000); }
    catch (e) { setSaveMsg('❌ ' + e.message); setTimeout(() => setSaveMsg(''), 4000); }
    finally { setSavingNutrition(false); }
  }

  async function saveMealPlan() {
    setSavingMealPlan(true);
    try {
      await api.trainer.saveMealPlan(id, mealPlanDraft);
      setMealPlan(JSON.parse(JSON.stringify(mealPlanDraft)));
      setSaveMsg('✅ Planner guardado'); setTimeout(() => setSaveMsg(''), 3000);
    } catch (e) { setSaveMsg('❌ ' + e.message); setTimeout(() => setSaveMsg(''), 4000); }
    finally { setSavingMealPlan(false); }
  }

  async function genNutrition() {
    setGenNutritionLoading(true);
    try {
      await api.trainer.genNutrition(id, aiPrompt || undefined);
      const d = await api.trainer.client(id);
      if (d.nutrition_plan?.content) setManualNutrition(d.nutrition_plan.content);
      setNutritionMode('manual');
    } catch (e) { alert(e.message); }
    finally { setGenNutritionLoading(false); }
  }

  async function genRoutine() {
    setGenRoutineLoading(true);
    try {
      await api.trainer.genRoutine(id, routinePrompt || undefined);
      await loadWorkout();
      setSaveMsg('✅ Rutina generada con IA');
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (e) { setSaveMsg('❌ ' + e.message); setTimeout(() => setSaveMsg(''), 4000); }
    finally { setGenRoutineLoading(false); }
  }

  async function sendWeeklySummary() {
    setSendingSummary(true);
    try {
      await api.trainer.weeklySummary();
      setSaveMsg('✅ Resumen semanal enviado a todos los clientes');
      setTimeout(() => setSaveMsg(''), 4000);
    } catch (e) { setSaveMsg('❌ ' + e.message); setTimeout(() => setSaveMsg(''), 4000); }
    finally { setSendingSummary(false); }
  }

  async function sendInvite() {
    setInviting(true);
    try { await api.trainer.invite(id); setSaveMsg('✅ Invitación enviada'); setTimeout(() => setSaveMsg(''), 3000); }
    catch (e) { setSaveMsg('❌ ' + e.message); setTimeout(() => setSaveMsg(''), 4000); }
    finally { setInviting(false); }
  }

  async function uploadBio() {
    if (!bioFiles.length) return;
    setBioUploading(true);
    const fd = new FormData();
    bioFiles.forEach(f => fd.append('image', f));
    fd.append('user_id', id);
    try {
      const res = await api.bioimpedance.upload(fd, id);
      if (res.error) throw new Error(res.error);
      await load();
      setBioFiles([]);
      setTab('bio');
      alert('Bioimpedancia guardada');
    } catch (e) { alert(e.message); }
    finally { setBioUploading(false); }
  }

  async function deleteClient() {
    if (!window.confirm(`¿Eliminar a ${data?.user?.name}? Esta acción es irreversible y borrará todos sus datos.`)) return;
    try {
      const res = await api.trainer.deleteClient(id);
      if (res.error) throw new Error(res.error);
      navigate('/trainer');
    } catch (e) { alert(e.message); }
  }

  async function deleteBio(bioId) {
    if (!window.confirm('¿Eliminar este registro?')) return;
    try {
      const res = await api.bioimpedance.delete(bioId);
      if (res.error) throw new Error(res.error);
      await load();
    } catch (e) { alert(e.message); }
  }

  // Day helpers
  function addDay() { setWorkoutDays(d => [...d, EMPTY_DAY()]); }
  function removeDay(idx) { setWorkoutDays(d => d.filter((_, i) => i !== idx)); }
  function updateDay(idx, field, val) {
    setWorkoutDays(d => d.map((day, i) => i === idx ? { ...day, [field]: val } : day));
  }
  async function suggestName(dayIdx) {
    const names = workoutDays[dayIdx].exercises.map(e => e.name).filter(Boolean);
    if (names.length === 0) return alert('Agrega ejercicios primero');
    updateDay(dayIdx, 'suggesting', true);
    try {
      const res = await api.trainer.suggestDayName(names);
      updateDay(dayIdx, 'day_name', res.name);
    } catch(e) { alert(e.message); }
    finally { updateDay(dayIdx, 'suggesting', false); }
  }
  function addExercise(dayIdx) {
    setWorkoutDays(d => d.map((day, i) => i === dayIdx ? { ...day, exercises: [...day.exercises, EMPTY_EXERCISE()] } : day));
  }
  function removeExercise(dayIdx, exIdx) {
    setWorkoutDays(d => d.map((day, i) => i === dayIdx ? { ...day, exercises: day.exercises.filter((_, j) => j !== exIdx) } : day));
  }
  function updateExercise(dayIdx, exIdx, field, val) {
    setWorkoutDays(d => d.map((day, i) => i !== dayIdx ? day : {
      ...day,
      exercises: day.exercises.map((ex, j) => j === exIdx ? { ...ex, [field]: val } : ex),
    }));
  }

  async function openLibraryPicker(dayIdx, exIdx) {
    setPickerTarget({ dayIdx, exIdx });
    setLibSearch('');
    if (!library) {
      const res = await api.trainer.getLibrary();
      setLibrary(res.exercises || []);
    }
  }

  function pickFromLibrary(ex) {
    const { dayIdx, exIdx } = pickerTarget;
    setWorkoutDays(d => d.map((day, i) => i !== dayIdx ? day : {
      ...day,
      exercises: day.exercises.map((e, j) => j !== exIdx ? e : {
        ...e,
        name: ex.name,
        youtube_url: ex.youtube_url || '',
        library_exercise_id: ex.id,
      }),
    }));
    setPickerTarget(null);
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 64 }}><div className="spinner" style={{ borderTopColor: 'var(--coral)', borderColor: 'var(--border)', width: 36, height: 36 }} /></div>;
  if (!data) return <div className="empty-state"><div className="icon">❌</div><p>Cliente no encontrado</p></div>;

  const { user, questionnaire: q, measurements, bioimpedance, nutrition_plan, adherence } = data;

  const tabs = [
    { key: 'overview',   label: 'Resumen' },
    { key: 'profile',    label: '📋 Perfil' },
    { key: 'routine',    label: '💪 Rutina' },
    { key: 'nutrition',  label: '🥗 Nutrición' },
    { key: 'bio',        label: '📊 Bio' },
    { key: 'progreso',   label: '📈 Progreso' },
    { key: 'adherencia', label: '🗓 Adherencia' },
    { key: 'logs',       label: '🏋️ Registros' },
    { key: 'notas',      label: '📓 Notas' },
    { key: 'facturacion', label: '💰 Facturación' },
  ];

  return (
    <>
    <div>
      <button className="btn-ghost" onClick={() => navigate('/trainer')} style={{ marginBottom: 16, padding: '8px 0', fontSize: 14 }}>← Volver</button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: avatarColor(user.name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 800, color: '#fff' }}>
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800 }}>{user.name}</h1>
            <p style={{ color: 'var(--muted)', fontSize: 14 }}>{user.email}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-primary" onClick={sendInvite} disabled={inviting} style={{ padding: '10px 18px', fontSize: 14, background: 'var(--gold)' }}>
            {inviting ? <span className="spinner" /> : '✉️ Invitar'}
          </button>
          <button onClick={deleteClient} title="Eliminar cliente" style={{ padding: '10px 14px', fontSize: 18, background: 'none', border: '1px solid var(--border)', borderRadius: 12, cursor: 'pointer', color: '#dc2626' }}>
            🗑
          </button>
        </div>
      </div>

      {/* Tabs — two rows */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 24 }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '8px 14px', borderRadius: 10, fontWeight: 700, fontSize: 13, border: 'none', whiteSpace: 'nowrap',
            background: tab === t.key ? 'var(--coral)' : 'var(--card)',
            color: tab === t.key ? '#fff' : 'var(--muted)',
            boxShadow: 'var(--shadow)', cursor: 'pointer',
          }}>{t.label}</button>
        ))}
      </div>

      {/* Save message banner */}
      {saveMsg && (
        <div style={{ marginBottom: 16, padding: '10px 16px', borderRadius: 12, background: saveMsg.startsWith('✅') ? '#dcfce7' : '#fee2e2', color: saveMsg.startsWith('✅') ? '#15803d' : '#dc2626', fontWeight: 700, fontSize: 14 }}>
          {saveMsg}
        </div>
      )}

      {/* Overview */}
      {tab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>

          {/* Measurements — full width, on top */}
          {measurements[0] && (
            <div style={{ gridColumn: '1 / -1', background: 'linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%)', borderRadius: 16, padding: '20px 24px', color: '#fff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <p style={{ fontWeight: 800, fontSize: 16 }}>📏 Última medición</p>
                  <p style={{ fontSize: 13, opacity: 0.85, marginTop: 2 }}>
                    {new Date(measurements[0].logged_at).toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </div>
                {measurements.length > 1 && q?.weight_kg && measurements[0].weight_kg && (
                  <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 12, padding: '8px 16px', textAlign: 'center' }}>
                    {(() => {
                      const diff = Number(measurements[0].weight_kg) - Number(q.weight_kg);
                      const lost = diff < 0;
                      return <>
                        <p style={{ fontSize: 22, fontWeight: 800 }}>{lost ? '▼' : '▲'} {Math.abs(diff).toFixed(1)} kg</p>
                        <p style={{ fontSize: 12, opacity: 0.85 }}>desde el inicio</p>
                      </>;
                    })()}
                  </div>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10 }}>
                {[
                  { label: 'Peso', cur: measurements[0].weight_kg, prev: measurements[1]?.weight_kg, unit: 'kg' },
                  { label: 'Cintura', cur: measurements[0].waist_cm, prev: measurements[1]?.waist_cm, unit: 'cm' },
                  { label: 'Cadera', cur: measurements[0].hip_cm, prev: measurements[1]?.hip_cm, unit: 'cm' },
                  { label: 'Brazo', cur: measurements[0].arm_cm, prev: measurements[1]?.arm_cm, unit: 'cm' },
                  { label: 'Muslo', cur: measurements[0].thigh_cm, prev: measurements[1]?.thigh_cm, unit: 'cm' },
                  { label: 'Pecho', cur: measurements[0].chest_cm, prev: measurements[1]?.chest_cm, unit: 'cm' },
                  { label: 'Pantorrilla', cur: measurements[0].calf_cm, prev: measurements[1]?.calf_cm, unit: 'cm' },
                  { label: 'Antebrazo', cur: measurements[0].forearm_cm, prev: measurements[1]?.forearm_cm, unit: 'cm' },
                ].filter(m => m.cur).map(m => {
                  const diff = m.prev ? Number(m.cur) - Number(m.prev) : null;
                  const lost = diff !== null && diff < 0;
                  return (
                    <div key={m.label} style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 10, padding: '10px 12px' }}>
                      <p style={{ fontSize: 11, opacity: 0.8, marginBottom: 4 }}>{m.label}</p>
                      <p style={{ fontWeight: 800, fontSize: 18 }}>{Number(m.cur).toFixed(1)} <span style={{ fontSize: 12, fontWeight: 400 }}>{m.unit}</span></p>
                      {diff !== null && Math.abs(diff) >= 0.1 && (
                        <p style={{ fontSize: 12, marginTop: 2, opacity: 0.9 }}>
                          {lost ? '▼' : '▲'} {Math.abs(diff).toFixed(1)} {m.unit}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="card">
            <p style={{ fontWeight: 700, marginBottom: 12 }}>📋 Datos básicos</p>
            <InfoRow label="Edad" value={q?.age} />
            <InfoRow label="Peso inicial" value={q?.weight_kg && `${q.weight_kg} kg`} />
            <InfoRow label="Talla" value={q?.height_cm && `${q.height_cm} cm`} />
            <InfoRow label="Ciudad" value={q?.city} />
            <InfoRow label="Objetivo" value={parseJson(q?.main_goal)} />
          </div>

          {adherence && adherence.total_days > 0 && (
            <div className="card">
              <p style={{ fontWeight: 700, marginBottom: 12 }}>📈 Adherencia 30 días</p>
              <InfoRow label="Entrenamientos" value={`${adherence.workout_days}/${adherence.total_days}`} />
              <InfoRow label="Dieta" value={`${adherence.diet_days}/${adherence.total_days}`} />
              <InfoRow label="% Workout" value={`${Math.round((adherence.workout_days/adherence.total_days)*100)}%`} />
            </div>
          )}

          <div className="card">
            <p style={{ fontWeight: 700, marginBottom: 12 }}>🎯 Metas nutricionales</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              {[
                { key: 'calorie_target',   label: 'Calorías (kcal)', placeholder: 'Ej: 1800' },
                { key: 'protein_target_g', label: 'Proteína (g)',    placeholder: 'Ej: 150' },
                { key: 'carbs_target_g',   label: 'Carbos (g)',      placeholder: 'Ej: 200' },
                { key: 'fat_target_g',     label: 'Grasa (g)',       placeholder: 'Ej: 60' },
              ].map(f => (
                <div key={f.key}>
                  <label className="label">{f.label}</label>
                  <input className="input" type="number" placeholder={f.placeholder}
                    value={targets[f.key]}
                    onChange={e => setTargets(t => ({ ...t, [f.key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
            <button className="btn-primary" onClick={saveTargets} disabled={savingTargets} style={{ width: '100%', justifyContent: 'center', background: 'var(--gold)' }}>
              {savingTargets ? <span className="spinner" /> : 'Guardar metas'}
            </button>
          </div>

          {q && (
            <div className="card">
              <p style={{ fontWeight: 700, marginBottom: 12 }}>🏋️ Entrenamiento</p>
              <InfoRow label="Días/semana" value={q.training_days_week} />
              <InfoRow label="Experiencia" value={q.trained_before ? 'Sí' : 'No'} />
              <InfoRow label="Lesiones" value={q.has_injury ? q.injury_detail : 'No'} />
              <InfoRow label="Nivel energía" value={q.energy_level} />
            </div>
          )}
        </div>
      )}

      {/* Perfil */}
      {tab === 'profile' && (
        q ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            <div className="card">
              <p style={{ fontWeight: 700, marginBottom: 12 }}>👤 Datos personales</p>
              <InfoRow label="Edad" value={q.age} />
              <InfoRow label="Ciudad" value={q.city} />
              <InfoRow label="Teléfono" value={q.phone} />
              <InfoRow label="Peso" value={q.weight_kg && `${q.weight_kg} kg`} />
              <InfoRow label="Talla" value={q.height_cm && `${q.height_cm} cm`} />
              <InfoRow label="Ocupación" value={q.occupation} />
            </div>
            <div className="card">
              <p style={{ fontWeight: 700, marginBottom: 12 }}>🎯 Objetivos</p>
              <InfoRow label="Objetivo" value={parseJson(q.main_goal)} />
              <InfoRow label="Plazo" value={q.goal_timeframe} />
              <InfoRow label="Motivación" value={q.motivation} />
              <InfoRow label="Compromiso" value={q.commitment_level && `${q.commitment_level}/10`} />
              <InfoRow label="Expectativas" value={q.expectations} />
              <InfoRow label="Obstáculos" value={q.obstacles} />
            </div>
            <div className="card">
              <p style={{ fontWeight: 700, marginBottom: 12 }}>🏋️ Entrenamiento</p>
              <InfoRow label="Días/semana" value={q.training_days_week} />
              <InfoRow label="Experiencia previa" value={q.trained_before ? 'Sí' : 'No'} />
              <InfoRow label="Detalle" value={q.training_detail} />
              <InfoRow label="Nivel de energía" value={q.energy_level} />
            </div>
            <div className="card">
              <p style={{ fontWeight: 700, marginBottom: 12 }}>🏥 Salud</p>
              <InfoRow label="Lesiones" value={q.has_injury ? (q.injury_detail || 'Sí') : 'No'} />
              <InfoRow label="Condiciones médicas" value={parseJson(q.medical_conditions) || (q.medical_detail ? q.medical_detail : null)} />
              <InfoRow label="Medicamentos" value={q.takes_medication ? (q.medication_detail || 'Sí') : 'No'} />
              <InfoRow label="Nivel de estrés" value={q.stress_level && `${q.stress_level}/10`} />
              <InfoRow label="Horas de sueño" value={q.sleep_hours} />
              <InfoRow label="Fuma" value={q.smokes != null ? (q.smokes ? (q.smoke_detail || 'Sí') : 'No') : null} />
              <InfoRow label="Alcohol" value={q.drinks_alcohol != null ? (q.drinks_alcohol ? (q.alcohol_detail || 'Sí') : 'No') : null} />
            </div>
            <div className="card">
              <p style={{ fontWeight: 700, marginBottom: 12 }}>🥗 Alimentación</p>
              <InfoRow label="Calidad dieta" value={q.diet_quality && `${q.diet_quality}/10`} />
              <InfoRow label="Comidas al día" value={q.meals_per_day} />
              <InfoRow label="Toma agua" value={q.drinks_water != null ? (q.drinks_water ? 'Sí' : 'No') : null} />
              <InfoRow label="Alergias" value={q.has_allergies ? (q.allergy_detail || 'Sí') : 'No'} />
              <InfoRow label="Alimentos a evitar" value={q.foods_to_avoid} />
              <InfoRow label="Tiempo de cocción" value={q.cooking_time} />
              <InfoRow label="¿Quién cocina?" value={q.meal_preparer} />
            </div>
            <div className="card">
              <p style={{ fontWeight: 700, marginBottom: 12 }}>📏 Medidas iniciales</p>
              <InfoRow label="Brazo" value={q.arm_cm && `${q.arm_cm} cm`} />
              <InfoRow label="Pecho" value={q.chest_cm && `${q.chest_cm} cm`} />
              <InfoRow label="Cintura" value={q.waist_cm && `${q.waist_cm} cm`} />
              <InfoRow label="Cadera" value={q.hip_cm && `${q.hip_cm} cm`} />
              <InfoRow label="Muslo" value={q.thigh_cm && `${q.thigh_cm} cm`} />
              <InfoRow label="Pantorrilla" value={q.calf_cm && `${q.calf_cm} cm`} />
              <InfoRow label="Antebrazo" value={q.forearm_cm && `${q.forearm_cm} cm`} />
              <InfoRow label="Notas" value={q.nutritional_notes} />
            </div>
          </div>
        ) : (
          <div className="empty-state"><div className="icon">📋</div><p>Este cliente aún no ha completado el cuestionario</p></div>
        )
      )}

      {/* Rutina — builder estructurado */}
      {tab === 'routine' && (
        workoutLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}><div className="spinner" style={{ borderTopColor: 'var(--coral)', borderColor: 'var(--border)', width: 28, height: 28 }} /></div>
        ) : (
          <div>
            {/* Duración del plan */}
            <div className="card" style={{ marginBottom: 16, padding: '14px 16px' }}>
              <p style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>⏱ Duración del plan</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[15, 30, 45, 60, 90].map(d => (
                  <button key={d} onClick={() => setDurationDays(durationDays === d ? '' : d)} style={{
                    padding: '8px 16px', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13,
                    background: durationDays === d ? 'var(--coral)' : 'var(--bg)',
                    color: durationDays === d ? '#fff' : 'var(--muted)',
                  }}>{d} días</button>
                ))}
                <input className="input" type="number" min="1" max="365" placeholder="Otro…"
                  value={![15,30,45,60,90].includes(Number(durationDays)) && durationDays ? durationDays : ''}
                  onChange={e => setDurationDays(e.target.value)}
                  style={{ width: 90 }} />
              </div>
              {durationDays && <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>La clienta verá que este plan dura <strong>{durationDays} días</strong>.</p>}
              <div style={{ marginTop: 14 }}>
                <label className="label" style={{ marginBottom: 6 }}>📅 Fecha de inicio</label>
                <input className="input" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ maxWidth: 200 }} />
                {durationDays && startDate && (() => {
                  const end = new Date(startDate);
                  end.setDate(end.getDate() + Number(durationDays));
                  return <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>Vence el <strong>{end.toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' })}</strong></p>;
                })()}
              </div>
            </div>

            {workoutDays.map((day, di) => (
              <div key={day._key} className="card" style={{ marginBottom: 16 }}>
                {/* Day header */}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14 }}>
                  <input
                    className="input"
                    placeholder="Nombre del día (ej: Lunes — Pecho)"
                    value={day.day_name}
                    onChange={e => updateDay(di, 'day_name', e.target.value)}
                    style={{ flex: 1, fontWeight: 700 }}
                  />
                  <button onClick={() => suggestName(di)} disabled={day.suggesting} title="Sugerir nombre con IA" style={{
                    background: 'var(--coral-light)', border: 'none', borderRadius: 8, cursor: 'pointer',
                    padding: '8px 10px', fontSize: 13, fontWeight: 700, color: 'var(--coral)', flexShrink: 0,
                  }}>
                    {day.suggesting ? <span className="spinner" style={{ width: 14, height: 14 }} /> : '✨'}
                  </button>
                  <button onClick={() => removeDay(di)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--muted)', padding: '4px 8px' }}>✕</button>
                </div>

                {/* Warmup & Cardio */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="checkbox" id={`warmup-${di}`} checked={!!day.warmup_type}
                      onChange={e => updateDay(di, 'warmup_type', e.target.checked ? 'si' : '')}
                      style={{ width: 18, height: 18, cursor: 'pointer' }} />
                    <label htmlFor={`warmup-${di}`} className="label" style={{ marginBottom: 0, cursor: 'pointer' }}>🔥 Incluir calentamiento</label>
                  </div>
                  <div>
                    <label className="label">Duración (min)</label>
                    <input className="input" type="number" min="1" max="60" placeholder="10" value={day.warmup_duration}
                      onChange={e => updateDay(di, 'warmup_duration', e.target.value)} disabled={!day.warmup_type} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="checkbox" id={`cardio-${di}`} checked={!!day.cardio_type}
                      onChange={e => updateDay(di, 'cardio_type', e.target.checked ? 'si' : '')}
                      style={{ width: 18, height: 18, cursor: 'pointer' }} />
                    <label htmlFor={`cardio-${di}`} className="label" style={{ marginBottom: 0, cursor: 'pointer' }}>🏃 Incluir cardio al final</label>
                  </div>
                  <div>
                    <label className="label">Duración (min)</label>
                    <input className="input" type="number" min="1" max="120" placeholder="20" value={day.cardio_duration}
                      onChange={e => updateDay(di, 'cardio_duration', e.target.value)} disabled={!day.cardio_type} />
                  </div>
                </div>

                {/* Exercises */}
                {day.exercises.map((ex, ei) => (
                  <div key={ex._key} style={{ background: 'var(--bg)', borderRadius: 12, padding: 14, marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--coral)' }}>Ejercicio {ei + 1}</span>
                      {day.exercises.length > 1 && (
                        <button onClick={() => removeExercise(di, ei)} style={{ background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', color: 'var(--muted)' }}>✕</button>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                      <input
                        className="input"
                        placeholder="Nombre del ejercicio (ej: Sentadilla en Smith)"
                        value={ex.name}
                        onChange={e => updateExercise(di, ei, 'name', e.target.value)}
                        style={{ flex: 1 }}
                      />
                      <button
                        onClick={() => openLibraryPicker(di, ei)}
                        title="Seleccionar de biblioteca"
                        style={{ background: 'var(--coral-light)', border: 'none', borderRadius: 8, cursor: 'pointer', padding: '8px 12px', fontSize: 14, color: 'var(--coral)', fontWeight: 700, flexShrink: 0 }}>
                        📚
                      </button>
                    </div>

                    <input
                      className="input"
                      placeholder="Link de YouTube (ej: https://youtube.com/...)"
                      value={ex.youtube_url}
                      onChange={e => updateExercise(di, ei, 'youtube_url', e.target.value)}
                      style={{ marginBottom: 8 }}
                    />

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                      <div>
                        <label className="label">Series</label>
                        <input className="input" type="number" min="1" max="20" value={ex.sets}
                          onChange={e => updateExercise(di, ei, 'sets', e.target.value)} />
                      </div>
                      <div>
                        <label className="label">Reps</label>
                        <input className="input" placeholder="10 / 8-12" value={ex.reps}
                          onChange={e => updateExercise(di, ei, 'reps', e.target.value)} />
                      </div>
                      <div>
                        <label className="label">Peso (kg)</label>
                        <input className="input" type="number" min="0" step="0.5" placeholder="20" value={ex.weight_kg}
                          onChange={e => updateExercise(di, ei, 'weight_kg', e.target.value)} />
                      </div>
                    </div>
                  </div>
                ))}

                <button onClick={() => addExercise(di)} style={{
                  width: '100%', padding: '10px', borderRadius: 10, border: '2px dashed var(--border)',
                  background: 'none', cursor: 'pointer', color: 'var(--muted)', fontWeight: 600, fontSize: 13,
                }}>+ Agregar ejercicio</button>
              </div>
            ))}

            <button onClick={addDay} style={{
              width: '100%', padding: '14px', borderRadius: 12, border: '2px dashed var(--border)',
              background: 'none', cursor: 'pointer', color: 'var(--coral)', fontWeight: 700, fontSize: 14, marginBottom: 16,
            }}>+ Agregar día</button>

            <button className="btn-primary" onClick={saveWorkout} disabled={savingWorkout} style={{ width: '100%', justifyContent: 'center', padding: '14px' }}>
              {savingWorkout ? <><span className="spinner" /> Guardando…</> : '💾 Guardar plan de entrenamiento'}
            </button>

            {/* Generar rutina con IA */}
            <div className="card" style={{ marginTop: 16, background: 'var(--gold-light)', border: '1.5px solid var(--gold)' }}>
              <p style={{ fontWeight: 700, marginBottom: 8, color: 'var(--gold)' }}>✨ Generar rutina con IA</p>
              <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>La IA creará un plan basado en el perfil y objetivos de la cliente. Puedes darle instrucciones adicionales.</p>
              <textarea className="input" rows={2} placeholder="Instrucciones adicionales (opcional)... Ej: enfocada en piernas, sin sentadilla por rodilla"
                value={routinePrompt} onChange={e => setRoutinePrompt(e.target.value)} style={{ marginBottom: 10, resize: 'vertical' }} />
              <button className="btn-primary" onClick={genRoutine} disabled={genRoutineLoading} style={{ width: '100%', justifyContent: 'center', background: 'var(--gold)' }}>
                {genRoutineLoading ? <><span className="spinner" /> Generando…</> : '✨ Generar rutina con IA'}
              </button>
            </div>
          </div>
        )
      )}

      {/* Nutrición */}
      {tab === 'nutrition' && (() => {
        const DAYS_LABELS_T = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
        const MEAL_META_T = {
          breakfast: { label: 'Desayuno',    icon: '🌅' },
          lunch:     { label: 'Almuerzo',    icon: '☀️' },
          snack:     { label: 'Media tarde', icon: '🍎' },
          dinner:    { label: 'Cena',        icon: '🌙' },
        };
        const MEAL_ORDER_T = ['breakfast', 'lunch', 'snack', 'dinner'];

        const draft = mealPlanDraft || {};
        const dayDraft = draft[mealPlanDow] || [];

        function setDayMeals(dow, meals) {
          setMealPlanDraft(prev => ({ ...(prev || {}), [dow]: meals }));
        }

        function updateItem(idx, field, value) {
          const updated = [...dayDraft];
          updated[idx] = { ...updated[idx], [field]: value };
          setDayMeals(mealPlanDow, updated);
        }

        function addItem(meal_type) {
          setDayMeals(mealPlanDow, [...dayDraft, { meal_type, description: '' }]);
        }

        function removeItem(idx) {
          setDayMeals(mealPlanDow, dayDraft.filter((_, i) => i !== idx));
        }

        function copyDayTo(fromDow, toDow) {
          setMealPlanDraft(prev => ({ ...(prev || {}), [toDow]: JSON.parse(JSON.stringify((prev || {})[fromDow] || [])) }));
        }

        return (
          <div>
            {/* Sub-tab switcher */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, background: 'var(--border)', padding: 4, borderRadius: 12 }}>
              {[['planner', '📅 Planner semanal'], ['text', '📝 Plan en texto'], ['ai', '✨ Generar con IA']].map(([k, l]) => (
                <button key={k} onClick={() => setNutritionSubTab(k)} style={{
                  flex: 1, padding: '8px 4px', borderRadius: 10, fontWeight: 700, fontSize: 12, border: 'none', cursor: 'pointer',
                  background: nutritionSubTab === k ? 'var(--gold)' : 'transparent',
                  color: nutritionSubTab === k ? '#fff' : 'var(--muted)',
                  boxShadow: nutritionSubTab === k ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                }}>{l}</button>
              ))}
            </div>

            {nutritionSubTab === 'planner' && (
              <div>
                {/* Day navigator */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 16, overflowX: 'auto', paddingBottom: 4 }}>
                  {[1,2,3,4,5,6,7].map(dow => {
                    const count = (draft[dow] || []).length;
                    return (
                      <button key={dow} onClick={() => setMealPlanDow(dow)} style={{
                        flexShrink: 0, padding: '8px 10px', borderRadius: 10, border: 'none', cursor: 'pointer',
                        fontWeight: 700, fontSize: 12, minWidth: 52, textAlign: 'center',
                        background: mealPlanDow === dow ? 'var(--gold)' : 'var(--card)',
                        color: mealPlanDow === dow ? '#fff' : count > 0 ? 'var(--text)' : 'var(--muted)',
                        boxShadow: 'var(--shadow)',
                      }}>
                        {DAYS_LABELS_T[dow].slice(0, 3)}
                        {count > 0 && <span style={{ display: 'block', fontSize: 9, marginTop: 2, opacity: 0.8 }}>{count} items</span>}
                      </button>
                    );
                  })}
                </div>

                {/* Day label + copy menu */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <p style={{ fontWeight: 800, fontSize: 16 }}>{DAYS_LABELS_T[mealPlanDow]}</p>
                  <select onChange={e => { if (e.target.value) copyDayTo(Number(e.target.value), mealPlanDow); e.target.value = ''; }}
                    style={{ fontSize: 12, padding: '4px 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--muted)', cursor: 'pointer' }}>
                    <option value="">Copiar de…</option>
                    {[1,2,3,4,5,6,7].filter(d => d !== mealPlanDow && (draft[d]||[]).length > 0).map(d => (
                      <option key={d} value={d}>{DAYS_LABELS_T[d]}</option>
                    ))}
                  </select>
                </div>

                {/* Meals editor by type */}
                {MEAL_ORDER_T.map(mealType => {
                  const meta = MEAL_META_T[mealType];
                  const items = dayDraft.map((it, i) => ({ ...it, _idx: i })).filter(it => it.meal_type === mealType);
                  return (
                    <div key={mealType} className="card" style={{ marginBottom: 12, padding: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <p style={{ fontWeight: 700, fontSize: 14 }}>{meta.icon} {meta.label}</p>
                        <button onClick={() => addItem(mealType)} style={{
                          background: 'var(--coral)', color: '#fff', border: 'none', borderRadius: 8,
                          padding: '4px 10px', fontSize: 18, cursor: 'pointer', lineHeight: 1,
                        }}>+</button>
                      </div>
                      {items.length === 0 && (
                        <p style={{ fontSize: 13, color: 'var(--muted)', fontStyle: 'italic' }}>Sin items — toca + para agregar</p>
                      )}
                      {items.map((it) => (
                        <div key={it._idx} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'flex-start' }}>
                          <textarea className="input" rows={2} value={it.description}
                            onChange={e => updateItem(it._idx, 'description', e.target.value)}
                            placeholder="Ej: 2 huevos revueltos con espinaca, 1 arepa"
                            style={{ flex: 1, resize: 'vertical', fontSize: 13, padding: '8px 10px' }} />
                          <button onClick={() => removeItem(it._idx)} style={{
                            background: 'none', border: 'none', color: '#E05252', fontSize: 20, cursor: 'pointer', padding: '4px', flexShrink: 0,
                          }}>×</button>
                        </div>
                      ))}
                    </div>
                  );
                })}

                <button className="btn-primary" onClick={saveMealPlan} disabled={savingMealPlan} style={{ width: '100%', justifyContent: 'center', background: 'var(--gold)', marginTop: 4 }}>
                  {savingMealPlan ? <><span className="spinner" /> Guardando…</> : '💾 Guardar planner'}
                </button>
              </div>
            )}

            {nutritionSubTab === 'text' && (
              <div className="card">
                <p style={{ fontWeight: 700, marginBottom: 10 }}>✏️ Plan de alimentación (texto libre)</p>
                <textarea className="input" rows={16}
                  placeholder={"Lunes\nDesayuno: Avena con frutas — 350 kcal\nAlmuerzo: Pollo con arroz — 550 kcal\n..."}
                  value={manualNutrition}
                  onChange={e => setManualNutrition(e.target.value)}
                  style={{ marginBottom: 10, resize: 'vertical', fontFamily: 'monospace', fontSize: 13 }}
                />
                <button className="btn-primary" onClick={saveNutrition} disabled={savingNutrition || !manualNutrition.trim()} style={{ width: '100%', justifyContent: 'center', background: 'var(--gold)' }}>
                  {savingNutrition ? <><span className="spinner" /> Guardando…</> : '💾 Guardar plan'}
                </button>
              </div>
            )}

            {nutritionSubTab === 'ai' && (
              <div className="card">
                <p style={{ fontWeight: 700, marginBottom: 10 }}>✨ Generar plan nutricional con IA</p>
                <textarea className="input" rows={2} placeholder="Instrucciones adicionales (opcional)..." value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} style={{ marginBottom: 10, resize: 'vertical' }} />
                <button className="btn-primary" onClick={genNutrition} disabled={genNutritionLoading} style={{ width: '100%', justifyContent: 'center', background: 'var(--gold)' }}>
                  {genNutritionLoading ? <><span className="spinner" /> Generando…</> : '✨ Generar plan nutricional'}
                </button>
                {nutrition_plan && (
                  <div style={{ marginTop: 16 }}>
                    <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 13, lineHeight: 1.7 }}>{nutrition_plan.content}</pre>
                    <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>Guardado: {new Date(nutrition_plan.created_at).toLocaleDateString('es')}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* Bio */}
      {tab === 'bio' && (
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <p style={{ fontWeight: 700, marginBottom: 10 }}>📊 Subir bioimpedancia</p>
            <input type="file" accept="image/*" multiple onChange={e => setBioFiles(Array.from(e.target.files))} style={{ marginBottom: 6 }} />
            {bioFiles.length > 0 && <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>{bioFiles.length} imagen{bioFiles.length > 1 ? 'es' : ''} seleccionada{bioFiles.length > 1 ? 's' : ''}</p>}
            <button className="btn-primary" onClick={uploadBio} disabled={!bioFiles.length || bioUploading} style={{ width: '100%', justifyContent: 'center' }}>
              {bioUploading ? <><span className="spinner" /> Procesando…</> : 'Subir y analizar'}
            </button>
          </div>
          {(!bioimpedance || bioimpedance.length === 0) ? (
            <div className="empty-state"><div className="icon">📊</div><p>La cliente aún no tiene registros de bioimpedancia</p></div>
          ) : (
            <>
              <BioCharts data={bioimpedance} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
                {bioimpedance.map(b => (
                  <div key={b.id} className="card" style={{ padding: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <p style={{ fontWeight: 700 }}>{fmtDate(b.logged_at, { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                      <button onClick={() => deleteBio(b.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 18, padding: '0 4px' }} title="Eliminar">🗑</button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      {b.weight_kg != null && <BioRow label="Peso" value={`${b.weight_kg} kg`} />}
                      {b.bmi != null && <BioRow label="IMC" value={b.bmi} />}
                      {b.body_fat_pct != null && <BioRow label="% Grasa corporal" value={`${b.body_fat_pct}%`} />}
                      {b.body_fat_kg != null && <BioRow label="Peso grasa" value={`${b.body_fat_kg} kg`} />}
                      {b.muscle_mass_kg != null && <BioRow label="Peso muscular" value={`${b.muscle_mass_kg} kg`} />}
                      {b.skeletal_muscle_kg != null && <BioRow label="Músculo esquelético" value={`${b.skeletal_muscle_kg} kg`} />}
                      {b.body_water_pct != null && <BioRow label="Agua corporal" value={`${b.body_water_pct}%`} />}
                      {b.visceral_fat != null && <BioRow label="Grasa visceral" value={b.visceral_fat} />}
                      {b.bmr_kcal != null && <BioRow label="Metabolismo basal" value={`${b.bmr_kcal} kcal`} />}
                      {b.calorie_target != null && <BioRow label="Calorías objetivo" value={`${b.calorie_target} kcal`} />}
                    </div>
                    {(b.target_muscle_kg != null || b.target_fat_loss_kg != null) && (
                      <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                        <p style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, marginBottom: 8 }}>OBJETIVOS</p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                          {b.target_muscle_kg != null && <BioRow label="Músculo a ganar" value={`+${b.target_muscle_kg} kg`} />}
                          {b.target_fat_loss_kg != null && <BioRow label="Grasa a perder" value={`-${b.target_fat_loss_kg} kg`} />}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* PROGRESO */}
      {tab === 'progreso' && (
        <div>
          {!progress ? <div style={{ textAlign: 'center', padding: 48 }}><div className="spinner" style={{ borderTopColor: 'var(--coral)', borderColor: 'var(--border)', width: 28, height: 28 }} /></div> : (
            <>
              {progress.measurements.length > 1 && <TrainerProgressCharts measurements={progress.measurements} />}
              {progress.photos.length > 0 ? (
                <div>
                  <p style={{ fontWeight: 700, marginBottom: 12 }}>📸 Fotos de progreso</p>
                  {progress.photos.map(reg => (
                    <div key={reg.id} className="card" style={{ marginBottom: 12 }}>
                      <p style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>
                        {new Date(reg.date).toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' })}
                        {reg.note ? <span style={{ fontWeight: 400, color: 'var(--muted)', marginLeft: 8 }}>{reg.note}</span> : null}
                      </p>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                        {['frente','espalda','perfil'].map(angle => (
                          <div key={angle}>
                            {reg.photos[angle] ? (
                              <img
                                src={photoUrl(reg.photos[angle].image_url)}
                                alt={angle}
                                onClick={() => setLightbox(photoUrl(reg.photos[angle].image_url))}
                                style={{ width: '100%', aspectRatio: '3/4', objectFit: 'cover', borderRadius: 10, cursor: 'zoom-in', display: 'block' }}
                              />
                            ) : (
                              <div style={{ width: '100%', aspectRatio: '3/4', borderRadius: 10, background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <span style={{ fontSize: 10, color: 'var(--muted)' }}>Sin foto</span>
                              </div>
                            )}
                            <p style={{ fontSize: 10, color: 'var(--muted)', textAlign: 'center', marginTop: 3, textTransform: 'capitalize' }}>{angle}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state"><div className="icon">📸</div><p>La cliente aún no ha subido fotos de progreso</p></div>
              )}
            </>
          )}
        </div>
      )}

      {/* ADHERENCIA — heatmap */}
      {tab === 'adherencia' && (
        <div>
          {!adherenceDetail ? <div style={{ textAlign: 'center', padding: 48 }}><div className="spinner" style={{ borderTopColor: 'var(--coral)', borderColor: 'var(--border)', width: 28, height: 28 }} /></div> : (
            adherenceDetail.length === 0 ? (
              <div className="empty-state"><div className="icon">🗓</div><p>Sin registros de adherencia aún</p></div>
            ) : (() => {
              const byDate = {};
              adherenceDetail.forEach(r => {
                const d = String(r.tracked_date).slice(0, 10);
                byDate[d] = r;
              });
              const workoutDays = adherenceDetail.filter(r => r.workout_done).length;
              const dietDays    = adherenceDetail.filter(r => r.diet_followed).length;
              const total       = adherenceDetail.length;

              // build 10-week grid (70 days back)
              const cells = [];
              for (let i = 69; i >= 0; i--) {
                const d = new Date(); d.setDate(d.getDate() - i);
                cells.push(d.toISOString().slice(0, 10));
              }
              const weeks = [];
              for (let w = 0; w < 10; w++) weeks.push(cells.slice(w * 7, w * 7 + 7));

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* Summary pills */}
                  <div style={{ display: 'flex', gap: 10 }}>
                    {[
                      { label: 'Entrenos', value: workoutDays, total, color: '#FF6B6B' },
                      { label: 'Dieta', value: dietDays, total, color: '#16a34a' },
                    ].map(s => (
                      <div key={s.label} className="card" style={{ flex: 1, textAlign: 'center', padding: '14px 10px' }}>
                        <p style={{ fontSize: 24, fontWeight: 900, color: s.color }}>{s.value}<span style={{ fontSize: 14, color: 'var(--muted)', fontWeight: 400 }}>/{s.total}</span></p>
                        <p style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>{s.label}</p>
                        <div style={{ background: 'var(--border)', borderRadius: 99, height: 6, marginTop: 8, overflow: 'hidden' }}>
                          <div style={{ width: `${Math.round((s.value / s.total) * 100)}%`, height: '100%', background: s.color, borderRadius: 99 }} />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Heatmap */}
                  <div className="card">
                    <p style={{ fontWeight: 700, marginBottom: 14 }}>Últimos 70 días</p>
                    <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                      {['D','L','M','X','J','V','S'].map(d => (
                        <div key={d} style={{ flex: 1, fontSize: 10, color: 'var(--muted)', textAlign: 'center' }}>{d}</div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {weeks.map((week, wi) => (
                        <div key={wi} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {week.map(day => {
                            const r = byDate[day];
                            const bg = !r ? 'var(--border)'
                              : r.workout_done && r.diet_followed ? '#16a34a'
                              : r.workout_done ? '#FF6B6B'
                              : r.diet_followed ? '#C99A1E'
                              : '#f3f4f6';
                            return (
                              <div key={day} title={day} style={{ aspectRatio: '1', borderRadius: 4, background: bg }} />
                            );
                          })}
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
                      {[
                        { color: '#16a34a', label: 'Entreno + dieta' },
                        { color: '#FF6B6B', label: 'Solo entreno' },
                        { color: '#C99A1E', label: 'Solo dieta' },
                        { color: 'var(--border)', label: 'Sin registro' },
                      ].map(l => (
                        <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <div style={{ width: 12, height: 12, borderRadius: 3, background: l.color }} />
                          <span style={{ fontSize: 11, color: 'var(--muted)' }}>{l.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })()
          )}
        </div>
      )}

      {/* LOGS DE EJERCICIOS */}
      {tab === 'logs' && (
        <div>
          {!workoutLogs ? (
            <div style={{ textAlign: 'center', padding: 48 }}><div className="spinner" style={{ borderTopColor: 'var(--coral)', borderColor: 'var(--border)', width: 28, height: 28 }} /></div>
          ) : !workoutLogs.sessions?.length ? (
            <div className="empty-state"><div className="icon">🏋️</div><p>La cliente aún no ha registrado ningún ejercicio</p></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Stats */}
              {workoutLogs.summary && (
                <div style={{ display: 'flex', gap: 10 }}>
                  {[
                    { label: 'Racha', value: workoutLogs.summary.streak, unit: 'días', icon: '🔥', color: '#FF6B4A' },
                    { label: 'Últ. 30 días', value: workoutLogs.summary.days_this_month, unit: 'días', icon: '📅', color: '#6366f1' },
                    { label: 'Sesiones', value: workoutLogs.summary.total_sessions, unit: 'total', icon: '🏋️', color: '#059669' },
                  ].map(s => (
                    <div key={s.label} style={{
                      flex: 1, borderRadius: 16, padding: '14px 10px', textAlign: 'center',
                      background: `${s.color}12`, border: `1.5px solid ${s.color}30`,
                    }}>
                      <p style={{ fontSize: 22, marginBottom: 2 }}>{s.icon}</p>
                      <p style={{ fontSize: 22, fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.value}</p>
                      <p style={{ fontSize: 10, color: 'var(--muted)', marginTop: 3, fontWeight: 600 }}>{s.unit} · {s.label}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Heatmap */}
              <WorkoutHeatmap sessions={workoutLogs.sessions} />

              {/* Sesiones — collapsed by default, show last 3 open */}
              <p style={{ fontWeight: 700, fontSize: 14, marginTop: 4 }}>Últimas sesiones</p>
              {workoutLogs.sessions.map((session, idx) => (
                <SessionCard key={session.date + session.day_name}
                  session={session}
                  defaultOpen={idx < 2}
                  prevSession={workoutLogs.sessions.slice(idx + 1).find(s => s.day_name === session.day_name)} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* NOTAS */}
      {tab === 'notas' && (
        <div className="card">
          <p style={{ fontWeight: 700, marginBottom: 12 }}>📓 Notas privadas</p>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>Solo tú puedes ver estas notas. La cliente no tiene acceso.</p>
          <textarea
            className="input"
            rows={14}
            placeholder="Observaciones, seguimiento, recordatorios sobre esta cliente..."
            value={notes}
            onChange={e => setNotes(e.target.value)}
            style={{ resize: 'vertical', marginBottom: 12, fontFamily: 'inherit', lineHeight: 1.6 }}
          />
          <button className="btn-primary" onClick={async () => {
            setSavingNotes(true);
            try { await api.trainer.saveNotes(id, notes); } finally { setSavingNotes(false); }
          }} disabled={savingNotes} style={{ width: '100%', justifyContent: 'center' }}>
            {savingNotes ? <span className="spinner" /> : '💾 Guardar notas'}
          </button>
        </div>
      )}

      {tab === 'facturacion' && (
        <div className="card">
          <p style={{ fontWeight: 700, marginBottom: 4 }}>💰 Facturación de {user.name}</p>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>Esta información aparece en el panel de ingresos.</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div>
              <label className="label">Cuota mensual (COP $)</label>
              <input className="input" type="number" min="0" placeholder="Ej: 150000"
                value={billing.monthly_fee}
                onChange={e => setBilling(b => ({ ...b, monthly_fee: e.target.value }))} />
            </div>
            <div>
              <label className="label">Próximo pago</label>
              <input className="input" type="date"
                value={billing.next_payment_date}
                onChange={e => setBilling(b => ({ ...b, next_payment_date: e.target.value }))} />
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label className="label">Notas (opcional)</label>
            <input className="input" type="text" placeholder="Ej: Paga el 1 de cada mes"
              value={billing.notes}
              onChange={e => setBilling(b => ({ ...b, notes: e.target.value }))} />
          </div>
          <button className="btn-primary" disabled={savingBilling} style={{ width: '100%', justifyContent: 'center' }} onClick={async () => {
            setSavingBilling(true);
            try {
              await api.trainer.saveBilling(id, { monthly_fee: billing.monthly_fee ? Number(billing.monthly_fee) : null, next_payment_date: billing.next_payment_date || null, notes: billing.notes || null });
              alert('Guardado ✓');
            } catch(e) { alert(e.message); }
            finally { setSavingBilling(false); }
          }}>
            {savingBilling ? <span className="spinner" /> : '💾 Guardar'}
          </button>
        </div>
      )}

      {/* Library Picker Modal */}
      {pickerTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={e => e.target === e.currentTarget && setPickerTarget(null)}>
          <div style={{ background: 'var(--card)', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 600, maxHeight: '80vh', display: 'flex', flexDirection: 'column', padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <p style={{ fontWeight: 800, fontSize: 16 }}>📚 Seleccionar de biblioteca</p>
              <button onClick={() => setPickerTarget(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--muted)' }}>✕</button>
            </div>
            <input className="input" placeholder="Buscar ejercicio..." value={libSearch}
              onChange={e => setLibSearch(e.target.value)} style={{ marginBottom: 14 }} />
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {!library ? (
                <div style={{ textAlign: 'center', padding: 32 }}><div className="spinner" style={{ borderTopColor: 'var(--coral)', borderColor: 'var(--border)', width: 28, height: 28 }} /></div>
              ) : library.filter(e => !libSearch || e.name.toLowerCase().includes(libSearch.toLowerCase())).length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--muted)', padding: 24, fontSize: 14 }}>
                  {library.length === 0 ? 'La biblioteca está vacía. Ve a Biblioteca para agregar ejercicios.' : 'Sin resultados'}
                </p>
              ) : (
                library.filter(e => !libSearch || e.name.toLowerCase().includes(libSearch.toLowerCase())).map(ex => (
                  <div key={ex.id} onClick={() => pickFromLibrary(ex)}
                    style={{ padding: '12px 14px', borderRadius: 12, marginBottom: 8, cursor: 'pointer', background: 'var(--bg)', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: 700, fontSize: 14 }}>{ex.name}</p>
                      <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{ex.muscle_group || 'Sin grupo'}{ex.variations?.length > 0 ? ` · ${ex.variations.length} variación${ex.variations.length !== 1 ? 'es' : ''}` : ''}</p>
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--coral)', fontWeight: 700 }}>Seleccionar →</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>

    {lightbox && (
      <div
        onClick={() => setLightbox(null)}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)',
          zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, cursor: 'zoom-out',
        }}
      >
        <img src={lightbox} alt="" style={{ maxWidth: '100%', maxHeight: '90vh', borderRadius: 12, objectFit: 'contain' }} />
      </div>
    )}
    </>
  );
}

const PROG_FIELDS = [
  { key: 'weight_kg', label: 'Peso', unit: 'kg', icon: '⚖️' },
  { key: 'arm_cm',    label: 'Brazo', unit: 'cm', icon: '💪' },
  { key: 'chest_cm',  label: 'Pecho', unit: 'cm', icon: '📏' },
  { key: 'waist_cm',  label: 'Cintura', unit: 'cm', icon: '🎯' },
  { key: 'hip_cm',    label: 'Cadera', unit: 'cm', icon: '📐' },
  { key: 'thigh_cm',  label: 'Muslo', unit: 'cm', icon: '🦵' },
  { key: 'calf_cm',   label: 'Pantorrilla', unit: 'cm', icon: '🦵' },
  { key: 'forearm_cm',label: 'Antebrazo', unit: 'cm', icon: '💪' },
];

function TrainerProgressCharts({ measurements }) {
  const chartData = [...measurements].reverse().map(r => ({
    date: fmtDate(r.logged_at),
    ...PROG_FIELDS.reduce((acc, f) => ({ ...acc, [f.key]: r[f.key] ?? null }), {}),
  }));

  const fieldStats = PROG_FIELDS.map(f => {
    const pts = chartData.filter(d => d[f.key] != null);
    if (pts.length < 2) return null;
    const first = pts[0][f.key];
    const last  = pts[pts.length - 1][f.key];
    const diff  = parseFloat((last - first).toFixed(1));
    const isWeight = f.key === 'weight_kg';
    const good = isWeight ? diff < 0 : diff > 0;
    return { ...f, pts, first, last, diff, good };
  }).filter(Boolean);

  if (!fieldStats.length) return null;

  const wins = [...fieldStats].filter(s => s.good).sort((a, b) =>
    Math.abs(b.diff) / Math.abs(b.first) - Math.abs(a.diff) / Math.abs(a.first)
  );
  const bestWin = wins[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 16 }}>
      {bestWin && (
        <div style={{ background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)', borderRadius: 18, padding: '20px 22px', color: '#fff', display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ fontSize: 40 }}>🏆</div>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, opacity: 0.8, letterSpacing: 1, marginBottom: 4 }}>MAYOR LOGRO</p>
            <p style={{ fontSize: 20, fontWeight: 800, marginBottom: 2 }}>
              {bestWin.key === 'weight_kg' ? '▼' : '▲'} {Math.abs(bestWin.diff)} {bestWin.unit} de {bestWin.label}
            </p>
            <p style={{ fontSize: 13, opacity: 0.85 }}>{bestWin.first} → {bestWin.last} {bestWin.unit} · {bestWin.pts.length} mediciones</p>
          </div>
        </div>
      )}
      {fieldStats.map(s => {
        const color = s.good ? '#16a34a' : s.diff === 0 ? '#6b7280' : '#dc2626';
        const gradId = `tgrad-${s.key}`;
        const fewData = s.pts.length < 4;
        return (
          <div key={s.key} className="card" style={{ borderTop: `3px solid ${color}`, paddingTop: 14 }}>
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0' }}>
                <div style={{ flex: 1, background: 'var(--bg)', borderRadius: 12, padding: '10px 14px', textAlign: 'center' }}>
                  <p style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>{s.pts[0].date}</p>
                  <p style={{ fontSize: 20, fontWeight: 800, color: 'var(--muted)' }}>{s.first}<span style={{ fontSize: 11, fontWeight: 400 }}> {s.unit}</span></p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{ fontSize: 22, color }}>{s.diff < 0 ? '▼' : s.diff > 0 ? '▲' : '→'}</div>
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
      })}
    </div>
  );
}

function InfoRow({ label, value }) {
  if (value == null || value === '') return null;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--border)', fontSize: 14 }}>
      <span style={{ color: 'var(--muted)' }}>{label}</span>
      <span style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );
}

const GOAL_LABELS = { fat_loss: 'Pérdida de grasa', muscle_gain: 'Ganar músculo', maintenance: 'Mantenimiento', health: 'Salud general' };

function parseJson(v) {
  try {
    const a = typeof v === 'string' ? JSON.parse(v) : v;
    if (Array.isArray(a)) return a.map(k => GOAL_LABELS[k] || k).join(', ');
    return GOAL_LABELS[v] || v;
  } catch { return v; }
}

const DAY_COLORS = {
  'lunes':     '#6366f1',
  'martes':    '#8b5cf6',
  'miércoles': '#0ea5e9',
  'jueves':    '#f59e0b',
  'viernes':   '#FF6B4A',
  'sábado':    '#059669',
  'domingo':   '#ec4899',
  'libre':     '#FF6B4A',
};

function dayColor(dayName) {
  if (!dayName) return '#6366f1';
  const key = dayName.toLowerCase().split(':')[0].trim().split(' ')[0];
  return DAY_COLORS[key] || '#6366f1';
}

function WorkoutHeatmap({ sessions }) {
  const today = new Date();
  const days = Array.from({ length: 35 }, (_, i) => {
    const d = new Date(today); d.setDate(today.getDate() - (34 - i));
    return d.toISOString().slice(0, 10);
  });
  const trained = new Set(sessions.map(s => s.date));
  const sessionByDate = {};
  sessions.forEach(s => { sessionByDate[s.date] = s; });

  return (
    <div className="card" style={{ padding: '14px 16px' }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 10, letterSpacing: 0.5 }}>ÚLTIMOS 35 DÍAS</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {['L','M','M','J','V','S','D'].map(d => (
          <p key={d} style={{ fontSize: 9, color: 'var(--muted)', textAlign: 'center', fontWeight: 600 }}>{d}</p>
        ))}
        {days.map(d => {
          const s = sessionByDate[d];
          const color = s ? dayColor(s.day_name) : null;
          const isToday = d === today.toISOString().slice(0,10);
          return (
            <div key={d} title={s ? `${d} · ${s.day_name}` : d} style={{
              height: 28, borderRadius: 6,
              background: color ? `${color}cc` : 'var(--bg)',
              border: isToday ? '2px solid var(--coral)' : '2px solid transparent',
              transition: 'transform 0.1s',
            }} />
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 10 }}>
        {Object.entries(DAY_COLORS).slice(0,7).map(([day, color]) => (
          <div key={day} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: color }} />
            <span style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'capitalize' }}>{day}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const BIO_METRICS = [
  { key: 'weight_kg',          label: 'Peso',                unit: 'kg',   color: '#457B9D' },
  { key: 'bmi',                label: 'IMC',                 unit: '',     color: '#9B5DE5' },
  { key: 'body_fat_pct',       label: '% Grasa corporal',    unit: '%',    color: '#FF6B6B' },
  { key: 'body_fat_kg',        label: 'Peso de grasa',       unit: 'kg',   color: '#F4A261' },
  { key: 'muscle_mass_kg',     label: 'Peso muscular',       unit: 'kg',   color: '#06D6A0' },
  { key: 'skeletal_muscle_kg', label: 'Músculo esquelético', unit: 'kg',   color: '#2A9D8F' },
  { key: 'body_water_pct',     label: '% Agua corporal',     unit: '%',    color: '#00BBF9' },
  { key: 'visceral_fat',       label: 'Grasa visceral',      unit: '',     color: '#E76F51' },
  { key: 'bmr_kcal',           label: 'Metabolismo basal',   unit: 'kcal', color: '#FF9F1C' },
  { key: 'calorie_target',     label: 'Calorías objetivo',   unit: 'kcal', color: '#F15BB5' },
];

function BioCharts({ data }) {
  const sorted = [...data].reverse();
  if (sorted.length < 2) return null;

  const pts = sorted.map(b => ({
    date: b.logged_at ? b.logged_at.slice(5, 10).replace('-', '/') : '',
    ...Object.fromEntries(BIO_METRICS.map(m => [m.key, b[m.key] != null ? Number(b[m.key]) : null])),
  }));

  const active = BIO_METRICS.filter(m => pts.filter(p => p[m.key] != null).length >= 2);
  if (active.length === 0) return null;

  return (
    <div style={{ marginBottom: 20 }}>
      <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>📈 Progreso</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {active.map(m => {
          const vals = pts.filter(p => p[m.key] != null);
          const first = vals[0][m.key];
          const last  = vals[vals.length - 1][m.key];
          const diff  = +(last - first).toFixed(2);
          const isGood = (m.key === 'muscle_mass_kg' || m.key === 'skeletal_muscle_kg' || m.key === 'body_water_pct' || m.key === 'bmr_kcal') ? diff >= 0 : diff <= 0;
          const diffColor = diff === 0 ? 'var(--muted)' : isGood ? '#16a34a' : '#dc2626';
          const minVal = Math.min(...vals.map(v => v[m.key]));
          const maxVal = Math.max(...vals.map(v => v[m.key]));
          const pad = (maxVal - minVal) * 0.15 || 1;
          return (
            <div key={m.key} className="card" style={{ padding: '12px 12px 6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 2 }}>
                <p style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{m.label}</p>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                <span style={{ fontSize: 20, fontWeight: 800 }}>{last}<span style={{ fontSize: 12, fontWeight: 400, marginLeft: 2 }}>{m.unit}</span></span>
                <span style={{ fontSize: 12, fontWeight: 700, color: diffColor }}>{diff > 0 ? '+' : ''}{diff}{m.unit ? ' ' + m.unit : ''}</span>
              </div>
              <ResponsiveContainer width="100%" height={56}>
                <AreaChart data={vals} margin={{ top: 2, right: 4, left: 4, bottom: 0 }}>
                  <defs>
                    <linearGradient id={`g-${m.key}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={m.color} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={m.color} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <YAxis domain={[minVal - pad, maxVal + pad]} hide />
                  <XAxis dataKey="date" hide />
                  <Tooltip
                    contentStyle={{ fontSize: 11, padding: '4px 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)' }}
                    formatter={(v) => [`${v} ${m.unit}`, m.label]}
                    labelStyle={{ color: 'var(--muted)', fontSize: 10 }}
                  />
                  <Area type="monotone" dataKey={m.key} stroke={m.color} strokeWidth={2} fill={`url(#g-${m.key})`} dot={{ r: 3, fill: m.color, strokeWidth: 0 }} activeDot={{ r: 4 }} connectNulls />
                </AreaChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
                <span style={{ fontSize: 9, color: 'var(--muted)' }}>{vals[0].date}</span>
                <span style={{ fontSize: 9, color: 'var(--muted)' }}>{vals[vals.length-1].date}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BioRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 14 }}>
      <span style={{ color: 'var(--muted)' }}>{label}</span>
      <span style={{ fontWeight: 700 }}>{value}</span>
    </div>
  );
}

function SessionCard({ session, prevSession, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const [expanded, setExpanded] = useState({});
  const dateLabel = new Date(`${session.date}T00:00:00`).toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' });
  const isFree = session.type === 'free';
  const color = dayColor(session.day_name);

  // Build prev weight map
  const prevWeights = {};
  if (prevSession) {
    prevSession.exercises.forEach(ex => { prevWeights[ex.name] = ex.max_weight; });
  }

  function progressBadge(exName, maxWeight) {
    const prev = prevWeights[exName];
    if (!prev || !maxWeight) return null;
    const diff = parseFloat(maxWeight) - parseFloat(prev);
    if (Math.abs(diff) < 0.1) return { icon: '→', color: '#6b7280', label: 'igual' };
    if (diff > 0) return { icon: '↑', color: '#059669', label: `+${diff.toFixed(1)}kg` };
    return { icon: '↓', color: '#dc2626', label: `${diff.toFixed(1)}kg` };
  }

  return (
    <div style={{
      borderRadius: 18, overflow: 'hidden',
      boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
      border: '1px solid var(--border)',
      background: 'var(--card)',
    }}>
      {/* Header con color del día */}
      <div onClick={() => setOpen(o => !o)} style={{ background: color, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
        <div>
          <p style={{ fontWeight: 800, fontSize: 15, color: '#fff', textTransform: 'capitalize' }}>{dateLabel}</p>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2, fontWeight: 600 }}>
            {isFree ? '🆓 Entrenamiento libre' : session.day_name} · {session.exercises.length} ejercicios
          </p>
          {session.note && <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2, fontStyle: 'italic' }}>"{session.note}"</p>}
        </div>
        <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 18 }}>{open ? '▲' : '▼'}</span>
      </div>

      {/* Ejercicios */}
      {open && <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {session.exercises.map((ex, i) => {
          const isOpen = expanded[i];
          const badge = progressBadge(ex.name, ex.max_weight);
          const hasSets = ex.sets?.length > 0;

          let detail = '';
          if (ex.type === 'cardio') detail = ex.duration_mins ? `${ex.duration_mins} min` : '';
          else if (ex.type === 'time') detail = ex.duration_secs ? `${ex.sets || 1}×${ex.duration_secs}seg` : '';
          else if (ex.max_weight) detail = `${parseFloat(ex.max_weight)}kg × ${ex.reps ?? '—'}`;

          return (
            <div key={i}>
              <div onClick={() => hasSets && setExpanded(p => ({ ...p, [i]: !p[i] }))}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                  borderRadius: 10, background: isOpen ? `${color}12` : 'var(--bg)',
                  cursor: hasSets ? 'pointer' : 'default', transition: 'background 0.15s' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ex.name}</p>
                  {detail && <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>{detail}</p>}
                </div>
                {badge && (
                  <span style={{ fontSize: 11, fontWeight: 800, color: badge.color,
                    background: `${badge.color}15`, padding: '2px 7px', borderRadius: 6, flexShrink: 0 }}>
                    {badge.icon} {badge.label}
                  </span>
                )}
                {hasSets && <span style={{ fontSize: 11, color: 'var(--muted)', flexShrink: 0 }}>{isOpen ? '▲' : '▼'}</span>}
              </div>
              {isOpen && hasSets && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '6px 10px 4px' }}>
                  {ex.sets.map((s, j) => (
                    <span key={j} style={{ fontSize: 12, background: `${color}18`, color: color,
                      padding: '3px 10px', borderRadius: 6, fontWeight: 700 }}>
                      S{s.set ?? j+1}: {s.weight ?? s.weight_kg ?? '—'}kg × {s.reps ?? s.reps_done ?? '—'}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>}
    </div>
  );
}
