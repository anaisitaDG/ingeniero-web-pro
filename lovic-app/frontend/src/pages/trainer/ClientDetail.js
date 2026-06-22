import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';

export default function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState('overview');
  const [genLoading, setGenLoading] = useState({ routine: false, nutrition: false });
  const [savingManual, setSavingManual] = useState({ routine: false, nutrition: false });
  const [inviting, setInviting]     = useState(false);
  const [prompt, setPrompt]         = useState('');
  const [routineMode, setRoutineMode]     = useState('manual');
  const [nutritionMode, setNutritionMode] = useState('manual');
  const [manualRoutine, setManualRoutine]     = useState('');
  const [manualNutrition, setManualNutrition] = useState('');
  const [bioFile, setBioFile]       = useState(null);
  const [bioUploading, setBioUploading] = useState(false);
  const [targets, setTargets]       = useState({ calorie_target: '', protein_target_g: '', carbs_target_g: '', fat_target_g: '' });
  const [savingTargets, setSavingTargets] = useState(false);

  useEffect(() => { load(); }, [id]);

  async function load() {
    setLoading(true);
    api.trainer.client(id).then(d => {
      setData(d);
      if (d.routine?.content) setManualRoutine(d.routine.content);
      if (d.nutrition_plan?.content) setManualNutrition(d.nutrition_plan.content);
      setTargets({
        calorie_target:   d.user?.calorie_target   || '',
        protein_target_g: d.user?.protein_target_g || '',
        carbs_target_g:   d.user?.carbs_target_g   || '',
        fat_target_g:     d.user?.fat_target_g      || '',
      });
    }).finally(() => setLoading(false));
  }

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

  async function saveManualRoutine() {
    setSavingManual(p => ({ ...p, routine: true }));
    try { await api.trainer.saveRoutine(id, manualRoutine); await load(); alert('Rutina guardada'); }
    catch (e) { alert(e.message); }
    finally { setSavingManual(p => ({ ...p, routine: false })); }
  }

  async function saveManualNutrition() {
    setSavingManual(p => ({ ...p, nutrition: true }));
    try { await api.trainer.saveNutrition(id, manualNutrition); await load(); alert('Plan guardado'); }
    catch (e) { alert(e.message); }
    finally { setSavingManual(p => ({ ...p, nutrition: false })); }
  }

  async function genRoutine() {
    setGenLoading(p => ({ ...p, routine: true }));
    try {
      await api.trainer.genRoutine(id, prompt || undefined);
      await load();
      setTab('routine');
    } catch (e) { alert(e.message); }
    finally { setGenLoading(p => ({ ...p, routine: false })); }
  }

  async function genNutrition() {
    setGenLoading(p => ({ ...p, nutrition: true }));
    try {
      await api.trainer.genNutrition(id, prompt || undefined);
      await load();
      setTab('nutrition');
    } catch (e) { alert(e.message); }
    finally { setGenLoading(p => ({ ...p, nutrition: false })); }
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

  if (loading) return <div style={{ textAlign: 'center', padding: 64 }}><div className="spinner" style={{ borderTopColor: 'var(--coral)', borderColor: 'var(--border)', width: 36, height: 36 }} /></div>;
  if (!data) return <div className="empty-state"><div className="icon">❌</div><p>Cliente no encontrado</p></div>;

  const { user, questionnaire: q, measurements, bioimpedance, routine, nutrition_plan, adherence } = data;

  const tabs = [
    { key: 'overview', label: 'Resumen' },
    { key: 'profile', label: '📋 Perfil' },
    { key: 'routine', label: '💪 Rutina' },
    { key: 'nutrition', label: '🥗 Nutrición' },
    { key: 'bio', label: '📊 Bio' },
  ];

  return (
    <div>
      {/* Back + header */}
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

      {/* Overview tab */}
      {tab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {/* Quick stats */}
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

      {/* Profile tab */}
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

      {/* Routine tab */}
      {tab === 'routine' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {[['manual', '✏️ Editar manualmente'], ['ai', '✨ Generar con IA']].map(([key, label]) => (
              <button key={key} onClick={() => setRoutineMode(key)} style={{
                flex: 1, padding: '10px', borderRadius: 10, fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer',
                background: routineMode === key ? 'var(--coral)' : 'var(--card)',
                color: routineMode === key ? '#fff' : 'var(--muted)',
                boxShadow: 'var(--shadow)',
              }}>{label}</button>
            ))}
          </div>

          {routineMode === 'manual' && (
            <div className="card" style={{ marginBottom: 16 }}>
              <p style={{ fontWeight: 700, marginBottom: 10 }}>✏️ Plan de entrenamiento</p>
              <textarea className="input" rows={16} placeholder={"Lunes — Pecho & Tríceps\n• Press banca 4x10\n• Aperturas 3x12\n\nMartes — Espalda & Bíceps\n..."} value={manualRoutine} onChange={e => setManualRoutine(e.target.value)} style={{ marginBottom: 10, resize: 'vertical', fontFamily: 'monospace', fontSize: 13 }} />
              <button className="btn-primary" onClick={saveManualRoutine} disabled={savingManual.routine || !manualRoutine.trim()} style={{ width: '100%', justifyContent: 'center' }}>
                {savingManual.routine ? <><span className="spinner" /> Guardando…</> : '💾 Guardar rutina'}
              </button>
            </div>
          )}

          {routineMode === 'ai' && (
            <div className="card" style={{ marginBottom: 16 }}>
              <p style={{ fontWeight: 700, marginBottom: 10 }}>Generar rutina con IA</p>
              <textarea className="input" rows={2} placeholder="Instrucciones adicionales (opcional)..." value={prompt} onChange={e => setPrompt(e.target.value)} style={{ marginBottom: 10, resize: 'vertical' }} />
              <button className="btn-primary" onClick={genRoutine} disabled={genLoading.routine} style={{ width: '100%', justifyContent: 'center' }}>
                {genLoading.routine ? <><span className="spinner" /> Generando…</> : '✨ Generar rutina'}
              </button>
            </div>
          )}

          {routine && routineMode === 'ai' && (
            <div className="card">
              <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 14, lineHeight: 1.7 }}>{routine.content}</pre>
              <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 10 }}>Guardado: {new Date(routine.created_at).toLocaleDateString('es')}</p>
            </div>
          )}

          {!routine && routineMode === 'ai' && (
            <div className="empty-state"><div className="icon">💪</div><p>Aún no hay rutina generada</p></div>
          )}
        </div>
      )}

      {/* Nutrition tab */}
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
            <div className="card" style={{ marginBottom: 16 }}>
              <p style={{ fontWeight: 700, marginBottom: 10 }}>✏️ Plan de alimentación</p>
              <textarea className="input" rows={16} placeholder={"Lunes\nDesayuno: Avena con frutas — 350 kcal\nAlmuerzo: Pollo con arroz — 550 kcal\nMerienda: Yogur griego — 150 kcal\nCena: Ensalada con atún — 400 kcal\n\nMartes\n..."} value={manualNutrition} onChange={e => setManualNutrition(e.target.value)} style={{ marginBottom: 10, resize: 'vertical', fontFamily: 'monospace', fontSize: 13 }} />
              <button className="btn-primary" onClick={saveManualNutrition} disabled={savingManual.nutrition || !manualNutrition.trim()} style={{ width: '100%', justifyContent: 'center', background: 'var(--gold)' }}>
                {savingManual.nutrition ? <><span className="spinner" /> Guardando…</> : '💾 Guardar plan'}
              </button>
            </div>
          )}

          {nutritionMode === 'ai' && (
            <div className="card" style={{ marginBottom: 16 }}>
              <p style={{ fontWeight: 700, marginBottom: 10 }}>Generar plan nutricional con IA</p>
              <textarea className="input" rows={2} placeholder="Instrucciones adicionales (opcional)..." value={prompt} onChange={e => setPrompt(e.target.value)} style={{ marginBottom: 10, resize: 'vertical' }} />
              <button className="btn-primary" onClick={genNutrition} disabled={genLoading.nutrition} style={{ width: '100%', justifyContent: 'center', background: 'var(--gold)' }}>
                {genLoading.nutrition ? <><span className="spinner" /> Generando…</> : '✨ Generar plan nutricional'}
              </button>
            </div>
          )}

          {nutrition_plan && nutritionMode === 'ai' && (
            <div className="card">
              <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 14, lineHeight: 1.7 }}>{nutrition_plan.content}</pre>
              <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 10 }}>Guardado: {new Date(nutrition_plan.created_at).toLocaleDateString('es')}</p>
            </div>
          )}

          {!nutrition_plan && nutritionMode === 'ai' && (
            <div className="empty-state"><div className="icon">🥗</div><p>Aún no hay plan nutricional</p></div>
          )}
        </div>
      )}

      {/* Bio tab */}
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
