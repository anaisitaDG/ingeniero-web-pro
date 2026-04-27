# Web Design Engineer Pro

Skill de Claude Code para construir webs y landings profesionales de principio a fin. Diseñada para usuarios sin conocimientos técnicos: el cliente describe su negocio, **previsualiza estilos en su navegador** y elige uno con un clic — la skill se encarga del resto (Next.js 16, diseño, animaciones, SEO, deploy).

**Versión**: 1.0.0
**Autores**: Luis Salgado · Ángel Aparicio
**Marcas**: IA Masters Academy · salgadoia.com
**Stack**: Next.js 16 · React 19 · Tailwind v4 · shadcn/ui · Framer Motion · Lenis · GSAP (opcional)

---

## ¿Qué la diferencia?

1. **Previsualizador visual real** — un HTML standalone con 3-4 estilos lado a lado que el cliente abre en su navegador antes de elegir. La gran mayoría de skills/builders hacen elegir a ciegas.
2. **8 direcciones visuales narrativas** × 10 paletas × 10 tipografías = **800 combos únicos** con build-log para no repetir entre clientes.
3. **7 verticales** con copy, CTAs e iconos específicos (hostelería, tech, salud, legal, formación, inmobiliaria, agencias).
4. **Stack 100% Next.js 16** alineado con las novedades 2026 (async params, proxy.ts, Cache Components, Turbopack stable).
5. **Bugs corregidos** del estado del arte (cleanup leaks, FOUC, SSR guards) — código probado, no decorativo.
6. **Lenguaje 100% no-técnico** en intake — el cliente nunca ve "Server Component" ni "App Router".
7. **Replicable** — cero dependencia de configuraciones específicas del operador. Funciona en máquina nueva.

---

## Estructura

```
web-design-engineer-pro/
├── SKILL.md                          # Núcleo (cargado siempre por Claude)
├── README.md                         # Este archivo
├── references/
│   ├── 01-direcciones-visuales.md    # 8 direcciones × tokens completos
│   ├── 02-verticales.md              # 7 verticales × copy + CTAs + iconos
│   ├── 03-catalogo-componentes.md    # Árbol decisión componente
│   ├── 04-modulos-excelencia.md      # Lenis, SplitText, parallax, 3D
│   └── 05-checklist-entrega.md       # QA + a11y + SEO + perf
├── scripts/
│   ├── preview-styles.mjs            # ⭐ Genera preview.html con N estilos
│   ├── scrape-cascade.mjs            # Extrae contenido de URL (3 niveles)
│   └── verify-build.mjs              # Verifica entorno + smoke tests
└── templates/
    ├── preview-template.html         # Base del previewer
    ├── tokens.css                    # Variables CSS de la dirección
    ├── proxy.ts                      # Next.js 16 proxy
    ├── sitemap.ts                    # SEO
    ├── robots.ts                     # SEO
    ├── llms.txt                      # LLMO
    ├── identity.json                 # LLMO + Schema.org
    ├── site-config.ts                # Configuración por marca
    ├── intake-schema.json            # Esquema de validación
    └── brief-schema.json             # Esquema de validación
```

---

## Instalación

### Como skill global de Claude Code

Copia la carpeta entera a tu `~/.claude/skills/`:

**Windows (Git Bash o PowerShell)**:
```bash
cp -r web-design-engineer-pro "$HOME/.claude/skills/"
```

**macOS / Linux**:
```bash
cp -r web-design-engineer-pro ~/.claude/skills/
```

Después en Claude Code:
- Reinicia la sesión (o `/reload`)
- La skill aparece en `/skills` automáticamente
- Se activa con triggers como "crea una web", "diseña una landing", "rediseña [URL]"

### Como skill de proyecto

Copia la carpeta a `.claude/skills/` dentro de tu proyecto:

```bash
mkdir -p .claude/skills
cp -r web-design-engineer-pro .claude/skills/
```

### Requisitos

- **Node.js** 20.9+ (la skill verifica esto en cada sesión)
- **npm** 9+
- **git** (recomendado)
- Sistema operativo: Windows / macOS / Linux

Verifica el entorno:
```bash
node web-design-engineer-pro/scripts/verify-build.mjs --check-env
```

---

## Uso

Una vez instalada, el usuario solo tiene que escribir cosas como:

- "Necesito una web para mi cafetería"
- "Quiero rediseñar https://mi-web-actual.com"
- "Diseña una landing para mi SaaS"
- "Monta la web para [nombre del negocio]"

La skill se activa automáticamente y guía el pipeline:

1. **Saludo + ruta** (¿nueva o rediseño?)
2. **Previsualizador** ⭐ — el usuario abre `.brief/preview.html` y elige clicando
3. **Brief amigable** — 3-4 preguntas finales en lenguaje natural
4. **Validación** — resumen del plan, "¿arrancamos?"
5. **Setup automático** — Next.js 16 + Tailwind v4 + shadcn + Framer Motion
6. **Construcción** — secciones, animaciones, SEO, LLMO
7. **QA automático** — TypeScript + build + Lighthouse + a11y
8. **Entrega** — `npm run dev` y la URL local
9. **Deploy opcional** — Vercel one-click

---

## Probar el previsualizador (sin Claude Code)

Puedes generar un preview manualmente para validar la skill:

```bash
node web-design-engineer-pro/scripts/preview-styles.mjs \
  --brand "Ritmo Negro" \
  --tagline "Café que cuenta historias" \
  --cta "Reservar mesa" \
  --directions "UE,LDW,ED" \
  --out preview-ritmo-negro.html
```

**Windows**:
```bash
start "" preview-ritmo-negro.html
```

**macOS**:
```bash
open preview-ritmo-negro.html
```

**Linux**:
```bash
xdg-open preview-ritmo-negro.html
```

Verás un HTML autocontenido con 3 secciones hero (una por dirección) y un botón "Elegir este estilo" que copia un código al portapapeles.

### Argumentos disponibles

| Flag | Por defecto | Descripción |
|---|---|---|
| `--brand` | (obligatorio) | Nombre del negocio |
| `--tagline` | "Hecho con intención." | Subtítulo del hero |
| `--cta` | "Empezar ahora" | CTA principal |
| `--cta2` | "Saber más" | CTA secundario |
| `--directions` | "UE,SM,ED" | IDs de direcciones (8 disponibles: ED, SM, LDW, CB, UE, NB, PG, RT) |
| `--paletteIds` | (auto) | Override paletas (D1-D5 dark, L1-L5 light) |
| `--fontIds` | (auto) | Override fuentes (F1-F10) |
| `--out` | `.brief/preview.html` | Ruta de salida |

---

## Scraping de webs existentes

```bash
node web-design-engineer-pro/scripts/scrape-cascade.mjs https://example.com --out .brief/scrape.json
```

Cascada de 3 niveles automática:
1. **curl** con User-Agent real (sitios estáticos)
2. **Puppeteer** headless (SPAs con JS dinámico) — instala `puppeteer` la primera vez si hace falta
3. **Guía manual** (Cloudflare, login, sitios protegidos)

---

## Verificación post-build

Antes de levantar el dev server:

```bash
cd <proyecto-generado>
node ../web-design-engineer-pro/scripts/verify-build.mjs --full
```

Comprueba:
- TypeScript sin errores
- Build exitoso
- SEO files presentes (sitemap, robots, llms.txt, identity.json)
- Sin restos del template inicial de Next.js
- Sin colores Tailwind genéricos (`bg-blue-500`, etc.)
- `.gitignore` correcto (`.env.local`, `.brief/`)

---

## Direcciones visuales

| ID | Nombre | Para |
|---|---|---|
| **ED** | Editorial Serif | Consultoras, medios, personal brand |
| **SM** | Swiss Minimal | SaaS B2B, devtools, fintech |
| **LDW** | Luxury Dark Warm | Hospitalidad alta, joyería, moda |
| **CB** | Corporate Bold | Enterprise, formación, asesorías |
| **UE** | Understated Elegance | Cafés, agencias, bienestar, portfolio |
| **NB** | Neo-Brutalist | Startups, comunidades creativas |
| **PG** | Playful Gradient | Apps consumer, edtech |
| **RT** | Retro Terminal | DevTools, docs técnicos |

Detalle completo + tokens en `references/01-direcciones-visuales.md`.

---

## Stack técnico exacto

| Herramienta | Versión | Notas |
|---|---|---|
| Node.js | 20.9+ | Next.js 16 lo exige |
| Next.js | 16.1.1+ | Async params, proxy.ts, Cache Components |
| React | 19.2+ | Auto-instalado |
| TypeScript | 5.7+ | |
| Tailwind CSS | v4 | Directiva `@theme` en CSS |
| shadcn CLI | latest | Registry-based |
| Framer Motion (`motion`) | 12+ | Motor primario de animación |
| Lenis | latest | Smooth scroll global |
| split-type | latest | Tipografía cinética (opcional) |
| GSAP + ScrollTrigger | 3.12+ | Solo para storytelling pinneado |
| @gsap/react | latest | useGSAP hook |
| Three.js + R3F | latest | Solo si hay 3D |
| plaiceholder + sharp | latest | Blur placeholders |

---

## Personalización

### Cambiar nombre o branding de la skill

Edita el `name` en el frontmatter de `SKILL.md`. Por ejemplo, para usarla bajo la marca de Ángel/NextGen AI Institute:

```yaml
---
name: nextgenai-web-builder
version: 1.0.0
description: ...
---
```

### Añadir más direcciones visuales

Edita `scripts/preview-styles.mjs` (constante `DIRECTIONS`) y `references/01-direcciones-visuales.md` para mantener consistencia.

### Añadir más verticales

Edita `references/02-verticales.md` con tono, CTAs, iconos y paletas recomendadas para el nuevo sector.

---

## Desarrollo y contribución

### Tests rápidos

```bash
# Verificar entorno
node scripts/verify-build.mjs --check-env

# Probar previewer
node scripts/preview-styles.mjs --brand "Test" --directions "SM,UE,LDW" --out /tmp/test.html

# Probar scraper
node scripts/scrape-cascade.mjs https://example.com --out /tmp/scrape.json
```

### Estructura de un proyecto generado

```
mi-cliente/
├── .brief/                           # Brief, preview, scrape, build-log (en .gitignore)
├── .env.local                        # Vars de entorno (en .gitignore)
├── .gitignore
├── next.config.ts
├── package.json
├── public/
│   ├── llms.txt                      # LLMO
│   ├── identity.json                 # LLMO
│   ├── og-image.jpg                  # 1200×630
│   └── images/                       # Assets del cliente
├── src/
│   ├── app/
│   │   ├── layout.tsx                # Metadata + JSON-LD + fonts
│   │   ├── page.tsx                  # Home con secciones
│   │   ├── sitemap.ts
│   │   ├── robots.ts
│   │   └── globals.css               # Importa tokens.css
│   ├── components/
│   │   ├── SmoothScroll.tsx          # Lenis wrapper
│   │   ├── PageTransition.tsx        # Framer Motion (si multi-page)
│   │   └── sections/                 # Hero, Features, etc.
│   ├── lib/
│   │   ├── site-config.ts            # Single source of truth
│   │   └── blur.ts                   # Blur placeholders
│   ├── hooks/
│   │   ├── useSplitText.ts
│   │   └── useParallax.ts
│   └── proxy.ts                      # (Next.js 16, opcional)
└── tsconfig.json
```

---

## Troubleshooting

| Problema | Solución |
|---|---|
| "Node version too old" | Instalar Node 20.9+ desde nodejs.org |
| Puppeteer falla en scraping | `npm install --save-dev puppeteer` en el proyecto raíz |
| Preview no abre en Windows | Usar `start "" preview.html` (con comillas vacías) |
| Estilos no cargan en preview | Probar con conexión activa (carga Google Fonts) |
| Build falla por colores hardcoded | El verify-build te dice qué archivos arreglar |

---

## Licencia

MIT — © 2026 Luis Salgado y Ángel Aparicio.

---

## Créditos

Fusión de:
- Pipeline AWWWARDS — 8 direcciones visuales narrativas y módulos de excelencia
- Sistema mix-and-match — paletas, tipografías, layouts y build-log

Built by **Luis Salgado** y **Ángel Aparicio**.
Marcas asociadas: **IA Masters Academy** · **salgadoia.com**.
Construido con Claude Opus 4.7. Pensado para que cualquier persona pueda diseñar como agencia.
