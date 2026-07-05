const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM || 'Lovic Athletica <noreply@lovicgym.com>';

async function sendMagicLink(email, name, token, type = 'access') {
  const url = `${process.env.APP_URL}/auth/verify?token=${token}`;

  const subjects = {
    access:     '🔑 Tu enlace de acceso — Lovic Athletica Gym',
    invite:     '¡Tu plan está listo! — Lovic Athletica Gym 💪',
    onboarding: '¡Tu valoración está lista! — Lovic Athletica Gym 💪',
  };
  const bodies = {
    access:     'Haz clic en el botón para acceder a tu panel de Lovic. Este enlace expira en 15 minutos.',
    invite:     'Tu rutina de entrenamiento y plan de nutrición están cargados en la plataforma y listos para que comiences a transformar tu cuerpo.',
    onboarding: '¡Hola! Soy Lorena, tu entrenadora personal. Estoy emocionada de acompañarte en este proceso. Para comenzar, necesito conocerte mejor — haz clic en el botón para completar tu valoración inicial y así poder diseñar tu plan de entrenamiento y nutrición completamente personalizado. ¡Este es tu primer paso hacia la transformación! 💪',
  };
  const buttons = {
    access:     'Acceder ahora →',
    invite:     'Ver mi plan →',
    onboarding: 'Completar mi valoración →',
  };

  await resend.emails.send({
    from: FROM,
    to: email,
    subject: subjects[type] || subjects.access,
    html: `
      <div style="font-family:'Helvetica Neue',sans-serif;max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
        <div style="background:linear-gradient(135deg,#FF6B6B,#FF8E53);padding:2.5rem;text-align:center">
          <h1 style="color:#fff;margin:0;font-size:1.8rem;letter-spacing:.05em">LOVIC</h1>
          <p style="color:rgba(255,255,255,.85);margin:.25rem 0 0;font-size:.85rem;letter-spacing:.1em">ATHLETICA GYM</p>
        </div>
        <div style="padding:2.5rem">
          <h2 style="color:#1A1A1A;margin:0 0 1rem">Hola, ${name} 👋</h2>
          <p style="color:#555;line-height:1.7;margin:0 0 2rem">${bodies[type] || bodies.access}</p>
          <a href="${url}" style="display:inline-block;background:linear-gradient(135deg,#FF6B6B,#FF8E53);color:#fff;padding:.9rem 2.5rem;border-radius:8px;text-decoration:none;font-weight:700;font-size:1rem">
            ${buttons[type] || buttons.access}
          </a>
          <p style="color:#999;font-size:.8rem;margin:2rem 0 0">
            Si no solicitaste este acceso, ignora este correo.
          </p>
        </div>
      </div>
    `,
  });
}

async function notifyTrainerOnboarding(clientName) {
  const trainerEmail = process.env.TRAINER_EMAIL || 'hola@anaismoralesmkt.com';
  await resend.emails.send({
    from: FROM,
    to: trainerEmail,
    subject: `📋 ${clientName} completó su valoración`,
    html: `
      <div style="font-family:'Helvetica Neue',sans-serif;max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
        <div style="background:linear-gradient(135deg,#FF6B6B,#FF8E53);padding:2rem;text-align:center">
          <h1 style="color:#fff;margin:0;font-size:1.4rem">Nueva valoración 📋</h1>
        </div>
        <div style="padding:2rem">
          <p style="color:#1A1A1A;font-size:1rem;line-height:1.7">
            <strong>${clientName}</strong> acaba de completar su valoración inicial en Lovic.
          </p>
          <p style="color:#555;line-height:1.7">
            Ya puedes revisar su perfil, diseñar su rutina y plan nutricional.
          </p>
        </div>
      </div>
    `,
  });
}

async function sendWelcome(email, name) {
  await resend.emails.send({
    from: FROM,
    to: email,
    subject: '¡Bienvenida a Lovic Athletica Gym! ✨',
    html: `
      <div style="font-family:'Helvetica Neue',sans-serif;max-width:520px;margin:0 auto">
        <div style="background:linear-gradient(135deg,#FF6B6B,#FF8E53);padding:2.5rem;text-align:center;border-radius:12px 12px 0 0">
          <h1 style="color:#fff;margin:0">¡Bienvenida, ${name}!</h1>
        </div>
        <div style="background:#fff;padding:2rem;border-radius:0 0 12px 12px">
          <p style="color:#555;line-height:1.7">
            Tu valoración ha sido recibida. Lorena revisará tu perfil y en breve tendrás tu plan personalizado listo.
          </p>
          <p style="color:#555;line-height:1.7">
            Tu proceso de transformación comienza hoy. 💪
          </p>
        </div>
      </div>
    `,
  });
}

async function sendWeeklySummary(trainerEmail, trainerName, clients) {
  // clients = [{ name, workout_days, diet_days, streak, last_trained }]
  const activeClients = clients.filter(c => c.workout_days > 0 || c.diet_days > 0);
  const inactiveClients = clients.filter(c => c.workout_days === 0 && c.diet_days === 0);

  const clientRow = (c) => `
    <tr style="border-bottom:1px solid #f0f0f0">
      <td style="padding:10px 0;font-weight:600;color:#1A1A1A">${c.name}</td>
      <td style="padding:10px;text-align:center">
        <span style="background:${c.workout_days >= 3 ? '#dcfce7' : c.workout_days >= 1 ? '#fef9c3' : '#fee2e2'};color:${c.workout_days >= 3 ? '#16a34a' : c.workout_days >= 1 ? '#ca8a04' : '#dc2626'};padding:3px 10px;border-radius:99px;font-size:13px;font-weight:700">
          ${c.workout_days}/7 entrenamientos
        </span>
      </td>
      <td style="padding:10px;text-align:center;color:#555;font-size:13px">${c.streak > 0 ? `🔥 ${c.streak} días` : '—'}</td>
      <td style="padding:10px;text-align:center;color:#999;font-size:12px">${c.last_trained ? new Date(c.last_trained).toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' }) : 'Sin registro'}</td>
    </tr>
  `;

  const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - 7);
  const weekLabel = `${weekStart.toLocaleDateString('es', { day: 'numeric', month: 'long' })} – ${new Date().toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' })}`;

  await resend.emails.send({
    from: FROM,
    to: trainerEmail,
    subject: `📊 Resumen semanal de tus clientas — ${weekLabel}`,
    html: `
      <div style="font-family:'Helvetica Neue',sans-serif;max-width:620px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
        <div style="background:linear-gradient(135deg,#FF6B6B,#FF8E53);padding:2rem;text-align:center">
          <h1 style="color:#fff;margin:0;font-size:1.5rem">📊 Resumen Semanal</h1>
          <p style="color:rgba(255,255,255,.85);margin:.5rem 0 0;font-size:.9rem">${weekLabel}</p>
        </div>
        <div style="padding:2rem">
          <p style="color:#555;margin:0 0 1.5rem">Hola ${trainerName}, aquí el resumen de tus clientas esta semana:</p>

          ${activeClients.length > 0 ? `
          <h3 style="color:#1A1A1A;margin:0 0 1rem;font-size:1rem">✅ Activas esta semana (${activeClients.length})</h3>
          <table style="width:100%;border-collapse:collapse;margin-bottom:1.5rem">
            <thead>
              <tr style="border-bottom:2px solid #f0f0f0">
                <th style="padding:8px 0;text-align:left;color:#999;font-size:12px;font-weight:600">CLIENTA</th>
                <th style="padding:8px;text-align:center;color:#999;font-size:12px;font-weight:600">ENTRENOS</th>
                <th style="padding:8px;text-align:center;color:#999;font-size:12px;font-weight:600">RACHA</th>
                <th style="padding:8px;text-align:center;color:#999;font-size:12px;font-weight:600">ÚLTIMO ENTRENO</th>
              </tr>
            </thead>
            <tbody>${activeClients.map(clientRow).join('')}</tbody>
          </table>` : ''}

          ${inactiveClients.length > 0 ? `
          <h3 style="color:#dc2626;margin:0 0 1rem;font-size:1rem">⚠️ Sin actividad esta semana (${inactiveClients.length})</h3>
          <div style="background:#fff5f5;border-radius:8px;padding:1rem;margin-bottom:1.5rem">
            ${inactiveClients.map(c => `<p style="margin:4px 0;color:#555;font-size:14px">• ${c.name}</p>`).join('')}
          </div>` : ''}

          <div style="background:#f8f8f8;border-radius:8px;padding:1rem;text-align:center">
            <p style="color:#555;margin:0;font-size:13px">Total clientas: <strong>${clients.length}</strong> · Activas: <strong>${activeClients.length}</strong> · Inactivas: <strong>${inactiveClients.length}</strong></p>
          </div>

          <p style="color:#999;font-size:12px;margin:1.5rem 0 0;text-align:center">
            Este resumen se envía automáticamente cada lunes. <a href="${process.env.APP_URL}/trainer" style="color:#FF6B6B">Ver panel →</a>
          </p>
        </div>
      </div>
    `,
  });
}

module.exports = { sendMagicLink, sendWelcome, notifyTrainerOnboarding, sendWeeklySummary };
