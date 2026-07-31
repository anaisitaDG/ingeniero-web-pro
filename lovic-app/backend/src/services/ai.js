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

// Analiza una FOTO de un plato y estima alimentos + calorías + macros.
async function parseFoodImage(imagePath, fitnessGoal = 'maintenance') {
  const fs = require('fs');
  const imageData = fs.readFileSync(imagePath);
  const base64 = imageData.toString('base64');
  const ext = imagePath.split('.').pop().toLowerCase();
  const mediaType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
        {
          type: 'text',
          text: `Eres un nutricionista colombiano experto en estimar comida a partir de fotos. Analiza esta foto con MUCHO cuidado.

Proceso mental (no lo escribas, solo úsalo):
1. Identifica CADA alimento visible por separado. Mira bien: proteínas (carne, pollo, pescado, huevo), carbohidratos (arroz, arepa, papa, plátano, pasta, pan), verduras, salsas y bebidas.
2. Estima el TAMAÑO de cada porción usando referencias visibles: el tamaño del plato (~26 cm), los cubiertos, un vaso. Una porción de arroz que cubre 1/4 del plato son ~150 g (~200 kcal).
3. SUMA el aceite/grasa de cocción aunque NO se vea: casi toda comida salteada, frita o preparada lleva 1-2 cucharadas de aceite (~120-240 kcal). No lo ignores — es el error más común subestimar esto.
4. Considera salsas, aderezos y azúcar visibles o probables.

Referencias colombianas: arepa ~150 kcal c/u, patacón ~150 kcal c/u, arroz blanco porción ~200 kcal, frijoles porción ~250 kcal, huevo frito ~90 kcal, aguacate 1/2 ~160 kcal, mojarra frita ~250 kcal, bandeja paisa completa ~1200 kcal, chicharrón porción ~300 kcal.

Devuelve SOLO un JSON válido, sin texto adicional:
{
  "items": [ { "name": "alimento", "quantity": "porción estimada (ej: 1 taza, 150 g, 2 unidades)", "calories": número } ],
  "total_calories": número,
  "protein_g": número,
  "carbs_g": número,
  "fat_g": número,
  "meal_type": "breakfast|lunch|dinner|snack",
  "note": "si algo está tapado o es difícil de estimar, acláralo aquí en 1 frase"
}

Reglas:
- Sé realista, no optimista: es mejor una estimación ligeramente alta que subestimar.
- El total de calorías debe ser coherente con la suma de los items MÁS el aceite de cocción.
- Si dudas entre dos alimentos, elige el más común en Colombia y menciónalo en "note".
- meal_type según lo que se ve.`,
        },
      ],
    }],
  });

  const text = message.content[0].text.trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No se pudo analizar la foto');
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

async function generateBioSummary(data) {
  const lines = [
    data.weight_kg        != null && `Peso: ${data.weight_kg} kg`,
    data.bmi              != null && `IMC: ${data.bmi}`,
    data.body_fat_pct     != null && `Grasa corporal: ${data.body_fat_pct}%`,
    data.body_fat_kg      != null && `Peso de grasa: ${data.body_fat_kg} kg`,
    data.muscle_mass_kg   != null && `Peso muscular: ${data.muscle_mass_kg} kg`,
    data.skeletal_muscle_kg != null && `Músculo esquelético: ${data.skeletal_muscle_kg} kg`,
    data.body_water_pct   != null && `Agua corporal: ${data.body_water_pct}%`,
    data.visceral_fat     != null && `Grasa visceral: ${data.visceral_fat}`,
    data.bmr_kcal         != null && `Metabolismo basal: ${data.bmr_kcal} kcal`,
    data.calorie_target   != null && `Calorías objetivo: ${data.calorie_target} kcal`,
    data.target_muscle_kg != null && `Músculo a ganar: +${data.target_muscle_kg} kg`,
    data.target_fat_loss_kg != null && `Grasa a perder: -${data.target_fat_loss_kg} kg`,
  ].filter(Boolean).join('\n');

  if (!lines) return null;

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 400,
    messages: [{
      role: 'user',
      content: `Eres una entrenadora personal experta. Analiza estos resultados de bioimpedancia y da un resumen personalizado, cálido y motivador en español. Explica qué significa cada valor para la cliente, si está en rango saludable o no, y qué puede esperar mejorar con entrenamiento. Máximo 4 oraciones, sin tecnicismos innecesarios, sin usar asteriscos ni formato markdown.

Resultados:
${lines}

Responde directamente el resumen, sin título ni encabezado.`,
    }],
  });
  return message.content[0].text.trim();
}

// Compara dos registros de fotos de progreso (varios ángulos) y devuelve un
// análisis cálido, motivador y respetuoso de los cambios visibles.
async function comparePhotos(pairs, dateBefore, dateAfter, note) {
  const fs = require('fs');
  const mediaFor = (p) => {
    const ext = p.split('.').pop().toLowerCase();
    return ext === 'png' ? 'image/png' : 'image/jpeg';
  };
  const angleLabels = { frente: 'Frente', espalda: 'Espalda', perfil: 'Perfil' };

  const content = [];
  for (const { angle, beforePath, afterPath } of pairs) {
    content.push({ type: 'text', text: `Ángulo: ${angleLabels[angle] || angle} — ANTES (${dateBefore}):` });
    content.push({ type: 'image', source: { type: 'base64', media_type: mediaFor(beforePath), data: fs.readFileSync(beforePath).toString('base64') } });
    content.push({ type: 'text', text: `Ángulo: ${angleLabels[angle] || angle} — DESPUÉS (${dateAfter}):` });
    content.push({ type: 'image', source: { type: 'base64', media_type: mediaFor(afterPath), data: fs.readFileSync(afterPath).toString('base64') } });
  }

  content.push({
    type: 'text',
    text: `Eres una entrenadora personal experta, cálida y motivadora. Estás comparando fotos de progreso físico de una clienta tomadas en dos momentos (ANTES: ${dateBefore}, DESPUÉS: ${dateAfter}).${note ? ` Nota de la clienta: "${note}".` : ''}

Analiza los cambios VISIBLES entre las fotos por zonas del cuerpo.

Devuelve SOLO un JSON válido con este formato exacto:
{
  "summary": "resumen cálido y motivador de 3 a 5 oraciones sobre el progreso general",
  "zones": [
    { "area": "abdomen|cintura|brazos|hombros|pecho|espalda|piernas|gluteos|postura|general", "change": "cambio visible en esa zona, máximo 12 palabras", "trend": "mejora|estable|atencion" }
  ]
}

Reglas MUY importantes:
- Usa el nombre de "area" EXACTAMENTE de la lista permitida (abdomen, cintura, brazos, hombros, pecho, espalda, piernas, gluteos, postura, general).
- Incluye solo zonas realmente visibles en las fotos. De 2 a 5 zonas.
- Tono siempre respetuoso, positivo y de apoyo. Nunca hieras la autoestima ni juzgues el cuerpo.
- No des diagnósticos médicos ni cifras exactas de peso o grasa (no se saben por foto). Habla de cambios "aparentes" o "visibles".
- Si las diferencias son sutiles o la luz/ángulo/ropa dificultan comparar, dilo con honestidad y amabilidad, sin inventar cambios (usa trend "estable").
- El "summary" termina con una recomendación breve y motivadora. Sin asteriscos ni markdown.
- Responde SOLO el JSON, sin texto adicional.`,
  });

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 800,
    messages: [{ role: 'user', content }],
  });
  const text = message.content[0].text.trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return { summary: text, zones: [] };
  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return { summary: parsed.summary || '', zones: Array.isArray(parsed.zones) ? parsed.zones : [] };
  } catch {
    return { summary: text, zones: [] };
  }
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

module.exports = { parseFood, parseFoodImage, getFoodRecommendation, generateRoutine, generateNutritionPlan, parseBioimpedance, generateBioSummary, comparePhotos, suggestDayName };
