import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';

const EMPTY_EXERCISE = () => ({ _key: Math.random(), name: '', youtube_url: '', sets: 3, reps: '10', weight_kg: '' });
const EMPTY_DAY = () => ({ _key: Math.random(), day_name: '', exercises: [EMPTY_EXERCISE()] });

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
    { key: 'overview',  label: 'Resumen' },
    { key: 'profile',   label: '📋 Perfil' },
    { key: 'routine',   label: '💪 Rutina' },
    { key: 'nutrition', label: '🥗 Nutrición' },
    { key: 'bio',       label: '📊 Bio' },
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

function parseJson(v) {
  try { const a = typeof v === 'string' ? JSON.parse(v) : v; return Array.isArray(a) ? a.join(', ') : v; }
  catch { return v; }
}
