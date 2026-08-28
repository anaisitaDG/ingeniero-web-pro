const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM || 'Lovic Athletica <noreply@lovicgym.com>';

async function sendMagicLink(email, name, token, type = 'access') {
  // /api/ para que nginx lo enrute al backend (las rutas de la API viven bajo /api)
  const url = `${process.env.APP_URL}/api/auth/verify?token=${token}`;

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
    subject: '¡Te damos la bienvenida a Lovic Athletica Gym! ✨',
    html: `
      <div style="font-family:'Helvetica Neue',sans-serif;max-width:520px;margin:0 auto">
        <div style="background:linear-gradient(135deg,#FF6B6B,#FF8E53);padding:2.5rem;text-align:center;border-radius:12px 12px 0 0">
          <h1 style="color:#fff;margin:0">¡Hola, ${name}!</h1>
        </div>
        <div style="background:#fff;padding:2rem;border-radius:0 0 12px 12px">
          <p style="color:#555;line-height:1.7">Tu valoración ha sido recibida. Lorena revisará tu perfil y en breve tendrás tu plan personalizado listo.</p>
          <p style="color:#555;line-height:1.7">Tu proceso de transformación comienza hoy. 💪</p>
        </div>
      </div>
    `,
  });
}

async function sendWelcomeWithInstructions(email, name, phone) {
  const appUrl = process.env.APP_URL || 'https://lovicgym.com';
  await resend.emails.send({
    from: FROM,
    to: email,
    subject: '¡Te damos la bienvenida a Lovic Athletica Gym! ✨',
    html: `
      <div style="font-family:'Helvetica Neue',sans-serif;max-width:540px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">

        <!-- Header -->
        <div style="background:linear-gradient(135deg,#FF6B6B,#FF8E53);padding:2.5rem;text-align:center">
          <h1 style="color:#fff;margin:0;font-size:1.8rem;letter-spacing:.05em">LOVIC</h1>
          <p style="color:rgba(255,255,255,.85);margin:.25rem 0 0;font-size:.85rem;letter-spacing:.1em">ATHLETICA GYM</p>
        </div>

        <div style="padding:2rem">
          <!-- Bienvenida -->
          <h2 style="color:#1A1A1A;margin:0 0 .75rem">¡Hola, ${name}! 🎉</h2>
          <p style="color:#555;line-height:1.7;margin:0 0 1.5rem">
            Tu valoración ha sido recibida. Lorena ya está revisando tu perfil para diseñar tu plan de entrenamiento y nutrición completamente personalizado. En breve te avisará cuando esté listo. ¡Este es tu primer paso hacia la transformación! 💪
          </p>

          <!-- Acceso -->
          <div style="background:#FFF8F8;border-left:4px solid #FF6B6B;border-radius:8px;padding:1.25rem 1.5rem;margin-bottom:1.5rem">
            <p style="color:#1A1A1A;font-weight:700;margin:0 0 .75rem;font-size:1rem">🔑 Cómo ingresar a tu app</p>
            <p style="color:#555;line-height:1.7;margin:0 0 .5rem">Puedes entrar en cualquier momento con:</p>
            <table style="width:100%;border-collapse:collapse">
              <tr>
                <td style="padding:6px 0;color:#888;font-size:.9rem;width:110px">Usuario:</td>
                <td style="padding:6px 0;color:#1A1A1A;font-weight:700;font-size:.95rem">${email}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;color:#888;font-size:.9rem">Contraseña:</td>
                <td style="padding:6px 0;color:#FF6B6B;font-weight:800;font-size:1.1rem;letter-spacing:.05em">${phone}</td>
              </tr>
            </table>
            <p style="color:#999;font-size:.8rem;margin:.75rem 0 0">Guarda este correo para no olvidarlo. Puedes cambiar tu contraseña desde tu perfil en la app.</p>
          </div>

          <!-- Instalar en iPhone -->
          <div style="background:#F0F7FF;border-radius:10px;padding:1.25rem 1.5rem;margin-bottom:1rem">
            <p style="color:#1A1A1A;font-weight:700;margin:0 0 .75rem">🍎 Instalar en iPhone</p>
            <ol style="color:#555;line-height:2;margin:0;padding-left:1.25rem;font-size:.9rem">
              <li>Abre <strong>Safari</strong> y ve a <a href="${appUrl}" style="color:#FF6B6B">${appUrl}</a></li>
              <li>Toca el botón de <strong>compartir</strong> (cuadrado con flecha ↑)</li>
              <li>Desplázate y toca <strong>"Agregar a pantalla de inicio"</strong></li>
              <li>Toca <strong>"Agregar"</strong> — ¡listo! La app aparece como ícono en tu pantalla</li>
            </ol>
          </div>

          <!-- Instalar en Android -->
          <div style="background:#F0FFF4;border-radius:10px;padding:1.25rem 1.5rem;margin-bottom:1.5rem">
            <p style="color:#1A1A1A;font-weight:700;margin:0 0 .75rem">🤖 Instalar en Android</p>
            <ol style="color:#555;line-height:2;margin:0;padding-left:1.25rem;font-size:.9rem">
              <li>Abre <strong>Chrome</strong> y ve a <a href="${appUrl}" style="color:#16a34a">${appUrl}</a></li>
              <li>Toca los <strong>tres puntos ⋮</strong> en la esquina superior derecha</li>
              <li>Toca <strong>"Instalar app"</strong> o <strong>"Agregar a pantalla de inicio"</strong></li>
              <li>Confirma tocando <strong>"Instalar"</strong> — ¡ya la tienes!</li>
            </ol>
          </div>

          <a href="${appUrl}" style="display:block;background:linear-gradient(135deg,#FF6B6B,#FF8E53);color:#fff;padding:1rem;border-radius:10px;text-decoration:none;font-weight:700;font-size:1rem;text-align:center">
            Entrar a mi app →
          </a>

          <p style="color:#bbb;font-size:.8rem;margin:1.5rem 0 0;text-align:center">
            Si tienes alguna duda, escríbele a Lorena directamente.
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
    subject: `📊 Resumen semanal de tus clientes — ${weekLabel}`,
    html: `
      <div style="font-family:'Helvetica Neue',sans-serif;max-width:620px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
        <div style="background:linear-gradient(135deg,#FF6B6B,#FF8E53);padding:2rem;text-align:center">
          <h1 style="color:#fff;margin:0;font-size:1.5rem">📊 Resumen Semanal</h1>
          <p style="color:rgba(255,255,255,.85);margin:.5rem 0 0;font-size:.9rem">${weekLabel}</p>
        </div>
        <div style="padding:2rem">
          <p style="color:#555;margin:0 0 1.5rem">Hola ${trainerName}, aquí el resumen de tus clientes esta semana:</p>

          ${activeClients.length > 0 ? `
          <h3 style="color:#1A1A1A;margin:0 0 1rem;font-size:1rem">✅ Activos esta semana (${activeClients.length})</h3>
          <table style="width:100%;border-collapse:collapse;margin-bottom:1.5rem">
            <thead>
              <tr style="border-bottom:2px solid #f0f0f0">
                <th style="padding:8px 0;text-align:left;color:#999;font-size:12px;font-weight:600">CLIENTE</th>
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
            <p style="color:#555;margin:0;font-size:13px">Total clientes: <strong>${clients.length}</strong> · Activos: <strong>${activeClients.length}</strong> · Inactivos: <strong>${inactiveClients.length}</strong></p>
          </div>

          <p style="color:#999;font-size:12px;margin:1.5rem 0 0;text-align:center">
            Este resumen se envía automáticamente cada lunes. <a href="${process.env.APP_URL}/trainer" style="color:#FF6B6B">Ver panel →</a>
          </p>
        </div>
      </div>
    `,
  });
}

async function sendRenewalReminder(clientEmail, clientName, daysLeft, trainerEmail, trainerName) {
  const subject = `⏰ Tu plan vence en ${daysLeft} días — Lovic Athletica`;
  const html = `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden">
      <div style="background:#FF6B6B;padding:28px 32px">
        <h1 style="color:#fff;margin:0;font-size:22px">¡Hola, ${clientName}! 👋</h1>
      </div>
      <div style="padding:32px">
        <p style="font-size:16px;color:#333">Tu plan de entrenamiento vence en <strong>${daysLeft} días</strong>.</p>
        <p style="font-size:15px;color:#666">Habla con Lorena para renovar y seguir avanzando hacia tus objetivos. ¡No pares ahora! 💪</p>
        <a href="${process.env.APP_URL}" style="display:inline-block;margin-top:20px;background:#FF6B6B;color:#fff;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:700">Ver mi plan →</a>
      </div>
    </div>`;

  await resend.emails.send({ from: FROM, to: clientEmail, subject, html });

  // Notificar también a Lorena
  await resend.emails.send({
    from: FROM,
    to: trainerEmail,
    subject: `⏰ Plan de ${clientName} vence en ${daysLeft} días`,
    html: `<p style="font-family:sans-serif">Hola ${trainerName}, el plan de <strong>${clientName}</strong> vence en <strong>${daysLeft} días</strong>. Es un buen momento para contactarle y renovar.</p>`,
  });
}

// ── Aviso a la entrenadora: nuevas medidas de una cliente ─────────────────────
const MEASURE_FIELDS = [
  { key: 'weight_kg',  label: 'Peso',    unit: 'kg', better: 'down' },
  { key: 'waist_cm',   label: 'Cintura', unit: 'cm', better: 'down' },
  { key: 'hip_cm',     label: 'Cadera',  unit: 'cm', better: 'down' },
  { key: 'chest_cm',   label: 'Pecho',   unit: 'cm', better: 'up'   },
  { key: 'arm_cm',     label: 'Brazo',   unit: 'cm', better: 'up'   },
  { key: 'forearm_cm', label: 'Antebrazo', unit: 'cm', better: 'up' },
  { key: 'thigh_cm',   label: 'Muslo',   unit: 'cm', better: 'up'   },
  { key: 'calf_cm',    label: 'Pantorrilla', unit: 'cm', better: 'up' },
];
const numOrNull = (v) => (v == null || v === '' ? null : Number(v));

async function sendMeasurementUpdate(trainerEmail, trainerName, clientName, clientId, current, previous) {
  const appUrl = process.env.APP_URL || 'https://app.lovicgym.com';
  const link = `${appUrl}/trainer/clients/${clientId}`;

  const rows = [];
  let weightDelta = null;
  for (const f of MEASURE_FIELDS) {
    const now = numOrNull(current[f.key]);
    if (now == null) continue;
    const before = previous ? numOrNull(previous[f.key]) : null;
    const delta = before != null ? +(now - before).toFixed(1) : null;
    if (f.key === 'weight_kg' && delta != null) weightDelta = delta;
    let color = '#8A8F98', arrow = '', deltaTxt = '—';
    if (delta != null) {
      if (delta === 0) { deltaTxt = '='; }
      else {
        const good = f.better === 'down' ? delta < 0 : delta > 0;
        color = good ? '#2E9E6B' : '#E0A32E';
        arrow = delta < 0 ? '▼' : '▲';
        deltaTxt = `${arrow} ${delta > 0 ? '+' : ''}${delta}`;
      }
    }
    rows.push(`
      <tr>
        <td style="padding:9px 8px;font-weight:600;color:#1A1A1A;border-top:1px solid #EFEDEA;font-size:14px">${f.label}</td>
        <td style="padding:9px 8px;text-align:right;color:#666;border-top:1px solid #EFEDEA;font-size:14px">${before != null ? `${before}${f.unit}` : '—'}</td>
        <td style="padding:9px 8px;text-align:right;color:#1A1A1A;border-top:1px solid #EFEDEA;font-size:14px">${now}${f.unit}</td>
        <td style="padding:9px 8px;text-align:right;font-weight:800;color:${color};border-top:1px solid #EFEDEA;font-size:14px">${deltaTxt}</td>
      </tr>`);
  }

  // Asunto con el cambio principal
  let change = 'actualizó sus medidas';
  if (weightDelta != null && weightDelta !== 0) {
    change = weightDelta < 0 ? `bajó ${Math.abs(weightDelta)} kg 📉` : `subió ${Math.abs(weightDelta)} kg 📈`;
  } else if (!previous) {
    change = 'registró sus primeras medidas';
  }
  const subject = `${clientName} subió medidas — ${change}`;
  const initial = (clientName || '?').charAt(0).toUpperCase();

  await resend.emails.send({
    from: FROM,
    to: trainerEmail,
    subject,
    html: `
    <div style="font-family:-apple-system,Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)">
      <div style="background:linear-gradient(135deg,#FF6B6B,#FF8E53);padding:28px;text-align:center">
        <h1 style="color:#fff;margin:0;font-size:20px;letter-spacing:.06em;font-weight:800">LOVIC</h1>
        <p style="color:rgba(255,255,255,.9);margin:4px 0 0;font-size:12px;letter-spacing:.12em">NUEVAS MEDIDAS DE UN CLIENTE</p>
      </div>
      <div style="padding:26px 28px 30px">
        <table cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:22px"><tr>
          <td width="46" valign="middle" style="padding-right:12px">
            <div style="width:46px;height:46px;border-radius:50%;background:linear-gradient(135deg,#FF6B6B,#FF8E53);color:#fff;text-align:center;line-height:46px;font-weight:700;font-size:18px">${initial}</div>
          </td>
          <td valign="middle">
            <div style="font-weight:800;font-size:17px;color:#1A1A1A">${clientName}</div>
            <div style="color:#8A8F98;font-size:13px">${previous ? 'Comparado con su registro anterior' : 'Primer registro de medidas'}</div>
          </td>
        </tr></table>
        <p style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#FF6B6B;font-weight:800;margin:0 0 12px">📏 Medidas</p>
        <table style="width:100%;border-collapse:collapse">
          <thead><tr>
            <th style="text-align:left;font-size:11px;color:#8A8F98;padding:0 8px 8px">MEDIDA</th>
            <th style="text-align:right;font-size:11px;color:#8A8F98;padding:0 8px 8px">ANTES</th>
            <th style="text-align:right;font-size:11px;color:#8A8F98;padding:0 8px 8px">AHORA</th>
            <th style="text-align:right;font-size:11px;color:#8A8F98;padding:0 8px 8px">CAMBIO</th>
          </tr></thead>
          <tbody>${rows.join('')}</tbody>
        </table>
        ${current.notes ? `<p style="font-size:13px;color:#666;margin-top:14px"><b>Nota del cliente:</b> ${current.notes}</p>` : ''}
        <a href="${link}" style="display:block;text-align:center;margin-top:24px;text-decoration:none;background:linear-gradient(135deg,#FF6B6B,#FF8E53);color:#fff;font-weight:800;padding:14px;border-radius:12px;font-size:15px">Ver perfil de ${clientName.split(' ')[0]} →</a>
        <p style="text-align:center;color:#bbb;font-size:11px;margin-top:16px">Recibes este correo porque un cliente registró nuevas medidas en Lovic.</p>
      </div>
    </div>`,
  });
}

// ── Aviso a la entrenadora: nuevas fotos de progreso (con análisis IA) ─────────
async function sendProgressPhotoUpdate(trainerEmail, trainerName, clientName, clientId, { summary, zones, dateBefore, dateAfter, isFirst }) {
  const appUrl = process.env.APP_URL || 'https://app.lovicgym.com';
  const link = `${appUrl}/trainer/clients/${clientId}`;
  const initial = (clientName || '?').charAt(0).toUpperCase();
  const TREND = { mejora: '#2E9E6B', atencion: '#E0A32E', estable: '#8A8F98' };
  const LABEL = { mejora: 'Mejora', atencion: 'A cuidar', estable: 'Estable' };
  const AREA = { hombros:'Hombros', pecho:'Pecho', espalda:'Espalda', brazos:'Brazos', cintura:'Cintura', abdomen:'Abdomen', gluteos:'Glúteos', piernas:'Piernas', postura:'Postura', general:'General' };

  const zonesHtml = (zones || []).filter(z => AREA[z.area]).map(z => `
    <div style="font-size:13.5px;color:#1A1A1A;margin:6px 0">
      <span style="width:9px;height:9px;border-radius:50%;background:${TREND[z.trend] || TREND.estable};display:inline-block;vertical-align:middle;margin-right:8px"></span>
      <span style="vertical-align:middle"><b>${AREA[z.area]}:</b> ${z.change} · ${LABEL[z.trend] || 'Estable'}</span>
    </div>`).join('');

  const subject = `${clientName} subió fotos de progreso${isFirst ? '' : ' — hay cambios 📸'}`;

  await resend.emails.send({
    from: FROM,
    to: trainerEmail,
    subject,
    html: `
    <div style="font-family:-apple-system,Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)">
      <div style="background:linear-gradient(135deg,#FF6B6B,#FF8E53);padding:28px;text-align:center">
        <h1 style="color:#fff;margin:0;font-size:20px;letter-spacing:.06em;font-weight:800">LOVIC</h1>
        <p style="color:rgba(255,255,255,.9);margin:4px 0 0;font-size:12px;letter-spacing:.12em">NUEVAS FOTOS DE PROGRESO</p>
      </div>
      <div style="padding:26px 28px 30px">
        <table cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:22px"><tr>
          <td width="46" valign="middle" style="padding-right:12px">
            <div style="width:46px;height:46px;border-radius:50%;background:linear-gradient(135deg,#FF6B6B,#FF8E53);color:#fff;text-align:center;line-height:46px;font-weight:700;font-size:18px">${initial}</div>
          </td>
          <td valign="middle">
            <div style="font-weight:800;font-size:17px;color:#1A1A1A">${clientName}</div>
            <div style="color:#8A8F98;font-size:13px">${isFirst ? 'Primer registro de fotos' : `Registro del ${dateAfter} · vs. ${dateBefore}`}</div>
          </td>
        </tr></table>
        <p style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#FF6B6B;font-weight:800;margin:0 0 12px">📸 Análisis de fotos (IA)</p>
        <div style="background:#FFF8F5;border:1px solid #FDE6DC;border-radius:12px;padding:16px 18px">
          <p style="margin:0;font-size:14px;line-height:1.65;color:#3a3a3a">${summary || 'Se registraron nuevas fotos de progreso.'}</p>
          ${zonesHtml ? `<div style="margin-top:12px">${zonesHtml}</div>` : ''}
          <p style="font-size:11px;color:#8A8F98;margin-top:12px">Análisis generado por IA a partir de las fotos. Es orientativo, no un diagnóstico médico.</p>
        </div>
        <a href="${link}" style="display:block;text-align:center;margin-top:24px;text-decoration:none;background:linear-gradient(135deg,#FF6B6B,#FF8E53);color:#fff;font-weight:800;padding:14px;border-radius:12px;font-size:15px">Ver fotos en la app →</a>
        <p style="text-align:center;color:#bbb;font-size:11px;margin-top:16px">Por privacidad, las fotos no se adjuntan — ábrelas de forma segura en la app.</p>
      </div>
    </div>`,
  });
}

// ── Estadísticas a la entrenadora (2 semanas después de cargar la rutina) ──────
async function sendClientStats(trainerEmail, trainerName, clientName, clientId, s) {
  const appUrl = process.env.APP_URL || 'https://app.lovicgym.com';
  const link = `${appUrl}/trainer/clients/${clientId}`;
  const initial = (clientName || '?').charAt(0).toUpperCase();
  // Tarjeta como celda de tabla (Gmail no soporta flexbox — se usa <table> para el grid)
  const stat = (label, value, sub) => `
    <td width="50%" valign="top" style="padding:5px">
      <div style="background:#FFF8F5;border:1px solid #FDE6DC;border-radius:12px;padding:12px 14px">
        <p style="margin:0;font-size:11px;color:#8A8F98;font-weight:700;text-transform:uppercase;letter-spacing:.04em">${label}</p>
        <p style="margin:4px 0 0;font-size:20px;font-weight:900;color:#1A1A1A">${value}</p>
        ${sub ? `<p style="margin:2px 0 0;font-size:11px;color:#8A8F98">${sub}</p>` : ''}
      </div>
    </td>`;

  const weightLine = (s.weightNow != null)
    ? stat('Peso actual', `${s.weightNow} kg`, s.weightDelta != null ? `${s.weightDelta > 0 ? '+' : ''}${s.weightDelta} kg desde el inicio` : '')
    : stat('Peso', 'Sin registro', '');
  const routineLabel = s.planName ? `Rutina "${s.planName}" · últimas 2 semanas` : 'Últimas 2 semanas';

  await resend.emails.send({
    from: FROM,
    to: trainerEmail,
    subject: `📊 ${clientName}: 2 semanas de "${s.planName || 'su rutina'}" — ¿ajustar?`,
    html: `
    <div style="font-family:-apple-system,Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)">
      <div style="background:linear-gradient(135deg,#FF6B6B,#FF8E53);padding:28px;text-align:center">
        <h1 style="color:#fff;margin:0;font-size:20px;letter-spacing:.06em;font-weight:800">LOVIC</h1>
        <p style="color:rgba(255,255,255,.9);margin:4px 0 0;font-size:12px;letter-spacing:.12em">REPORTE DE PROGRESO · 2 SEMANAS</p>
      </div>
      <div style="padding:26px 28px 30px">
        <table cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:18px"><tr>
          <td width="46" valign="middle" style="padding-right:12px">
            <div style="width:46px;height:46px;border-radius:50%;background:linear-gradient(135deg,#FF6B6B,#FF8E53);color:#fff;text-align:center;line-height:46px;font-weight:700;font-size:18px">${initial}</div>
          </td>
          <td valign="middle">
            <div style="font-weight:800;font-size:17px;color:#1A1A1A">${clientName}</div>
            <div style="color:#8A8F98;font-size:13px">${routineLabel}</div>
          </td>
        </tr></table>
        <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin-bottom:16px">
          <tr>${stat('Entrenamientos', `${s.daysTrained}`, 'días activos')}${stat('Series registradas', `${s.totalSets}`, 'total de series')}</tr>
          <tr>${weightLine}${stat('Agua', s.avgWater != null ? `${s.avgWater} vasos` : '—', 'promedio por día')}</tr>
          <tr>${stat('Comidas', s.avgCalories != null ? `${s.avgCalories} kcal` : '—', 'consumo promedio/día')}<td width="50%"></td></tr>
        </table>
        <p style="font-size:14px;color:#3a3a3a;line-height:1.6;margin:0 0 20px">
          Ya lleva 2 semanas con esta rutina. Revisa su progreso y <b>decide si conviene ajustarla</b> (subir cargas, cambiar ejercicios) o mantenerla.
        </p>
        <a href="${link}" style="display:block;text-align:center;text-decoration:none;background:linear-gradient(135deg,#FF6B6B,#FF8E53);color:#fff;font-weight:800;padding:14px;border-radius:12px;font-size:15px">Ver perfil y ajustar rutina →</a>
        <p style="text-align:center;color:#bbb;font-size:11px;margin-top:16px">Este reporte se envía automáticamente 2 semanas después de cargar una rutina nueva.</p>
      </div>
    </div>`,
  });
}

// ── Aviso a la entrenadora: clientes que dejaron de registrar comida ───────────
async function sendNutritionAlert(trainerEmail, trainerName, clients) {
  const appUrl = process.env.APP_URL || 'https://app.lovicgym.com';
  const rows = clients.map(c => `
    <tr>
      <td style="padding:10px 8px;font-weight:700;font-size:14px">${c.name}</td>
      <td style="padding:10px 8px;text-align:right;color:#b45309;font-weight:700;font-size:13px">${c.daysSince} días sin registrar</td>
    </tr>`).join('');
  await resend.emails.send({
    from: FROM,
    to: trainerEmail,
    subject: `🍽️ ${clients.length} cliente${clients.length > 1 ? 's' : ''} dejó de registrar sus comidas`,
    html: `
    <div style="font-family:-apple-system,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)">
      <div style="background:linear-gradient(135deg,#FF6B6B,#FF8E53);padding:26px;text-align:center">
        <h1 style="color:#fff;margin:0;font-size:20px;letter-spacing:.06em;font-weight:800">LOVIC</h1>
        <p style="color:rgba(255,255,255,.9);margin:4px 0 0;font-size:12px;letter-spacing:.12em">SEGUIMIENTO DE NUTRICIÓN</p>
      </div>
      <div style="padding:24px 26px 28px">
        <p style="font-size:15px;color:#1A1A1A;margin:0 0 14px">Hola ${trainerName || ''}, estos clientes llevan varios días sin registrar sus comidas:</p>
        <table style="width:100%;border-collapse:collapse">${rows}</table>
        <p style="font-size:13px;color:#666;line-height:1.6;margin:16px 0 20px">Un mensajito tuyo suele reactivarlas. Puedes ver su detalle en la app.</p>
        <a href="${appUrl}/trainer" style="display:block;text-align:center;text-decoration:none;background:linear-gradient(135deg,#FF6B6B,#FF8E53);color:#fff;font-weight:800;padding:14px;border-radius:12px;font-size:15px">Abrir el panel →</a>
      </div>
    </div>`,
  });
}

// ── Aviso a Lorena: planes por vencer + datos del ciclo para armar el próximo ─
async function sendTrainerPlanExpiryDigest(trainerEmail, trainerName, clients, daysLeft = 3) {
  if (!trainerEmail || !clients?.length) return;

  const card = (c) => {
    const wTxt = c.weightDelta == null ? '—'
      : `${c.weightDelta > 0 ? '+' : ''}${c.weightDelta} kg`;
    const wColor = c.weightDelta == null ? '#999' : (c.weightDelta < 0 ? '#16a34a' : '#dc2626');
    const cardioTxt = c.cardioSessions
      ? `${c.cardioAvg} min/día · ${c.cardioSessions} ${c.cardioSessions === 1 ? 'día' : 'días'}`
      : 'sin cardio registrado';
    const extrasTxt = c.extras && c.extras.length
      ? c.extras.map(e => `${e.name}${e.times > 1 ? ` (${e.times}×)` : ''}`).join(', ')
      : 'ninguno';
    return `
      <div style="border:1px solid #eee;border-radius:12px;padding:16px;margin-bottom:14px">
        <div style="display:flex;justify-content:space-between;align-items:baseline">
          <span style="font-weight:800;font-size:1.05rem;color:#1A1A1A">${c.name}</span>
          <span style="color:#FF6B6B;font-weight:700;font-size:.85rem">vence el ${c.endDate}</span>
        </div>
        <table style="width:100%;border-collapse:collapse;margin-top:10px;font-size:.9rem">
          <tr>
            <td style="padding:4px 0;color:#888">🏋️ Entrenó</td>
            <td style="padding:4px 0;text-align:right;font-weight:700;color:#1A1A1A">${c.daysTrained} días</td>
          </tr>
          <tr>
            <td style="padding:4px 0;color:#888">🏃 Cardio</td>
            <td style="padding:4px 0;text-align:right;font-weight:700;color:#1A1A1A">${cardioTxt}</td>
          </tr>
          <tr>
            <td style="padding:4px 0;color:#888">⚖️ Cambio de peso</td>
            <td style="padding:4px 0;text-align:right;font-weight:700;color:${wColor}">${wTxt}</td>
          </tr>
        </table>
        <div style="margin-top:10px;padding-top:10px;border-top:1px solid #f0f0f0">
          <p style="margin:0 0 4px;color:#888;font-size:.82rem">➕ Ejercicios que agregó por su cuenta:</p>
          <p style="margin:0;color:#1A1A1A;font-size:.9rem;line-height:1.5">${extrasTxt}</p>
        </div>
      </div>`;
  };

  await resend.emails.send({
    from: FROM,
    to: trainerEmail,
    subject: `⏰ Prepara ${clients.length === 1 ? 'la rutina' : clients.length + ' rutinas'} — vence${clients.length > 1 ? 'n' : ''} en ${daysLeft} días`,
    html: `
      <div style="font-family:'Helvetica Neue',sans-serif;max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
        <div style="background:linear-gradient(135deg,#FF6B6B,#FF8E53);padding:2rem;text-align:center">
          <h1 style="color:#fff;margin:0;font-size:1.3rem">⏰ Planes por vencer</h1>
          <p style="color:rgba(255,255,255,.9);margin:.35rem 0 0;font-size:.85rem">En ${daysLeft} días · con lo que necesitas para armar el siguiente</p>
        </div>
        <div style="padding:1.75rem">
          <p style="color:#555;line-height:1.6;margin:0 0 1.25rem">Hola ${trainerName || ''}, resumen del ciclo de ${clients.length === 1 ? 'esta persona' : 'estas personas'} para preparar su nueva rutina:</p>
          ${clients.map(card).join('')}
          <a href="${process.env.APP_URL}/trainer" style="display:inline-block;margin-top:.5rem;background:#FF6B6B;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700">Ver detalle en el panel →</a>
          <p style="color:#aaa;font-size:.78rem;margin:1.25rem 0 0">Tip: en el panel, pestaña Registros → "Cierre de ciclo" tienes la progresión por ejercicio.</p>
        </div>
      </div>
    `,
  });
}

module.exports = { sendMagicLink, sendWelcome, sendWelcomeWithInstructions, notifyTrainerOnboarding, sendWeeklySummary, sendRenewalReminder, sendMeasurementUpdate, sendProgressPhotoUpdate, sendClientStats, sendNutritionAlert, sendTrainerPlanExpiryDigest };
