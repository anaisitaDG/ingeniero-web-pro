import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { LineChart, Line, XAxis, Tooltip, ResponsiveContainer } from 'recharts';

const EMPTY_EXERCISE = () => ({ _key: Math.random(), name: '', youtube_url: '', sets: 3, reps: '10', weight_kg: '' });
const EMPTY_DAY = () => ({ _key: Math.random(), day_name: '', warmup_type: '', warmup_duration: '', cardio_type: '', cardio_duration: '', exercises: [EMPTY_EXERCISE()] });

export default function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState('overview');
  const [inviting, setInviting] = useState(false);
  const [bioFile, setBioFile]   = useState(null);
  const [bioUploading, setBioUploading] = useState(false);
  const [targets, setTargets]   = useState({ calorie_target: '', protein_target_g: '', carbs_target_g: '', fat_target_g: '' });
  const [savingTargets, setSavingTargets] = useState(false);

  // Workout builder state
  const [workoutDays, setWorkoutDays] = useState([EMPTY_DAY()]);
  const [workoutLoading, setWorkoutLoading] = useState(false);
  const [savingWorkout, setSavingWorkout]   = useState(false);

  // Nutrition (text) state
  const [manualNutrition, setManualNutrition] = useState('');
  const [savingNutrition, setSavingNutrition] = useState(false);
  const [nutritionMode, setNutritionMode]     = useState('manual');
  const [genNutritionLoading, setGenNutritionLoading] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');

  // New tabs state
  const [progress, setProgress]         = useState(null);
  const [adherenceDetail, setAdherence] = useState(null);
  const [workoutLogs, setWorkoutLogs]   = useState(null);
  const [notes, setNotes]               = useState('');
  const [savingNotes, setSavingNotes]   = useState(false);

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
            name: e.name,
            youtube_url: e.youtube_url || '',
            sets: e.sets,
            reps: e.reps,
            weight_kg: e.weight_kg || '',
          })),
        })));
      }
    } finally { setWorkoutLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (tab === 'routine') loadWorkout(); }, [tab, loadWorkout]);
  useEffect(() => {
    if (tab === 'progreso' && !progress) api.trainer.getProgress(id).then(setProgress);
    if (tab === 'adherencia' && !adherenceDetail) api.trainer.getAdherence(id).then(d => setAdherence(d.days));
    if (tab === 'logs' && !workoutLogs) api.trainer.getWorkoutLogs(id).then(d => setWorkoutLogs(d));
    if (tab === 'notas' && notes === '') api.trainer.getNotes(id).then(d => setNotes(d.notes || ''));
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
      alert('Metas guardadas');
    } catch(e) { alert(e.message); }
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
            name: e.name,
            youtube_url: e.youtube_url || null,
            sets: Number(e.sets) || 3,
            reps: e.reps || '10',
            weight_kg: e.weight_kg ? Number(e.weight_kg) : null,
          })),
      }));
    if (days.length === 0) return alert('Agrega al menos un día con ejercicios');
    setSavingWorkout(true);
    try { await api.trainer.saveWorkout(id, days); alert('Plan de entrenamiento guardado ✓'); }
    catch (e) { alert(e.message); }
    finally { setSavingWorkout(false); }
  }

  async function saveNutrition() {
    setSavingNutrition(true);
    try { await api.trainer.saveNutrition(id, manualNutrition); await load(); alert('Plan guardado'); }
    catch (e) { alert(e.message); }
    finally { setSavingNutrition(false); }
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

  async function sendInvite() {
    setInviting(true);
    try { await api.trainer.invite(id); alert('Invitación enviada'); }
    catch (e) { alert(e.message); }
    finally { setInviting(false); }
  }

  async function uploadBio() {
    if (!bioFile) return;
    setBioUploading(true);
    const fd = new FormData();
    fd.append('image', bioFile);
    fd.append('user_id', id);
    try {
      const res = await api.bioimpedance.upload(fd, id);
      if (res.error) throw new Error(res.error);
      await load();
      setBioFile(null);
      setTab('bio');
      alert('Bioimpedancia guardada');
    } catch (e) { alert(e.message); }
    finally { setBioUploading(false); }
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
  ];

  return (
    <div>
      <button className="btn-ghost" onClick={() => navigate('/trainer')} style={{ marginBottom: 16, padding: '8px 0', fontSize: 14 }}>← Volver</button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--coral-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 800, color: 'var(--coral)' }}>
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800 }}>{user.name}</h1>
            <p style={{ color: 'var(--muted)', fontSize: 14 }}>{user.email}</p>
          </div>
        </div>
        <button className="btn-primary" onClick={sendInvite} disabled={inviting} style={{ padding: '10px 18px', fontSize: 14, background: 'var(--gold)' }}>
          {inviting ? <span className="spinner" /> : '✉️ Invitar'}
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 24, overflowX: 'auto', paddingBottom: 4 }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '8px 16px', borderRadius: 10, fontWeight: 700, fontSize: 13, border: 'none', whiteSpace: 'nowrap',
            background: tab === t.key ? 'var(--coral)' : 'var(--card)',
            color: tab === t.key ? '#fff' : 'var(--muted)',
            boxShadow: 'var(--shadow)', cursor: 'pointer',
          }}>{t.label}</button>
        ))}
      </div>

      {/* Overview */}
      {tab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          <div className="card">
            <p style={{ fontWeight: 700, marginBottom: 12 }}>📋 Datos básicos</p>
            <InfoRow label="Edad" value={q?.age} />
            <InfoRow label="Peso" value={q?.weight_kg && `${q.weight_kg} kg`} />
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

          {measurements[0] && (
            <div className="card">
              <p style={{ fontWeight: 700, marginBottom: 12 }}>📏 Última medición</p>
              <InfoRow label="Peso" value={measurements[0].weight_kg && `${measurements[0].weight_kg} kg`} />
              <InfoRow label="Cintura" value={measurements[0].waist_cm && `${measurements[0].waist_cm} cm`} />
              <InfoRow label="Cadera" value={measurements[0].hip_cm && `${measurements[0].hip_cm} cm`} />
              <InfoRow label="Brazo" value={measurements[0].arm_cm && `${measurements[0].arm_cm} cm`} />
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

                    <input
                      className="input"
                      placeholder="Nombre del ejercicio (ej: Sentadilla en Smith)"
                      value={ex.name}
                      onChange={e => updateExercise(di, ei, 'name', e.target.value)}
                      style={{ marginBottom: 8 }}
                    />

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
          </div>
        )
      )}

      {/* Nutrición */}
      {tab === 'nutrition' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {[['manual', '✏️ Editar manualmente'], ['ai', '✨ Generar con IA']].map(([key, label]) => (
              <button key={key} onClick={() => setNutritionMode(key)} style={{
                flex: 1, padding: '10px', borderRadius: 10, fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer',
                background: nutritionMode === key ? 'var(--gold)' : 'var(--card)',
                color: nutritionMode === key ? '#fff' : 'var(--muted)',
                boxShadow: 'var(--shadow)',
              }}>{label}</button>
            ))}
          </div>

          {nutritionMode === 'manual' && (
            <div className="card">
              <p style={{ fontWeight: 700, marginBottom: 10 }}>✏️ Plan de alimentación</p>
              <textarea className="input" rows={16}
                placeholder={"Lunes\nDesayuno: Avena con frutas — 350 kcal\nAlmuerzo: Pollo con arroz — 550 kcal\nMerienda: Yogur griego — 150 kcal\nCena: Ensalada con atún — 400 kcal\n\nMartes\n..."}
                value={manualNutrition}
                onChange={e => setManualNutrition(e.target.value)}
                style={{ marginBottom: 10, resize: 'vertical', fontFamily: 'monospace', fontSize: 13 }}
              />
              <button className="btn-primary" onClick={saveNutrition} disabled={savingNutrition || !manualNutrition.trim()} style={{ width: '100%', justifyContent: 'center', background: 'var(--gold)' }}>
                {savingNutrition ? <><span className="spinner" /> Guardando…</> : '💾 Guardar plan'}
              </button>
            </div>
          )}

          {nutritionMode === 'ai' && (
            <div className="card">
              <p style={{ fontWeight: 700, marginBottom: 10 }}>Generar plan nutricional con IA</p>
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
      )}

      {/* Bio */}
      {/* PROGRESO */}
      {tab === 'progreso' && (
        <div>
          {!progress ? <div style={{ textAlign: 'center', padding: 48 }}><div className="spinner" style={{ borderTopColor: 'var(--coral)', borderColor: 'var(--border)', width: 28, height: 28 }} /></div> : (
            <>
              {progress.measurements.length > 1 && (() => {
                const chartData = [...progress.measurements].reverse().map(r => ({
                  date: new Date(r.logged_at).toLocaleDateString('es', { day: 'numeric', month: 'short' }),
                  peso: r.weight_kg, cintura: r.waist_cm, cadera: r.hip_cm,
                }));
                return (
                  <div className="card" style={{ marginBottom: 16 }}>
                    <p style={{ fontWeight: 700, marginBottom: 12 }}>📉 Peso (kg)</p>
                    <ResponsiveContainer width="100%" height={120}>
                      <LineChart data={chartData}>
                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                        <Tooltip formatter={v => [`${v} kg`, 'Peso']} contentStyle={{ borderRadius: 10, border: 'none' }} />
                        <Line type="monotone" dataKey="peso" stroke="var(--coral)" strokeWidth={2.5} dot={{ r: 3, fill: 'var(--coral)' }} connectNulls />
                      </LineChart>
                    </ResponsiveContainer>
                    {chartData.some(d => d.cintura) && <>
                      <p style={{ fontWeight: 700, margin: '12px 0 8px' }}>📐 Cintura/Cadera (cm)</p>
                      <ResponsiveContainer width="100%" height={100}>
                        <LineChart data={chartData}>
                          <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                          <Tooltip contentStyle={{ borderRadius: 10, border: 'none' }} />
                          <Line type="monotone" dataKey="cintura" stroke="#2D6EA0" strokeWidth={2} dot={false} connectNulls />
                          <Line type="monotone" dataKey="cadera" stroke="#C99A1E" strokeWidth={2} dot={false} connectNulls />
                        </LineChart>
                      </ResponsiveContainer>
                    </>}
                  </div>
                );
              })()}
              {progress.photos.length > 0 ? (
                <div className="card">
                  <p style={{ fontWeight: 700, marginBottom: 12 }}>📸 Fotos de progreso</p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                    {progress.photos.map(p => (
                      <div key={p.id}>
                        <img src={p.image_url} alt="" style={{ width: '100%', aspectRatio: '3/4', objectFit: 'cover', borderRadius: 10 }} />
                        <p style={{ fontSize: 10, color: 'var(--muted)', textAlign: 'center', marginTop: 4 }}>
                          {new Date(p.taken_at).toLocaleDateString('es', { day: 'numeric', month: 'short' })}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="empty-state"><div className="icon">📸</div><p>La cliente aún no ha subido fotos de progreso</p></div>
              )}
            </>
          )}
        </div>
      )}

      {/* ADHERENCIA */}
      {tab === 'adherencia' && (
        <div>
          {!adherenceDetail ? <div style={{ textAlign: 'center', padding: 48 }}><div className="spinner" style={{ borderTopColor: 'var(--coral)', borderColor: 'var(--border)', width: 28, height: 28 }} /></div> : (
            adherenceDetail.length === 0 ? (
              <div className="empty-state"><div className="icon">🗓</div><p>Sin registros de adherencia aún</p></div>
            ) : (
              <div className="card">
                <p style={{ fontWeight: 700, marginBottom: 16 }}>Últimos 60 días</p>
                <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
                  <span style={{ fontSize: 12 }}>💪 Entrenamiento</span>
                  <span style={{ fontSize: 12 }}>🥗 Dieta</span>
                  <span style={{ fontSize: 12 }}>💧 Agua</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {adherenceDetail.map(row => {
                    const d = row.tracked_date instanceof Date ? row.tracked_date.toISOString().slice(0,10) : String(row.tracked_date).slice(0,10);
                    return (
                      <div key={d} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                        <span style={{ fontSize: 12, color: 'var(--muted)', width: 80, flexShrink: 0 }}>
                          {new Date(d).toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' })}
                        </span>
                        <span style={{ fontSize: 16 }}>{row.workout_done ? '✅' : '⬜'}</span>
                        <span style={{ fontSize: 16 }}>{row.diet_followed ? '✅' : '⬜'}</span>
                        <span style={{ fontSize: 13, color: '#4A90D9', fontWeight: 600 }}>
                          {row.water_glasses > 0 ? `💧${row.water_glasses}` : ''}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )
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

              {/* Sesiones */}
              {workoutLogs.sessions.map((session, idx) => (
                <SessionCard key={session.date + session.day_name}
                  session={session}
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

      {tab === 'bio' && (
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <p style={{ fontWeight: 700, marginBottom: 10 }}>📊 Subir bioimpedancia</p>
            <input type="file" accept="image/*" onChange={e => setBioFile(e.target.files[0])} style={{ marginBottom: 10 }} />
            <button className="btn-primary" onClick={uploadBio} disabled={!bioFile || bioUploading} style={{ width: '100%', justifyContent: 'center' }}>
              {bioUploading ? <><span className="spinner" /> Procesando…</> : 'Subir y analizar'}
            </button>
          </div>
          {bioimpedance.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {bioimpedance.map(b => (
                <div key={b.id} className="card" style={{ padding: 16 }}>
                  <p style={{ fontWeight: 700, marginBottom: 10 }}>{new Date(b.logged_at).toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <InfoRow label="Grasa corporal" value={b.body_fat_pct != null ? `${b.body_fat_pct}%` : '—'} />
                    <InfoRow label="Masa muscular" value={b.muscle_mass_kg != null ? `${b.muscle_mass_kg} kg` : '—'} />
                    <InfoRow label="Grasa visceral" value={b.visceral_fat ?? '—'} />
                    <InfoRow label="Metabolismo" value={b.bmr_kcal != null ? `${b.bmr_kcal} kcal` : '—'} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state"><div className="icon">📊</div><p>No hay registros de bioimpedancia</p></div>
          )}
        </div>
      )}
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

function SessionCard({ session, prevSession }) {
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
      <div style={{ background: color, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p style={{ fontWeight: 800, fontSize: 15, color: '#fff', textTransform: 'capitalize' }}>{dateLabel}</p>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2, fontWeight: 600 }}>
            {isFree ? '🆓 Entrenamiento libre' : session.day_name}
          </p>
          {session.note && <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2, fontStyle: 'italic' }}>"{session.note}"</p>}
        </div>
        <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 10, padding: '6px 12px', textAlign: 'center' }}>
          <p style={{ fontSize: 18, fontWeight: 900, color: '#fff', lineHeight: 1 }}>{session.exercises.length}</p>
          <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>EJERC.</p>
        </div>
      </div>

      {/* Ejercicios */}
      <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
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
      </div>
    </div>
  );
}
