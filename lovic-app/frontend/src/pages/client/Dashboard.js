import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { LineChart, Line, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { usePushNotifications } from '../../hooks/usePushNotifications';

/* ── VIC MASCOT ──────────────────────────────────────────────────── */
function getHourCO() {
  return new Date(Date.now() - 5 * 60 * 60 * 1000).getUTCHours();
}

function pickMsg(msgs) {
  return msgs[Math.floor(Date.now() / 60000) % msgs.length];
}

const VIC_MESSAGES = {
  bestia: [
    '¡Imparable! Llevas una racha que da miedo (de lo buena). 🔥',
    'No sé quién te para. Yo tampoco quiero intentarlo.',
    'Llevas días encendida. Literal. Soy yo, encendida. ✨',
    '¡Racha épica! Esto ya no es suerte, esto es disciplina pura.',
    'Oye, ¿tú te das cuenta de lo que estás logrando? Porque yo sí. 🔥',
  ],
  racha: [
    '¡Vamos! Cada día que sumas me haces brillar más. ✨',
    'Llevo días viéndote y me alegra. No pares ahora, ¿eh?',
    '¿Ves lo que pasa cuando eres constante? Esto. Esto pasa. 💪',
    'Tres días seguidos. Eso se celebra. ¡Sigue!',
    'No me falles ahora que vamos bien. Casi llegamos a la racha grande. 🔥',
  ],
  celebrando: [
    '¡LO LOGRASTE! Entrenaste y comiste bien. Eso es un día perfecto. 🎉',
    'Hoy fue un 10. Tú fuiste un 10. ¡Felicitaciones!',
    'Todo marcado. Todo cumplido. Me haces muy feliz. 🥳',
    'Así se hace. Ahora a descansar bien para mañana repetir. 💪',
    '¡Bien! ¿Ves? Cuando quieres, puedes. Mañana también puedes.',
  ],
  normal: () => {
    const h = getHourCO();
    if (h >= 5 && h < 10)  return pickMsg(['¡Buenos días! Hoy es un buen día para ser constante. ☀️', 'Arranca bien el día. Yo estoy aquí para acompañarte. 🔥', 'Mañana nueva, oportunidad nueva. ¿Empezamos? ☀️']);
    if (h >= 10 && h < 13) return pickMsg(['Ya va la mañana. ¿Cómo vamos? No te me relajes todavía. 💪', '¿Ya tomaste agua esta mañana? Porque yo te estoy mirando. 👀', 'La mañana se va rápido. Aprovéchala. 💪']);
    if (h >= 13 && h < 16) return pickMsg(['Tarde activa. ¿Ya entrenaste hoy? Todavía hay tiempo. 💪', 'No dejes todo para después. Después no llega. 🙄', 'La siesta espera. El entreno primero. 😏']);
    if (h >= 16 && h < 20) return pickMsg(['La tarde es tuya. Un entreno ahora y el día queda completo. 🔥', 'Son las mejores horas para entrenar. ¿A qué esperas? 💪', 'Cierra fuerte el día. Un empuje más. 🔥']);
    if (h >= 20)            return pickMsg(['Última hora del día. ¿Cómo te fue? Cuéntame. 🌙', 'Si ya cumpliste, orgullo. Si no, mañana sin excusas. 😏', 'El día casi cierra. Reflexiona y descansa bien. 🌙']);
    return '¿Qué haces despierta a esta hora? ¡Duerme! 😂';
  },
  inflamada: [
    'Hoy los carbohidratos ganaron la batalla. Mañana ganamos nosotras.',
    'Pasó. No pasa nada. Pero mañana volvemos al plan, ¿oíste? 😏',
    'El cuerpo avisa cuando algo no cuadra. Escúchalo mañana. 😌',
    'Un día de desvío no es el fin del mundo. Eso sí, no se vuelve costumbre. 🙄',
  ],
  ojeras: [
    'Dormir también es entrenamiento. Tu cuerpo lo necesita de verdad.',
    'Las ojeras me preocupan más que los kilos. Descansa esta noche. 💤',
    'Hoy prioriza el sueño. Mañana rendimos mejor las dos. 🌙',
    'Sin sueño no hay progreso. Nada de pantalla, a dormir. 😴',
  ],
  triste: () => {
    const h = getHourCO();
    if (h < 12) return pickMsg([
      'Buenos días. Todavía tienes todo el día. No me falles hoy. 🌤️',
      'Empieza despacio si quieres, pero empieza. Te espero. 💪',
    ]);
    if (h < 18) return pickMsg([
      'Aún queda tarde. Un paso pequeño hoy vale más que esperar mañana.',
      'No me dejes aquí triste. Todavía puedes hacer algo hoy. 😢',
    ]);
    return pickMsg([
      'El día casi termina, pero mañana es nuevo. Te espero aquí. 💛',
      'Mañana sin excusas. ¿Trato? 🤝',
    ]);
  },
  deshidratada: () => {
    const h = getHourCO();
    return pickMsg([
      `Son las ${h}:00. ¿Ya tomaste agua? Por favor, hidrátame un poquito. 💧`,
      'Llevas horas sin agua. Yo me estoy secando aquí esperándote. 🏜️',
      '¿Un vasito? Solo uno. Por mí. No seas mala. 💧',
      'El agua no se toma sola. Anda, ve por un vaso. Ya. 😅',
      'Cada vaso de agua me hace brillar más. ¿Tan difícil es? 🔥',
      'Te recuerdo que somos lo mismo tú y yo. Si tú no tomas agua, yo me apago. 💧',
    ]);
  },
  apagada: [
    'Te extraño. Mucho. ¿Volvemos juntas hoy? Solo un paso. 💛',
    'Sigo aquí. Apagada pero esperándote. No me rindo contigo.',
    'No importa cuántos días pasaron. Hoy puede ser el primer día de la racha. 🌱',
    'Un día malo no define todo. Un regreso sí. ¿Volvemos? 🔥',
    'Oye. Oye. Te estoy hablando. ¿Volvemos o qué? 😤',
  ],
};

function getVicMsg(stateKey) {
  const msgs = VIC_MESSAGES[stateKey];
  if (!msgs) return '';
  if (typeof msgs === 'function') return msgs();
  return pickMsg(msgs);
}

const VIC_STATES = {
  bestia:       { name: 'Modo Bestia 🔥',    accent: '#FF5A36', size: 105, dimmed: false },
  racha:        { name: 'En Racha 😊',        accent: '#FFB347', size: 105, dimmed: false },
  celebrando:   { name: 'Celebrando 🎉',      accent: '#60D394', size: 108, dimmed: false },
  normal:       { name: 'Todo bien 😐',        accent: '#AAAACC', size: 100, dimmed: false },
  inflamada:    { name: 'Inflamada 😮',        accent: '#FF8844', size: 118, dimmed: false },
  ojeras:       { name: 'Ojeras 😴',           accent: '#9966CC', size: 100, dimmed: false },
  triste:       { name: 'Triste 😢',           accent: '#6B8FD4', size: 100, dimmed: false },
  deshidratada: { name: 'Deshidratada 🏜️',   accent: '#DD8833', size:  90, dimmed: false },
  apagada:      { name: 'Apagada 💀',          accent: '#666688', size:  95, dimmed: true  },
};

function getVicState(streak, tracking, macros) {
  const { workout_done, diet_followed, water_glasses, sleep_hours } = tracking || {};
  const carbsOver = macros?.carbs > 0 && macros?.carbs_target > 0 && macros.carbs > macros.carbs_target * 1.35;

  if (streak >= 7)                                    return 'bestia';
  if (streak >= 3)                                    return 'racha';
  if (sleep_hours != null && sleep_hours < 6)         return 'ojeras';
  if (carbsOver && !workout_done)                     return 'inflamada';
  if ((water_glasses || 0) < 3)                       return 'deshidratada';
  if (!workout_done && !diet_followed)                return streak === 0 ? 'apagada' : 'triste';
  if (!workout_done || !diet_followed)                return 'triste';
  if (workout_done && diet_followed)                  return 'celebrando';
  return 'normal';
}

const CX=60, EY=78, MY=96, ER=8.5, ELX=42, ERX=78;
function vicFace(stateKey) {
  const eyes = {
    bestia:       `<ellipse cx="${ELX}" cy="${EY}" rx="${ER+3}" ry="${ER}" fill="#DD1515" opacity=".92" stroke="#881000" stroke-width="1.5"/><ellipse cx="${ELX-3}" cy="${EY-3}" rx="4" ry="2.5" fill="rgba(255,200,200,.4)"/><ellipse cx="${ERX}" cy="${EY}" rx="${ER+3}" ry="${ER}" fill="#DD1515" opacity=".92" stroke="#881000" stroke-width="1.5"/><ellipse cx="${ERX-3}" cy="${EY-3}" rx="4" ry="2.5" fill="rgba(255,200,200,.4)"/><line x1="${ELX+ER+3}" y1="${EY}" x2="${ERX-ER-3}" y2="${EY}" stroke="#881000" stroke-width="2"/>`,
    normal:       `<circle cx="${ELX}" cy="${EY}" r="${ER}" fill="#1a0800"/><circle cx="${ELX+3}" cy="${EY-3}" r="3" fill="white"/><circle cx="${ERX}" cy="${EY}" r="${ER}" fill="#1a0800"/><circle cx="${ERX+3}" cy="${EY-3}" r="3" fill="white"/><line x1="${ELX-8}" y1="${EY-13}" x2="${ELX+8}" y2="${EY-13}" stroke="#1a0800" stroke-width="2.5" stroke-linecap="round"/><line x1="${ERX-8}" y1="${EY-13}" x2="${ERX+8}" y2="${EY-13}" stroke="#1a0800" stroke-width="2.5" stroke-linecap="round"/>`,
    sad:          `<circle cx="${ELX}" cy="${EY}" r="${ER}" fill="#1a0800"/><circle cx="${ELX+3}" cy="${EY-3}" r="3" fill="white"/><circle cx="${ERX}" cy="${EY}" r="${ER}" fill="#1a0800"/><circle cx="${ERX+3}" cy="${EY-3}" r="3" fill="white"/><line x1="${ELX-8}" y1="${EY-12}" x2="${ELX+8}" y2="${EY-8}" stroke="#1a0800" stroke-width="2.5" stroke-linecap="round"/><line x1="${ERX-8}" y1="${EY-8}" x2="${ERX+8}" y2="${EY-12}" stroke="#1a0800" stroke-width="2.5" stroke-linecap="round"/>`,
    tired:        `<circle cx="${ELX}" cy="${EY}" r="${ER}" fill="#1a0800"/><circle cx="${ELX+3}" cy="${EY-3}" r="2.5" fill="white"/><circle cx="${ERX}" cy="${EY}" r="${ER}" fill="#1a0800"/><circle cx="${ERX+3}" cy="${EY-3}" r="2.5" fill="white"/><path d="M ${ELX-ER} ${EY-2} Q ${ELX} ${EY-ER-3} ${ELX+ER} ${EY-2}" fill="#E06000"/><path d="M ${ERX-ER} ${EY-2} Q ${ERX} ${EY-ER-3} ${ERX+ER} ${EY-2}" fill="#E06000"/><ellipse cx="${ELX}" cy="${EY+ER+1}" rx="${ER}" ry="3.5" fill="rgba(20,5,0,.3)"/><ellipse cx="${ERX}" cy="${EY+ER+1}" rx="${ER}" ry="3.5" fill="rgba(20,5,0,.3)"/>`,
    dead:         `<line x1="${ELX-7}" y1="${EY-7}" x2="${ELX+7}" y2="${EY+7}" stroke="#1a0800" stroke-width="3.5" stroke-linecap="round"/><line x1="${ELX+7}" y1="${EY-7}" x2="${ELX-7}" y2="${EY+7}" stroke="#1a0800" stroke-width="3.5" stroke-linecap="round"/><line x1="${ERX-7}" y1="${EY-7}" x2="${ERX+7}" y2="${EY+7}" stroke="#1a0800" stroke-width="3.5" stroke-linecap="round"/><line x1="${ERX+7}" y1="${EY-7}" x2="${ERX-7}" y2="${EY+7}" stroke="#1a0800" stroke-width="3.5" stroke-linecap="round"/>`,
    star:         `<text x="${ELX}" y="${EY+6}" text-anchor="middle" font-size="18">⭐</text><text x="${ERX}" y="${EY+6}" text-anchor="middle" font-size="18">⭐</text>`,
    happy:        `<circle cx="${ELX}" cy="${EY}" r="${ER}" fill="#1a0800"/><circle cx="${ELX+3.5}" cy="${EY-3.5}" r="3" fill="white"/><circle cx="${ERX}" cy="${EY}" r="${ER}" fill="#1a0800"/><circle cx="${ERX+3.5}" cy="${EY-3.5}" r="3" fill="white"/>`,
  };
  const mouths = {
    smile:   `<path d="M ${CX-10} ${MY-1} Q ${CX} ${MY+11} ${CX+10} ${MY-1}" fill="#CC1800" stroke="#881000" stroke-width="1.5"/>`,
    smug:    `<path d="M ${CX-9} ${MY+2} Q ${CX+6} ${MY-4} ${CX+9} ${MY-2}" fill="none" stroke="#881000" stroke-width="2.5" stroke-linecap="round"/>`,
    flat:    `<line x1="${CX-9}" y1="${MY}" x2="${CX+9}" y2="${MY}" stroke="#881000" stroke-width="2.5" stroke-linecap="round"/>`,
    frown:   `<path d="M ${CX-10} ${MY+7} Q ${CX} ${MY-5} ${CX+10} ${MY+7}" fill="none" stroke="#881000" stroke-width="2.5" stroke-linecap="round"/>`,
    tongue:  `<path d="M ${CX-9} ${MY-1} Q ${CX} ${MY+9} ${CX+9} ${MY-1}" fill="#CC1800"/><ellipse cx="${CX}" cy="${MY+14}" rx="8" ry="9" fill="#FF5050" stroke="#881000" stroke-width="1.5"/>`,
    open:    `<path d="M ${CX-12} ${MY-3} Q ${CX} ${MY+14} ${CX+12} ${MY-3}" fill="#CC1800" stroke="#881000" stroke-width="1.5"/><ellipse cx="${CX}" cy="${MY-1}" rx="9" ry="3.5" fill="rgba(255,255,255,.75)"/>`,
    cry:     `<path d="M ${CX-10} ${MY+7} Q ${CX} ${MY-5} ${CX+10} ${MY+7}" fill="none" stroke="#881000" stroke-width="2.5" stroke-linecap="round"/><path d="M ${ELX+2} ${EY+ER+1} C ${ELX+4} ${EY+ER+7} ${ELX+3} ${EY+ER+13} ${ELX} ${EY+ER+15} C ${ELX-3} ${EY+ER+13} ${ELX-2} ${EY+ER+7} ${ELX+2} ${EY+ER+1}Z" fill="rgba(100,160,255,.85)"/><path d="M ${ERX+2} ${EY+ER+1} C ${ERX+4} ${EY+ER+7} ${ERX+3} ${EY+ER+13} ${ERX} ${EY+ER+15} C ${ERX-3} ${EY+ER+13} ${ERX-2} ${EY+ER+7} ${ERX+2} ${EY+ER+1}Z" fill="rgba(100,160,255,.85)"/>`,
  };
  const extras = {
    bestia:       `<text x="4" y="22" font-size="13">✨</text><text x="92" y="20" font-size="13">✨</text>`,
    racha:        `<ellipse cx="${ELX-9}" cy="${MY-2}" rx="9" ry="5.5" fill="rgba(255,100,40,.35)"/><ellipse cx="${ERX+9}" cy="${MY-2}" rx="9" ry="5.5" fill="rgba(255,100,40,.35)"/>`,
    inflamada:    `<ellipse cx="${ELX-16}" cy="${MY-1}" rx="18" ry="13" fill="rgba(255,140,60,.52)"/><ellipse cx="${ERX+16}" cy="${MY-1}" rx="18" ry="13" fill="rgba(255,140,60,.52)"/>`,
    apagada:      `<text x="85" y="25" font-size="16">💀</text>`,
    celebrando:   `<text x="4" y="18" font-size="13">⭐</text><text x="95" y="16" font-size="13">⭐</text>`,
    deshidratada: `<line x1="50" y1="55" x2="54" y2="66" stroke="rgba(80,25,0,.55)" stroke-width="2" stroke-linecap="round"/><line x1="54" y1="66" x2="49" y2="75" stroke="rgba(80,25,0,.55)" stroke-width="2" stroke-linecap="round"/><line x1="68" y1="60" x2="72" y2="72" stroke="rgba(80,25,0,.55)" stroke-width="2" stroke-linecap="round"/><ellipse cx="${ELX}" cy="${EY+ER+3}" rx="10" ry="4" fill="rgba(30,8,0,.28)"/><ellipse cx="${ERX}" cy="${EY+ER+3}" rx="10" ry="4" fill="rgba(30,8,0,.28)"/>`,
  };
  const map = {
    bestia:       { e: 'bestia',  m: 'smug',   x: 'bestia' },
    racha:        { e: 'happy',   m: 'smile',  x: 'racha' },
    celebrando:   { e: 'star',    m: 'open',   x: 'celebrando' },
    normal:       { e: 'normal',  m: 'flat',   x: '' },
    inflamada:    { e: 'sad',     m: 'frown',  x: 'inflamada' },
    ojeras:       { e: 'tired',   m: 'flat',   x: '' },
    triste:       { e: 'sad',     m: 'cry',    x: '' },
    deshidratada: { e: 'sad',     m: 'tongue', x: 'deshidratada' },
    apagada:      { e: 'dead',    m: 'flat',   x: 'apagada' },
  };
  const { e, m, x } = map[stateKey] || map.normal;
  return `<svg viewBox="0 0 120 130" xmlns="http://www.w3.org/2000/svg" style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none">
    ${extras[x] || ''}${eyes[e] || ''}${mouths[m] || ''}
  </svg>`;
}

const VIC_ANIMATIONS = `
  @keyframes vic-shake {
    0%,100%{transform:rotate(0deg) scale(1)} 15%{transform:rotate(-6deg) scale(1.06)} 30%{transform:rotate(6deg) scale(1.06)} 45%{transform:rotate(-4deg) scale(1.04)} 60%{transform:rotate(4deg) scale(1.04)} 75%{transform:rotate(-2deg)} 90%{transform:rotate(2deg)}
  }
  @keyframes vic-bounce {
    0%,100%{transform:translateY(0)} 40%{transform:translateY(-12px)} 60%{transform:translateY(-8px)}
  }
  @keyframes vic-jump {
    0%,100%{transform:translateY(0) scale(1)} 30%{transform:translateY(-18px) scale(1.05)} 55%{transform:translateY(-10px)} 70%{transform:translateY(-14px) scale(1.03)}
  }
  @keyframes vic-breathe {
    0%,100%{transform:scale(1)} 50%{transform:scale(1.08)}
  }
  @keyframes vic-sway {
    0%,100%{transform:rotate(0deg)} 25%{transform:rotate(-8deg)} 75%{transform:rotate(8deg)}
  }
  @keyframes vic-wobble {
    0%,100%{transform:rotate(0deg) translateX(0)} 20%{transform:rotate(-3deg) translateX(-2px)} 40%{transform:rotate(3deg) translateX(2px)} 60%{transform:rotate(-2deg) translateX(-1px)} 80%{transform:rotate(2deg) translateX(1px)}
  }
  @keyframes vic-pulse {
    0%,100%{opacity:1} 50%{opacity:0.35}
  }
  @keyframes vic-droop {
    0%,100%{transform:translateY(0) rotate(0deg)} 50%{transform:translateY(4px) rotate(-5deg)}
  }
  @keyframes vic-float {
    0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)}
  }
`;

const VIC_ANIM_STYLE = {
  bestia:       { animation: 'vic-shake 0.5s ease-in-out infinite' },
  racha:        { animation: 'vic-bounce 1.1s ease-in-out infinite' },
  celebrando:   { animation: 'vic-jump 0.8s ease-in-out infinite' },
  normal:       { animation: 'vic-float 3s ease-in-out infinite' },
  inflamada:    { animation: 'vic-breathe 1.8s ease-in-out infinite' },
  ojeras:       { animation: 'vic-sway 2.5s ease-in-out infinite' },
  triste:       { animation: 'vic-droop 2s ease-in-out infinite' },
  deshidratada: { animation: 'vic-wobble 1.5s ease-in-out infinite' },
  apagada:      { animation: 'vic-pulse 2.5s ease-in-out infinite' },
};

function Vic({ streak, tracking, macros }) {
  const stateKey = getVicState(streak, tracking, macros);
  const state = VIC_STATES[stateKey];
  const msg = getVicMsg(stateKey);
  const badgeMap = {
    bestia:       ['💪', '💪'],
    racha:        ['👍'],
    celebrando:   ['🥳', '🎊'],
    inflamada:    ['🍔', '🍩'],
    ojeras:       ['💤', '🌙'],
    triste:       [],
    deshidratada: ['💧', '💧'],
    apagada:      [],
    normal:       [],
  };
  const badgeStyles = {
    bestia:       ['top:56px;left:-22px;transform:scaleX(-1)', 'top:56px;right:-22px'],
    racha:        ['top:62px;right:-18px'],
    celebrando:   ['top:-10px;left:16px;font-size:24px', 'top:14px;right:-16px'],
    inflamada:    ['top:20px;right:-20px', 'top:72px;right:-20px'],
    ojeras:       ['top:14px;right:-8px', 'top:4px;left:-4px;font-size:18px'],
    deshidratada: ['top:38px;left:-18px;font-size:16px;opacity:0.5', 'top:60px;right:-16px;font-size:14px;opacity:0.4'],
  };

  return (
    <>
    <style>{VIC_ANIMATIONS}</style>
    <div style={{
      display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20,
      background: 'var(--card)', borderRadius: 20, padding: '16px 18px',
      border: `1.5px solid ${state.accent}44`,
    }}>
      <div style={{ position: 'relative', width: 80, height: 88, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{
          fontSize: Math.round(state.size * 0.72) + 'px',
          lineHeight: 1,
          display: 'block',
          filter: state.dimmed ? 'grayscale(60%) brightness(0.65)' : 'none',
          ...(VIC_ANIM_STYLE[stateKey] || {}),
        }}>🔥</span>
        <div dangerouslySetInnerHTML={{ __html: vicFace(stateKey) }} />
        {(badgeMap[stateKey] || []).map((b, i) => (
          <span key={i} style={{
            position: 'absolute', fontSize: 18, pointerEvents: 'none',
            ...(Object.fromEntries((badgeStyles[stateKey]?.[i] || '').split(';').filter(Boolean).map(p => {
              const [k, v] = p.split(':'); return [k.trim().replace(/-([a-z])/g, (_,c) => c.toUpperCase()), v.trim()];
            }))),
          }}>{b}</span>
        ))}
      </div>
      <div style={{ flex: 1 }}>
        <p style={{ fontWeight: 800, fontSize: 15, color: state.accent, marginBottom: 3 }}>{state.name}</p>
        <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.45 }}>{msg}</p>
      </div>
    </div>
    </>
  );
}

function PushBanner() {
  const { supported, permission, subscribed, loading, subscribe, unsubscribe } = usePushNotifications();
  const [dismissed, setDismissed] = useState(() => localStorage.getItem('push_dismissed') === '1');

  if (!supported || permission === 'denied' || subscribed || dismissed) return null;

  function dismiss() {
    localStorage.setItem('push_dismissed', '1');
    setDismissed(true);
  }

  return (
    <div style={{
      background: 'linear-gradient(135deg, #FF6B6B11, #FF8C4211)',
      border: '1.5px solid #FF6B6B33',
      borderRadius: 16, padding: '14px 16px', marginBottom: 16,
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <span style={{ fontSize: 28 }}>🔥</span>
      <div style={{ flex: 1 }}>
        <p style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>Vic quiere avisarte</p>
        <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.4 }}>Activa notificaciones y te mando recordatorios de agua, entreno y motivación.</p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
        <button
          onClick={subscribe}
          disabled={loading}
          style={{ background: 'var(--coral)', color: '#fff', border: 'none', borderRadius: 10, padding: '7px 14px', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
        >{loading ? '…' : 'Activar'}</button>
        <button
          onClick={dismiss}
          style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 11, cursor: 'pointer', padding: '2px 0' }}
        >Ahora no</button>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);
  const [saving, setSaving]   = useState(false);
  const [tracking, setTracking] = useState({ workout_done: false, diet_followed: false, water_glasses: 0, mood: null, sleep_hours: null });

  useEffect(() => {
    api.dashboard.get()
      .then(d => {
        setData(d);
        setTracking({
          workout_done:  !!d.tracking?.workout_done,
          diet_followed: !!d.tracking?.diet_followed,
          water_glasses: d.tracking?.water_glasses || 0,
          mood:          d.tracking?.mood || null,
          sleep_hours:   d.tracking?.sleep_hours || null,
        });
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  async function saveTracking(update) {
    const next = { ...tracking, ...update };
    setTracking(next);
    setSaving(true);
    try { await api.dashboard.postTracking(next); }
    finally { setSaving(false); }
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 48 }}><div className="spinner" style={{ borderTopColor: 'var(--coral)', borderColor: 'var(--border)', width: 32, height: 32 }} /></div>;
  if (error) return <div className="empty-state"><div className="icon">📡</div><p>No se pudo cargar. Revisa tu conexión.</p><button className="btn-primary" style={{ marginTop: 16 }} onClick={() => { setError(false); setLoading(true); api.dashboard.get().then(d => { setData(d); setTracking({ workout_done: !!d.tracking?.workout_done, diet_followed: !!d.tracking?.diet_followed, water_glasses: d.tracking?.water_glasses || 0, mood: d.tracking?.mood || null, sleep_hours: d.tracking?.sleep_hours || null }); }).catch(() => setError(true)).finally(() => setLoading(false)); }}>Reintentar</button></div>;

  const { calories, macros, bio, weight_history, adherence, routine, streak } = data || {};
  const pct = calories ? Math.min(Math.round((calories.consumed / calories.target) * 100), 100) : 0;

  const weightData = (weight_history || []).map(w => ({
    date: new Date(w.logged_at).toLocaleDateString('es', { month: 'short', day: 'numeric' }),
    peso: w.weight_kg,
  })).reverse();

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <p style={{ color: 'var(--muted)', fontSize: 14 }}>{new Date().toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 style={{ fontSize: 24, fontWeight: 800 }}>Hola, {user?.name?.split(' ')[0]} 👋</h1>
          {streak > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--gold-light)', borderRadius: 20, padding: '6px 12px' }}>
              <span style={{ fontSize: 18 }}>🔥</span>
              <span style={{ fontWeight: 800, fontSize: 15, color: '#C99A1E' }}>{streak} días</span>
            </div>
          )}
        </div>
      </div>

      {/* Vic mascot */}
      <Vic streak={streak} tracking={tracking} macros={macros} />
      <PushBanner />

      {/* Pending reminders */}
      {(() => {
        const reminders = [];
        if (!calories?.consumed) reminders.push({ icon: '🥗', text: 'Registra tus comidas de hoy', to: '/food' });
        if (!tracking.workout_done) reminders.push({ icon: '💪', text: 'Marca tu entrenamiento cuando lo hagas', to: '/plan' });
        const lastWeight = weightData[weightData.length - 1];
        const accountAgeDays = Math.floor((Date.now() - new Date(data?.user_created_at || Date.now())) / 86400000);
        const daysSinceWeight = lastWeight
          ? Math.floor((Date.now() - new Date(data?.weight_history?.[0]?.logged_at)) / 86400000)
          : 999;
        if (daysSinceWeight > 6 && accountAgeDays > 7) reminders.push({ icon: '📏', text: 'Lleva más de una semana sin registrar medidas', to: '/measurements' });
        if (reminders.length === 0) return null;
        return (
          <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {reminders.map((r, i) => (
              <a key={i} href={r.to} style={{
                display: 'flex', alignItems: 'center', gap: 10, background: '#FFF8E7',
                border: '1.5px solid #F5D87A', borderRadius: 12, padding: '10px 14px', textDecoration: 'none',
              }}>
                <span style={{ fontSize: 20 }}>{r.icon}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#7A5C00', flex: 1 }}>{r.text}</span>
                <span style={{ color: '#C99A1E', fontSize: 16 }}>→</span>
              </a>
            ))}
          </div>
        );
      })()}

      {/* Calories + macros */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div>
            <p className="label">Calorías de hoy</p>
            <p style={{ fontSize: 28, fontWeight: 800 }}>{calories?.consumed} <span style={{ fontSize: 16, fontWeight: 400, color: 'var(--muted)' }}>/ {calories?.target} kcal</span></p>
          </div>
          <Link to="/food" className="btn-primary" style={{ padding: '8px 16px', fontSize: 13 }}>+ Agregar</Link>
        </div>
        <div style={{ height: 8, background: 'var(--border)', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: pct >= 100 ? '#E05252' : 'var(--coral)', borderRadius: 8, transition: 'width 0.5s' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, marginBottom: 12 }}>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>{pct}% consumido</span>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>{calories?.remaining} restantes</span>
        </div>
        {macros && (macros.protein > 0 || macros.carbs > 0 || macros.fat > 0) && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <MacroBar label="Proteína" consumed={macros.protein} target={macros.protein_target} color="#2D6EA0" />
            <MacroBar label="Carbos"   consumed={macros.carbs}   target={macros.carbs_target}   color="#C99A1E" />
            <MacroBar label="Grasa"    consumed={macros.fat}     target={macros.fat_target}      color="#8B3A14" />
          </div>
        )}
      </div>

      {/* Daily tracking */}
      <div className="card" style={{ marginBottom: 16 }}>
        <p className="label" style={{ marginBottom: 12 }}>Seguimiento de hoy {saving && <span style={{ color: 'var(--muted)', fontWeight: 400 }}>guardando…</span>}</p>
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <TrackToggle label="Entrenamiento" icon="💪" active={tracking.workout_done} onChange={v => saveTracking({ workout_done: v })} />
          <TrackToggle label="Dieta" icon="🥗" active={tracking.diet_followed} onChange={v => saveTracking({ diet_followed: v })} />
          <SleepInput value={tracking.sleep_hours} onChange={v => saveTracking({ sleep_hours: v })} />
        </div>
        <MoodSelector value={tracking.mood} onChange={v => saveTracking({ mood: v })} />
        <WaterTracker tracking={tracking} bio={bio} onSave={saveTracking} />
      </div>

      {/* Routine preview */}
      {routine && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <p className="label">Tu rutina 💪</p>
            <Link to="/plan" style={{ fontSize: 12, color: 'var(--coral)', fontWeight: 700, textDecoration: 'none' }}>Ver completa →</Link>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
            {routine.content.slice(0, 220)}{routine.content.length > 220 ? '…' : ''}
          </p>
        </div>
      )}

      {/* Weight chart */}
      {weightData.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <p className="label" style={{ marginBottom: 12 }}>Progreso de peso</p>
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={weightData}>
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
              <Tooltip formatter={v => [`${v} kg`, 'Peso']} contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 2px 12px rgba(0,0,0,0.1)' }} />
              <Line type="monotone" dataKey="peso" stroke="#FF6B6B" strokeWidth={2.5} dot={{ r: 3, fill: '#FF6B6B' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Bio stats */}
      {bio && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <p className="label">Última bioimpedancia</p>
            <Link to="/measurements" style={{ fontSize: 12, color: 'var(--coral)', fontWeight: 700, textDecoration: 'none' }}>Ver todo →</Link>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {bio.body_fat_pct != null && <StatBox label="Grasa corporal" value={`${bio.body_fat_pct}%`} icon="📊" />}
            {bio.muscle_mass_kg != null && <StatBox label="Masa muscular" value={`${bio.muscle_mass_kg} kg`} icon="💪" />}
            {bio.visceral_fat != null && <StatBox label="Grasa visceral" value={bio.visceral_fat} icon="🫀" />}
            {bio.bmr_kcal != null && <StatBox label="Metabolismo" value={`${bio.bmr_kcal} kcal`} icon="🔥" />}
          </div>
        </div>
      )}

      {/* Progress shortcut */}
      <Link to="/measurements" style={{ textDecoration: 'none', display: 'block', marginBottom: 16 }}>
        <div style={{ background: 'linear-gradient(135deg, var(--coral) 0%, #C75C45 100%)', borderRadius: 16, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: 28 }}>📈</span>
          <div style={{ flex: 1 }}>
            <p style={{ fontWeight: 800, fontSize: 15, color: '#fff', marginBottom: 2 }}>Ver mi progreso</p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>Gráficas de peso, grasa, músculo y medidas</p>
          </div>
          <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 18 }}>→</span>
        </div>
      </Link>

      {/* Adherence */}
      {adherence && adherence.total_days > 0 && (
        <div className="card">
          <p className="label" style={{ marginBottom: 12 }}>Adherencia (últimos 30 días)</p>
          <div style={{ display: 'flex', gap: 12 }}>
            <AdherenceBar label="Entrenamientos" done={adherence.workout_days} total={adherence.total_days} color="var(--coral)" />
            <AdherenceBar label="Dieta" done={adherence.diet_days} total={adherence.total_days} color="var(--gold)" />
          </div>
        </div>
      )}
    </div>
  );
}

function MacroBar({ label, consumed, target, color }) {
  const remaining = target > 0 ? Math.max(target - consumed, 0) : null;
  const pct = target > 0 ? Math.min(Math.round((consumed / target) * 100), 100) : 0;
  const over = target > 0 && consumed > target;
  return (
    <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '8px 10px', textAlign: 'center' }}>
      <div style={{ fontWeight: 800, fontSize: 15, color: over ? '#E05252' : color }}>{consumed}g</div>
      {target > 0 && <div style={{ fontSize: 10, color: 'var(--muted)' }}>/ {target}g</div>}
      {target > 0 && (
        <div style={{ height: 4, background: 'var(--border)', borderRadius: 4, overflow: 'hidden', margin: '4px 0' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: over ? '#E05252' : color, borderRadius: 4 }} />
        </div>
      )}
      <div style={{ fontSize: 10, color: 'var(--muted)' }}>{label}</div>
      {remaining !== null && <div style={{ fontSize: 10, fontWeight: 700, color: remaining === 0 ? '#E05252' : color }}>faltan {remaining}g</div>}
    </div>
  );
}

function TrackToggle({ label, icon, active, onChange }) {
  return (
    <button onClick={() => onChange(!active)} style={{
      flex: 1, padding: '14px', borderRadius: 14, border: `2px solid ${active ? 'var(--coral)' : 'var(--border)'}`,
      background: active ? 'var(--coral-light)' : 'transparent', cursor: 'pointer',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, transition: 'all 0.2s',
    }}>
      <span style={{ fontSize: 24 }}>{icon}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: active ? 'var(--coral)' : 'var(--muted)' }}>{label}</span>
      <span style={{ fontSize: 11, color: active ? 'var(--coral)' : 'var(--muted)', fontWeight: 600 }}>{active ? '✓ Hecho' : 'Pendiente'}</span>
    </button>
  );
}

function StatBox({ label, value, icon }) {
  return (
    <div style={{ background: 'var(--bg)', borderRadius: 12, padding: '12px', textAlign: 'center' }}>
      <div style={{ fontSize: 20, marginBottom: 4 }}>{icon}</div>
      <div style={{ fontWeight: 800, fontSize: 18 }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{label}</div>
    </div>
  );
}

function AdherenceBar({ label, done, total, color }) {
  const pct = Math.round((done / total) * 100);
  return (
    <div style={{ flex: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color }}>{pct}%</span>
      </div>
      <div style={{ height: 8, background: 'var(--border)', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 8 }} />
      </div>
      <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{done}/{total} días</p>
    </div>
  );
}

function SleepInput({ value, onChange }) {
  return (
    <div style={{
      flex: 1, padding: '14px', borderRadius: 14, border: '2px solid var(--border)',
      background: value ? 'var(--bg)' : 'transparent',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
    }}>
      <span style={{ fontSize: 24 }}>😴</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)' }}>Sueño</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button onClick={() => onChange(Math.max((value || 7) - 0.5, 0))} style={{
          width: 28, height: 28, borderRadius: 8, border: 'none', background: 'var(--border)',
          fontWeight: 700, fontSize: 16, cursor: 'pointer', color: 'var(--text)',
        }}>−</button>
        <span style={{ fontWeight: 800, fontSize: 16, minWidth: 36, textAlign: 'center' }}>
          {value != null ? `${value}h` : '—'}
        </span>
        <button onClick={() => onChange(Math.min((value || 6) + 0.5, 14))} style={{
          width: 28, height: 28, borderRadius: 8, border: 'none', background: 'var(--border)',
          fontWeight: 700, fontSize: 16, cursor: 'pointer', color: 'var(--text)',
        }}>+</button>
      </div>
    </div>
  );
}

const MOODS = [
  { value: 'tired',   emoji: '😴', label: 'Cansada' },
  { value: 'normal',  emoji: '😐', label: 'Normal' },
  { value: 'good',    emoji: '⚡', label: 'Con energía' },
];

function MoodSelector({ value, onChange }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 8 }}>¿Cómo amaneciste hoy?</p>
      <div style={{ display: 'flex', gap: 8 }}>
        {MOODS.map(m => (
          <button key={m.value} onClick={() => onChange(value === m.value ? null : m.value)} style={{
            flex: 1, padding: '10px 6px', borderRadius: 12, border: `2px solid ${value === m.value ? 'var(--coral)' : 'var(--border)'}`,
            background: value === m.value ? 'var(--coral-light)' : 'transparent',
            cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            transition: 'all 0.2s',
          }}>
            <span style={{ fontSize: 22 }}>{m.emoji}</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: value === m.value ? 'var(--coral)' : 'var(--muted)' }}>{m.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function WaterTracker({ tracking, bio, onSave }) {
  const glasses = tracking.water_glasses || 0;

  // Meta dinámica: +2 si entrenó hoy, +2 si hidratación corporal baja
  let goal = 8;
  let bioMsg = null;
  if (tracking.workout_done) goal = 10;
  if (bio?.body_water_pct != null) {
    if (bio.body_water_pct < 50) {
      goal = Math.max(goal, 10);
      bioMsg = { type: 'warn', text: `Tu agua corporal fue ${bio.body_water_pct}% en tu última bio — apunta a ${goal} vasos hoy` };
    } else if (bio.body_water_pct >= 55) {
      bioMsg = { type: 'good', text: `Tu hidratación corporal está en ${bio.body_water_pct}% — ¡sigue así!` };
    }
  }

  const pct = Math.min(Math.round((glasses / goal) * 100), 100);
  let statusMsg = '';
  if (glasses === 0) statusMsg = 'Empieza a hidratarte 💧';
  else if (pct < 50) statusMsg = `Te faltan ${goal - glasses} vasos`;
  else if (pct < 100) statusMsg = `¡Vas bien! ${goal - glasses} vasos más`;
  else statusMsg = '¡Meta cumplida! 🎉';

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>
          💧 Agua — {glasses}/{goal} vasos
          {tracking.workout_done && <span style={{ fontSize: 10, color: '#4A90D9', marginLeft: 6 }}>+2 por entrenamiento</span>}
        </p>
        <span style={{ fontSize: 11, fontWeight: 600, color: pct >= 100 ? '#2D7A2D' : '#4A90D9' }}>{statusMsg}</span>
      </div>
      <div style={{ height: 8, background: 'var(--border)', borderRadius: 8, overflow: 'hidden', marginBottom: 8 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: '#4A90D9', borderRadius: 8, transition: 'width 0.3s' }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: bioMsg ? 10 : 0 }}>
        <button onClick={() => onSave({ water_glasses: Math.max(0, glasses - 1) })}
          style={{ width: 36, height: 36, borderRadius: 10, border: 'none', cursor: 'pointer', background: 'var(--border)', fontSize: 18, fontWeight: 800, flexShrink: 0 }}>−</button>
        <div style={{ flex: 1, display: 'flex', gap: 4 }}>
          {Array.from({ length: goal }, (_, i) => (
            <button key={i} onClick={() => onSave({ water_glasses: i + 1 })} style={{
              flex: 1, height: 28, borderRadius: 5, border: 'none', cursor: 'pointer',
              background: i < glasses ? '#4A90D9' : 'var(--border)',
              transition: 'background 0.15s', minWidth: 0,
            }} />
          ))}
        </div>
        <button onClick={() => onSave({ water_glasses: Math.min(goal, glasses + 1) })}
          style={{ width: 36, height: 36, borderRadius: 10, border: 'none', cursor: 'pointer', background: '#4A90D9', color: '#fff', fontSize: 18, fontWeight: 800, flexShrink: 0 }}>+</button>
      </div>
      {bioMsg && (
        <div style={{
          padding: '8px 12px', borderRadius: 10, fontSize: 12, fontWeight: 600,
          background: bioMsg.type === 'warn' ? '#FFF3CD' : '#D1FAE5',
          color: bioMsg.type === 'warn' ? '#856404' : '#065f46',
          borderLeft: `3px solid ${bioMsg.type === 'warn' ? '#FFC107' : '#10B981'}`,
        }}>
          {bioMsg.type === 'warn' ? '⚠️' : '✅'} {bioMsg.text}
        </div>
      )}
    </div>
  );
}
