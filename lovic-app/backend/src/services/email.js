const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function sendMagicLink(email, name, token) {
  const url = `${process.env.APP_URL}/auth/verify?token=${token}`;

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: email,
    subject: '🔑 Tu enlace de acceso — Lovic Athletica Gym',
    html: `
      <div style="font-family:'Helvetica Neue',sans-serif;max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
        <div style="background:linear-gradient(135deg,#FF6B6B,#FF8E53);padding:2.5rem;text-align:center">
          <h1 style="color:#fff;margin:0;font-size:1.8rem;letter-spacing:.05em">LOVIC</h1>
          <p style="color:rgba(255,255,255,.85);margin:.25rem 0 0;font-size:.85rem;letter-spacing:.1em">ATHLETICA GYM</p>
        </div>
        <div style="padding:2.5rem">
          <h2 style="color:#1A1A1A;margin:0 0 1rem">Hola, ${name} 👋</h2>
          <p style="color:#555;line-height:1.7;margin:0 0 2rem">
            Haz clic en el botón para acceder a tu panel de Lovic. Este enlace expira en 15 minutos.
          </p>
          <a href="${url}" style="display:inline-block;background:linear-gradient(135deg,#FF6B6B,#FF8E53);color:#fff;padding:.9rem 2.5rem;border-radius:8px;text-decoration:none;font-weight:700;font-size:1rem">
            Acceder ahora →
          </a>
          <p style="color:#999;font-size:.8rem;margin:2rem 0 0">
            Si no solicitaste este acceso, ignora este correo.
          </p>
        </div>
      </div>
    `,
  });
}

async function sendWelcome(email, name) {
  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
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

module.exports = { sendMagicLink, sendWelcome };
