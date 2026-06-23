import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const STEPS = [
  'Datos personales',
  'Tu objetivo',
  'Entrenamiento',
  'Salud',
  'Alimentación',
];

const GOALS = [
  { key: 'fat_loss',      label: 'Perder grasa',     icon: '🔥' },
  { key: 'muscle_gain',   label: 'Ganar músculo',    icon: '💪' },
  { key: 'maintenance',   label: 'Mantenerme',       icon: '⚖️' },
  { key: 'health',        label: 'Mejorar salud',    icon: '❤️' },
];

const TIMEFRAMES = ['1 mes', '3 meses', '6 meses', '1 año o más'];
const DAYS = ['1-2 días', '3 días', '4 días', '5 días', '6-7 días'];
const ENERGY = ['Muy baja', 'Baja', 'Normal', 'Alta', 'Muy alta'];
const DIET = ['Muy mala', 'Regular', 'Buena', 'Muy buena'];
const MEALS = ['1-2', '3', '4', '5 o más'];

export default function Onboarding() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    age: '', height_cm: '', weight_kg: '', city: '', phone: '',
    main_goal: [], goal_timeframe: '',
    trained_before: null, training_days_week: '',
    has_injury: null, injury_detail: '',
    takes_medication: null, medication_detail: '',
    energy_level: '',
    diet_quality: '', meals_per_day: '',
    drinks_water: null, has_allergies: null, allergy_detail: '',
    motivation: '', commitment_level: 8,
  });

  function set(key, val) {
    setForm(f => ({ ...f, [key]: val }));
  }

  function toggleGoal(key) {
    set('main_goal', form.main_goal.includes(key)
      ? form.main_goal.filter(g => g !== key)
      : [...form.main_goal, key]);
  }

  function canNext() {
    if (step === 0) return form.age && form.height_cm && form.weight_kg;
    if (step === 1) return form.main_goal.length > 0 && form.goal_timeframe;
    if (step === 2) return form.trained_before !== null && form.training_days_week;
    if (step === 3) return form.has_injury !== null && form.takes_medication !== null && form.energy_level;
    return form.diet_quality && form.meals_per_day && form.drinks_water !== null;
  }

  async function handleFinish() {
    setSaving(true);
    try {
      await api.questionnaire.save({
        ...form,
        fitness_goal: form.main_goal.includes('fat_loss') ? 'fat_loss'
                    : form.main_goal.includes('muscle_gain') ? 'muscle_gain'
                    : 'maintenance',
      });
      setUser(u => ({ ...u, has_questionnaire: true }));
      navigate('/');
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', maxWidth: 480, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ background: 'var(--card)', borderBottom: '1px solid var(--border)', padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--coral)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800 }}>L</div>
          <span style={{ fontWeight: 800, fontSize: 16 }}>Lovic Athletica</span>
        </div>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 10 }}>Paso {step + 1} de {STEPS.length} · {STEPS[step]}</p>
        <div style={{ display: 'flex', gap: 4 }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{ flex: 1, height: 4, borderRadius: 4, background: i <= step ? 'var(--coral)' : 'var(--border)', transition: 'background 0.3s' }} />
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: '24px 20px 120px' }}>
        {step === 0 && <Step0 form={form} set={set} user={user} />}
        {step === 1 && <Step1 form={form} toggleGoal={toggleGoal} set={set} />}
        {step === 2 && <Step2 form={form} set={set} />}
        {step === 3 && <Step3 form={form} set={set} />}
        {step === 4 && <Step4 form={form} set={set} />}
      </div>

      {/* Footer buttons */}
      <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, background: 'var(--card)', borderTop: '1px solid var(--border)', padding: '16px 20px', display: 'flex', gap: 12 }}>
        {step > 0 && (
          <button className="btn-ghost" onClick={() => setStep(s => s - 1)} style={{ flex: 1, padding: '14px' }}>
            ← Atrás
          </button>
        )}
        {step < STEPS.length - 1 ? (
          <button className="btn-primary" onClick={() => setStep(s => s + 1)} disabled={!canNext()} style={{ flex: 2, padding: '14px', opacity: canNext() ? 1 : 0.5 }}>
            Siguiente →
          </button>
        ) : (
          <button className="btn-primary" onClick={handleFinish} disabled={!canNext() || saving} style={{ flex: 2, padding: '14px', opacity: canNext() && !saving ? 1 : 0.5 }}>
            {saving ? <span className="spinner" /> : '💪 ¡Iniciar mi entrenamiento!'}
          </button>
        )}
      </div>
    </div>
  );
}

function Label({ children }) {
  return <label className="label" style={{ display: 'block', marginBottom: 6, marginTop: 18 }}>{children}</label>;
}

function Step0({ form, set, user }) {
  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Hola, {user?.name?.split(' ')[0]} 👋</h2>
      <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 24 }}>Cuéntanos un poco sobre ti para que Lorena pueda diseñar tu plan ideal.</p>

      <Label>Edad</Label>
      <input className="input" type="number" placeholder="Ej: 28" value={form.age} onChange={e => set('age', e.target.value)} />

      <Label>Altura (cm)</Label>
      <input className="input" type="number" placeholder="Ej: 165" value={form.height_cm} onChange={e => set('height_cm', e.target.value)} />

      <Label>Peso actual (kg)</Label>
      <input className="input" type="number" placeholder="Ej: 68" value={form.weight_kg} onChange={e => set('weight_kg', e.target.value)} />

      <Label>Ciudad</Label>
      <input className="input" placeholder="Ej: Bogotá" value={form.city} onChange={e => set('city', e.target.value)} />

      <Label>WhatsApp / Teléfono</Label>
      <input className="input" placeholder="Ej: +57 300 123 4567" value={form.phone} onChange={e => set('phone', e.target.value)} />
    </div>
  );
}

function Step1({ form, toggleGoal, set }) {
  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>¿Cuál es tu objetivo? 🎯</h2>
      <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 20 }}>Puedes elegir más de uno.</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 8 }}>
        {GOALS.map(g => (
          <button key={g.key} type="button" onClick={() => toggleGoal(g.key)} style={{
            padding: '18px 12px', borderRadius: 14, border: `2px solid ${form.main_goal.includes(g.key) ? 'var(--coral)' : 'var(--border)'}`,
            background: form.main_goal.includes(g.key) ? 'var(--coral-light)' : 'var(--card)',
            cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s',
          }}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>{g.icon}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: form.main_goal.includes(g.key) ? 'var(--coral)' : 'var(--text)' }}>{g.label}</div>
          </button>
        ))}
      </div>

      <Label>¿En cuánto tiempo quieres lograrlo?</Label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {TIMEFRAMES.map(t => (
          <button key={t} type="button" onClick={() => set('goal_timeframe', t)} style={{
            padding: '8px 16px', borderRadius: 20, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13,
            background: form.goal_timeframe === t ? 'var(--coral)' : 'var(--card)',
            color: form.goal_timeframe === t ? '#fff' : 'var(--muted)',
            boxShadow: 'var(--shadow)',
          }}>{t}</button>
        ))}
      </div>
    </div>
  );
}

function Step2({ form, set }) {
  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Entrenamiento 💪</h2>
      <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 20 }}>Para adaptar tu rutina correctamente.</p>

      <Label>¿Has entrenado antes?</Label>
      <div style={{ display: 'flex', gap: 12 }}>
        <YesNo value={form.trained_before} onChange={v => set('trained_before', v)} />
      </div>

      {form.trained_before && (
        <>
          <Label>¿Qué tipo de entrenamiento has hecho?</Label>
          <input className="input" placeholder="Ej: pesas, crossfit, yoga..." value={form.training_detail} onChange={e => set('training_detail', e.target.value)} />
        </>
      )}

      <Label>¿Cuántos días a la semana puedes entrenar?</Label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {DAYS.map(d => (
          <button key={d} type="button" onClick={() => set('training_days_week', d)} style={{
            padding: '8px 16px', borderRadius: 20, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13,
            background: form.training_days_week === d ? 'var(--coral)' : 'var(--card)',
            color: form.training_days_week === d ? '#fff' : 'var(--muted)',
            boxShadow: 'var(--shadow)',
          }}>{d}</button>
        ))}
      </div>

    </div>
  );
}

function Step3({ form, set }) {
  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Salud ❤️</h2>
      <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 20 }}>Esta información es confidencial y solo la verá Lorena.</p>

      <Label>¿Tienes alguna lesión o dolor?</Label>
      <YesNo value={form.has_injury} onChange={v => set('has_injury', v)} />
      {form.has_injury && (
        <>
          <Label>Describe tu lesión</Label>
          <input className="input" placeholder="Ej: dolor lumbar, rodilla..." value={form.injury_detail} onChange={e => set('injury_detail', e.target.value)} />
        </>
      )}

      <Label>¿Tomas algún medicamento?</Label>
      <YesNo value={form.takes_medication} onChange={v => set('takes_medication', v)} />
      {form.takes_medication && (
        <>
          <Label>¿Cuál?</Label>
          <input className="input" placeholder="Nombre del medicamento" value={form.medication_detail} onChange={e => set('medication_detail', e.target.value)} />
        </>
      )}

      <Label>Nivel de energía habitual</Label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {ENERGY.map(e => (
          <button key={e} type="button" onClick={() => set('energy_level', e)} style={{
            padding: '8px 16px', borderRadius: 20, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13,
            background: form.energy_level === e ? 'var(--coral)' : 'var(--card)',
            color: form.energy_level === e ? '#fff' : 'var(--muted)',
            boxShadow: 'var(--shadow)',
          }}>{e}</button>
        ))}
      </div>
    </div>
  );
}

function Step4({ form, set }) {
  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Alimentación 🥗</h2>
      <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 20 }}>Para que tu plan nutricional sea realista.</p>

      <Label>¿Cómo calificarías tu alimentación actual?</Label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {DIET.map(d => (
          <button key={d} type="button" onClick={() => set('diet_quality', d)} style={{
            padding: '8px 16px', borderRadius: 20, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13,
            background: form.diet_quality === d ? 'var(--coral)' : 'var(--card)',
            color: form.diet_quality === d ? '#fff' : 'var(--muted)',
            boxShadow: 'var(--shadow)',
          }}>{d}</button>
        ))}
      </div>

      <Label>¿Cuántas comidas haces al día?</Label>
      <div style={{ display: 'flex', gap: 8 }}>
        {MEALS.map(m => (
          <button key={m} type="button" onClick={() => set('meals_per_day', m)} style={{
            flex: 1, padding: '10px 6px', borderRadius: 12, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13,
            background: form.meals_per_day === m ? 'var(--coral)' : 'var(--card)',
            color: form.meals_per_day === m ? '#fff' : 'var(--muted)',
            boxShadow: 'var(--shadow)',
          }}>{m}</button>
        ))}
      </div>

      <Label>¿Tomas suficiente agua al día?</Label>
      <YesNo value={form.drinks_water} onChange={v => set('drinks_water', v)} />

      <Label>¿Tienes alergias o intolerancias alimentarias?</Label>
      <YesNo value={form.has_allergies} onChange={v => set('has_allergies', v)} />
      {form.has_allergies && (
        <>
          <Label>¿Cuáles?</Label>
          <input className="input" placeholder="Ej: lactosa, gluten..." value={form.allergy_detail} onChange={e => set('allergy_detail', e.target.value)} />
        </>
      )}

      <Label>¿Qué te motivó a empezar? (opcional)</Label>
      <textarea className="input" rows={3} placeholder="Cuéntanos..." value={form.motivation} onChange={e => set('motivation', e.target.value)} style={{ resize: 'none' }} />

      <Label>Compromiso del 1 al 10: {form.commitment_level}</Label>
      <input type="range" min={1} max={10} value={form.commitment_level} onChange={e => set('commitment_level', parseInt(e.target.value))}
        style={{ width: '100%', accentColor: 'var(--coral)', marginTop: 6 }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)' }}>
        <span>Poco comprometido</span><span>100% comprometido</span>
      </div>
    </div>
  );
}

function YesNo({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
      {[{ v: true, label: 'Sí' }, { v: false, label: 'No' }].map(opt => (
        <button key={String(opt.v)} type="button" onClick={() => onChange(opt.v)} style={{
          flex: 1, padding: '12px', borderRadius: 12, border: `2px solid ${value === opt.v ? 'var(--coral)' : 'var(--border)'}`,
          background: value === opt.v ? 'var(--coral-light)' : 'var(--card)',
          fontWeight: 700, fontSize: 14, cursor: 'pointer', color: value === opt.v ? 'var(--coral)' : 'var(--muted)',
        }}>{opt.label}</button>
      ))}
    </div>
  );
}
