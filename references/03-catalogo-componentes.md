# Catálogo de componentes

**Regla absoluta**: NUNCA inventar componentes complejos desde cero si ya existen en una fuente aprobada. El tiempo del usuario vale más que el ego técnico.

---

## Árbol de decisión: ¿qué fuente uso?

```
¿Qué tipo de componente necesito?
│
├── Estructura base (input, select, dialog, table, tabs, form)
│   └── shadcn/ui — npx shadcn@latest add <comp>
│
├── Animación de scroll/landing (beam, shimmer, particles, marquee)
│   └── Magic UI — npx shadcn@latest add "https://magicui.design/r/<comp>"
│
├── Tipografía cinética / micro-interacciones (split text, blur)
│   └── React Bits — npx shadcn@latest add "https://reactbits.dev/r/<Comp>-TS-TW"
│
├── Bloques premium de comunidad (heros, pricing, testimonials)
│   └── 21st.dev (verificar licencia MIT por componente)
│
└── Animaciones avanzadas únicas
    └── Construir desde cero con Framer Motion + Tailwind
```

**Fuentes prohibidas**:
- Aceternity Pro (licencia comercial restrictiva)
- Cualquier librería GPL (incompatible con proyectos comerciales)
- Librerías sin commits en los últimos 12 meses (señal de abandono)
- URLs inventadas — siempre verificar antes de instalar

---

## Mapeo necesidad → componente

### Fondos y texturas

| Necesidad | Componente | Fuente | Comando |
|---|---|---|---|
| Cuadrícula animada | `animated-grid-pattern` | Magic UI | `npx shadcn@latest add "https://magicui.design/r/animated-grid-pattern"` |
| Puntos / dots | `dot-pattern` | Magic UI | `npx shadcn@latest add "https://magicui.design/r/dot-pattern"` |
| Cuadrícula interactiva | `interactive-grid-pattern` | Magic UI | `npx shadcn@latest add "https://magicui.design/r/interactive-grid-pattern"` |
| Partículas | `particles` | Magic UI | `npx shadcn@latest add "https://magicui.design/r/particles"` |
| Meteoros | `meteors` | Magic UI | `npx shadcn@latest add "https://magicui.design/r/meteors"` |
| Ripple fondo | `ripple` | Magic UI | `npx shadcn@latest add "https://magicui.design/r/ripple"` |
| Flickering grid | `flickering-grid` | Magic UI | `npx shadcn@latest add "https://magicui.design/r/flickering-grid"` |

### Hero sections

| Necesidad | Componente | Fuente |
|---|---|---|
| Video en hero | `hero-video-dialog` | Magic UI |
| Globe interactivo | `globe` | Magic UI |
| Texto reveal | `text-reveal` | Magic UI |

### Texto animado

| Necesidad | Componente | Fuente |
|---|---|---|
| Revelar al scroll | `text-reveal` | Magic UI |
| Tipografía scramble | `hyper-text` | Magic UI |
| Palabras rotando | `word-rotate` | Magic UI |
| Morphing de texto | `morphing-text` | Magic UI |
| Split letra a letra | `SplitText` (TS-TW) | React Bits |
| Blur entrada | `BlurText` (TS-TW) | React Bits |
| Contador animado | `number-ticker` | Magic UI |
| Aurora text | `aurora-text` | Magic UI |
| Sparkles text | `sparkles-text` | Magic UI |

### Tarjetas y contenedores

| Necesidad | Componente | Fuente |
|---|---|---|
| Bento grid | `bento-grid` | Magic UI |
| Tarjeta hover magnético | `magic-card` | Magic UI |
| Tarjeta tilt 3D | `TiltedCard` | React Bits |

### Navegación

| Necesidad | Componente | Fuente |
|---|---|---|
| Dock estilo macOS | `dock` | Magic UI |
| Marquee de logos | `marquee` | Magic UI |

### Efectos de borde

| Necesidad | Componente | Fuente |
|---|---|---|
| Borde animado | `border-beam` | Magic UI |
| Shine border | `shine-border` | Magic UI |

### Botones

| Necesidad | Componente | Fuente |
|---|---|---|
| Rainbow | `rainbow-button` | Magic UI |
| Shimmer | `shimmer-button` | Magic UI |
| Ripple click | `ripple-button` | Magic UI |
| Pulsating | `pulsating-button` | Magic UI |
| Hover interactivo | `interactive-hover-button` | Magic UI |

### Micro-interacciones

| Necesidad | Componente | Fuente |
|---|---|---|
| Beam animado entre elementos | `animated-beam` | Magic UI |
| Círculos orbitando | `orbiting-circles` | Magic UI |
| Confetti en evento | `confetti` | Magic UI |
| Progreso circular | `animated-circular-progress-bar` | Magic UI |
| Progreso de scroll | `scroll-progress` | Magic UI |
| Lens / zoom | `lens` | Magic UI |
| Avatar stack | `avatar-circles` | Magic UI |
| Cloud de iconos | `icon-cloud` | Magic UI |
| Terminal simulada | `terminal` | Magic UI |
| Code comparison | `code-comparison` | Magic UI |

### Mocks de dispositivos

| Necesidad | Componente | Fuente |
|---|---|---|
| Safari browser | `safari` | Magic UI |
| iPhone | `iphone` | Magic UI |
| Android | `android` | Magic UI |

### Estructura base (shadcn/ui — todos MIT)

`button` · `card` · `input` · `label` · `textarea` · `select` · `dialog` · `sheet` · `table` · `tabs` · `accordion` · `alert` · `badge` · `avatar` · `dropdown-menu` · `tooltip` · `toast` · `skeleton` · `separator`

---

## Limpieza inteligente de rutas

Después del scaffold inicial de Next.js, eliminar las carpetas/archivos que el brief NO necesita. Esto reduce tamaño de bundle y evita confusión.

| Si el brief NO pidió... | Eliminar |
|---|---|
| Blog | `src/app/blog/`, `src/content/blog/` |
| Newsletter | `src/app/newsletter/`, `src/content/newsletter/`, `src/app/api/newsletter/` |
| Reservas / citas | `src/app/api/slots/`, `src/app/api/book/` |
| Pagos Stripe | `src/app/api/stripe/`, `src/app/api/webhooks/stripe/` |
| Chat widget | `src/components/ChatWidget.tsx`, `src/app/api/chat/` |
| Multi-locale | `src/i18n/`, `src/middleware.ts` (si solo era para next-intl) |
| Búsqueda | `src/app/api/search/`, componente `SearchBar` |

Hacer esto **antes** de empezar a escribir componentes nuevos. Evita decir "está en la app pero no la uso".

---

## Mapping a Direcciones Visuales

Algunos componentes encajan mejor con ciertas direcciones. Usa esta tabla como guía:

| Dirección | Componentes nativos |
|---|---|
| Editorial Serif (ED) | `text-reveal` (lento), `marquee` (citas), `bento-grid` sin gridlines |
| Swiss Minimal (SM) | `bento-grid`, `border-beam`, `number-ticker`, `code-comparison` |
| Luxury Dark Warm (LDW) | `magic-card`, `shine-border`, `animated-beam`, `aurora-text` |
| Corporate Bold (CB) | `orbiting-circles`, `icon-cloud`, `globe`, `bento-grid`, `number-ticker` |
| Understated Elegance (UE) | `blur-fade` (no Magic UI — Framer custom), `marquee` lento, `text-reveal` |
| Neo-Brutalist (NB) | `SplitText` (ReactBits), `TiltedCard`, `hyper-text` |
| Playful Gradient (PG) | `aurora-text`, `sparkles-text`, `particles`, `confetti`, `rainbow-button` |
| Retro Terminal (RT) | `terminal`, `typing-animation`, `hyper-text`, `code-comparison` |

**Regla**: si el componente del catálogo no encaja con la dirección, NO forzarlo. Construir alternativa simple con Framer Motion + Tailwind.

---

## Adaptación obligatoria al sistema de diseño

Cada vez que instales un componente externo, **auditar y adaptar antes de usarlo**:

1. **Eliminar colores genéricos**: `bg-blue-500`, `text-gray-700`, `border-purple-300` PROHIBIDOS. Reemplazar por tokens del proyecto:
   ```tsx
   // ANTES
   <div className="bg-blue-500 text-white">

   // DESPUÉS
   <div style={{ background: "var(--color-accent)", color: "var(--color-card)" }}>
   ```
2. **Tipografía**: reemplazar `font-sans`/`font-serif` genéricos por las variables `--font-display` y `--font-body` definidas en `tokens.css`.
3. **Espaciado**: respetar `--spacing-unit` (múltiplos de 8 o 12px según dirección).
4. **Mobile-first**: añadir clases responsive (`sm:`, `md:`, `lg:`) si no están.
5. **Dark mode**: si la dirección lo soporta (ver `01-direcciones-visuales.md`), verificar que los tokens tienen contrapartida `dark:`.

---

## Cuándo construir desde cero

Si el componente NO existe en ninguna fuente aprobada, construirlo con **Tailwind puro + Framer Motion**, no inventar dependencias.

Plantilla mínima:

```tsx
"use client";
import { motion } from "motion/react";

interface MyCustomCardProps {
  title: string;
  description: string;
}

export function MyCustomCard({ title, description }: MyCustomCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-[var(--radius)] p-8"
      style={{
        background: "var(--color-card)",
        boxShadow: "var(--shadow)",
      }}
    >
      <h3
        className="mb-3 text-2xl"
        style={{ fontFamily: "var(--font-display)", color: "var(--color-text)" }}
      >
        {title}
      </h3>
      <p style={{ color: "var(--color-muted)" }}>{description}</p>
    </motion.div>
  );
}
```

---

## Verificación pre-instalación

Antes de instalar un componente externo:

1. **Verificar URL** — abrir la URL del registry en el navegador. Si 404, parar.
2. **Leer la licencia** — debe ser MIT, MIT + Commons Clause, o equivalente permisivo.
3. **Comprobar dependencias** — ¿añade librerías pesadas? Si sí, considerar alternativa.
4. **Probar en sandbox** — instalar en proyecto temporal antes de comprometer.

Si tienes duda, default a shadcn/ui (estructura) o construir con Framer Motion (animación).
