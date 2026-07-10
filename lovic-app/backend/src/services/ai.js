const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function parseFood(inputText, fitnessGoal = 'maintenance') {
  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `Eres un nutricionista experto. Analiza este registro de comida y devuelve SOLO un JSON válido sin explicaciones.

Comida registrada: "${inputText}"

Devuelve exactamente este formato JSON:
{
  "items": [
    { "name": "nombre del alimento", "quantity": "porción estimada", "calories": número }
  ],
  "total_calories": número,
  "protein_g": número,
  "carbs_g": número,
  "fat_g": número,
  "meal_type": "breakfast|lunch|dinner|snack"
}

Reglas:
- Estima las porciones de forma realista para una persona adulta
- "patacón" es plátano verde frito, típico colombiano (~150 kcal cada uno)
- "mojarra" es un pescado colombiano (~200 kcal porción normal)
- Si no reconoces un alimento, estima con alimentos similares
- meal_type basado en la hora actual (si no se especifica, usa "snack")
- Solo devuelve el JSON, sin texto adicional`
    }]
  });

  const text = message.content[0].text.trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No se pudo parsear la respuesta de IA');
  return JSON.parse(jsonMatch[0]);
}

async function getFoodRecommendation(remainingCalories, fitnessGoal, consumedToday) {
  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    messages: [{
      role: 'user',
      content: `Eres una nutricionista experta en fitness.

Datos del usuario:
- Calorías restantes hoy: ${remainingCalories} kcal
- Objetivo: ${fitnessGoal === 'fat_loss' ? 'pérdida de grasa' : fitnessGoal === 'muscle_gain' ? 'ganancia muscular' : 'mantenimiento'}
- Ya consumió hoy: ${consumedToday} kcal

Da una recomendación breve y práctica (máximo 3 líneas) sobre qué comer.
Si quedan menos de 200 kcal, sugiere algo muy ligero.
Si quedan más de 800 kcal, sugiere una comida completa.
Usa alimentos fáciles de conseguir. Sé específica y motivadora. Responde en español.`
    }]
  });

  return message.content[0].text.trim();
}

async function generateRoutine(questionnaire, overridePrompt) {
  const goal = Array.isArray(questionnaire.main_goal)
    ? questionnaire.main_goal.join(', ')
    : questionnaire.main_goal;

  const prompt = overridePrompt || `Crea una rutina de entrenamiento semanal personalizada para:
- Objetivo: ${goal}
- Días disponibles: ${questionnaire.training_days_week} por semana
- Experiencia previa: ${questionnaire.trained_before ? questionnaire.training_detail : 'Ninguna'}
- Lesiones: ${questionnaire.has_injury ? questionnaire.injury_detail : 'Ninguna'}
- Condiciones médicas: ${questionnaire.medical_detail || 'Ninguna'}

Formato: por día, con ejercicios, series, repeticiones y descansos. Incluye calentamiento y enfriamiento. Responde en español.`;

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  });
  return message.content[0].text.trim();
}

async function generateNutritionPlan(questionnaire, user, overridePrompt) {
  const goal = Array.isArray(questionnaire.main_goal)
    ? questionnaire.main_goal.join(', ')
    : questionnaire.main_goal;

  const prompt = overridePrompt || `Crea un plan nutricional personalizado para:
- Nombre: ${user.name}
- Objetivo: ${goal}
- Peso: ${questionnaire.weight_kg} kg, Talla: ${questionnaire.height_cm} cm
- Comidas al día: ${questionnaire.meals_per_day}
- Calidad de dieta actual: ${questionnaire.diet_quality}/10
- Alergias: ${questionnaire.has_allergies ? questionnaire.allergy_detail : 'Ninguna'}
- Alimentos a evitar: ${questionnaire.foods_to_avoid || 'Ninguno'}
- Tiempo de cocción disponible: ${questionnaire.cooking_time}

Incluye: objetivo calórico diario, distribución de macros, ejemplos de comidas para cada tiempo del día. Responde en español.`;

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  });
  return message.content[0].text.trim();
}

async function parseBioimpedance(imagePath) {
  const fs = require('fs');
  const imageData = fs.readFileSync(imagePath);
  const base64 = imageData.toString('base64');
  const ext = imagePath.split('.').pop().toLowerCase();
  const mediaType = ext === 'png' ? 'image/png' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png';

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: mediaType, data: base64 },
        },
        {
          type: 'text',
          text: `Analiza esta imagen de bioimpedancia y extrae TODOS los datos visibles. Distingue entre valores ACTUALES del cuerpo y valores OBJETIVO/META (los que indican cuánto ganar o perder, suelen aparecer con + o - o en sección "Para alcanzar tu peso ideal").

Devuelve SOLO un JSON válido con estos campos (usa null si no está en la imagen):
{
  "report_date": "YYYY-MM-DD" (fecha exacta del reporte visible en la imagen; lee con cuidado día y mes — no los confundas; si aparece DD/MM/YYYY convierte correctamente, ej: 10/07/2026 → "2026-07-10"),
  "weight_kg": número (peso corporal total en kg),
  "bmi": número (IMC / índice de masa corporal),
  "body_fat_pct": número (% grasa corporal),
  "body_fat_kg": número (peso de grasa corporal en kg),
  "muscle_mass_kg": número (peso muscular total en kg, busca "Peso muscular"),
  "skeletal_muscle_kg": número (masa muscular esquelética en kg, busca "Masa muscular esquelética"),
  "body_water_pct": número (% agua corporal),
  "visceral_fat": número (nivel de grasa visceral, suele ser un número entero 1-20),
  "bmr_kcal": número (metabolismo basal en kcal),
  "calorie_target": número (calorías objetivo recomendadas si aparece),
  "target_muscle_kg": número (kg de músculo a GANAR según recomendación, valor positivo),
  "target_fat_loss_kg": número (kg de grasa a PERDER según recomendación, guarda el valor positivo sin signo),
  "raw": {}
}
Solo devuelve el JSON, sin texto adicional.`,
        },
      ],
    }],
  });

  const text = message.content[0].text.trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return { body_fat_pct: null, muscle_mass_kg: null, visceral_fat: null, bmr_kcal: null, raw: {} };
  return JSON.parse(jsonMatch[0]);
}

async function suggestDayName(exerciseNames) {
  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 30,
    messages: [{
      role: 'user',
      content: `Dado estos ejercicios: ${exerciseNames.join(', ')}
Responde SOLO con el nombre del grupo muscular trabajado (máximo 3 palabras, en español).
Ejemplos: "Pierna", "Pecho y Tríceps", "Espalda y Bíceps", "Hombros", "Abdomen y Core", "Full Body", "Cardio".
Solo el nombre, sin puntuación ni explicación.`,
    }],
  });
  return message.content[0].text.trim().replace(/[."]/g, '');
}

module.exports = { parseFood, getFoodRecommendation, generateRoutine, generateNutritionPlan, parseBioimpedance, suggestDayName };
