# Direcciones Visuales

Cada dirección es una declaración estética completa: paleta, tipografía, ritmo y tono. Elegir una dirección **antes** de escribir código.

Cada dirección tiene un código corto (ED, SM, LDW, CB, UE, NB, PG, RT) que se combina con un ID de paleta y un ID de pareja tipográfica para formar el código de combo: `STYLE:ED-L2-F2`.

---

## 1. Editorial Serif (ED)

**Tono**: Autoridad intelectual, calma, herencia editorial.
**Para**: Consultoras, medios, publicaciones, despachos boutique, personal brand de pensador/columnista.
**Vibe**: revista de papel, con tinta cara.

### Tokens base

```css
--color-bg: #F9F9F7;
--color-card: #FFFFFF;
--color-primary: #111111;
--color-secondary: #4A4A4A;
--color-accent: #8B0000;
--color-text: #111111;
--color-muted: #6B6B6B;

--font-display: "Playfair Display", "Georgia", serif;
--font-body: "Lora", "Iowan Old Style", serif;
--font-size-base: 18px;
--line-height-body: 1.7;

--radius: 0px;
--spacing-unit: 8px;
--shadow: none;
```

### Características clave
- **Justificación**: cuerpos de texto justificados con tipografía generosa.
- **Capitulares**: primera letra del primer párrafo en gran tamaño tipo magazine.
- **Sin sombras, sin gradientes, sin bordes redondeados**.
- **Acento rojo profundo** en links + headings de sección.
- **Numeración romana** opcional para secciones.

### Componentes ideales (catálogo)
- `text-reveal` (MagicUI) para headings que se revelan al scroll
- `marquee` (MagicUI) para citas
- bento sin gridlines (deja respirar el blanco)

### NO usar para
SaaS B2B de tech (demasiado formal), apps consumer (poco friendly).

---

## 2. Swiss Minimal (SM)

**Tono**: Claridad funcional, precisión, ausencia de decoración.
**Para**: SaaS B2B, DevTools, dashboards, fintech racional, productos de productividad.
**Vibe**: Helvetica, Müller-Brockmann, retícula suiza.

### Tokens base

```css
--color-bg: #FFFFFF;
--color-card: #F8F8F8;
--color-primary: #000000;
--color-secondary: #888888;
--color-accent: #0055FF;
--color-text: #000000;
--color-muted: #6E6E6E;

--font-display: "Inter", system-ui, sans-serif;
--font-body: "Inter", system-ui, sans-serif;
--font-size-base: 16px;
--line-height-body: 1.5;

--radius: 4px;
--spacing-unit: 8px;
--shadow: 0 1px 3px rgba(0,0,0,0.08);
```

### Características clave
- **Una sola familia tipográfica** (Inter o IBM Plex Sans), variando peso.
- **Retícula visible**: divisores horizontales finos (1px) entre secciones.
- **Acento azul saturado** en CTAs y links.
- **Sombras ínfimas**, sólo donde la jerarquía lo requiere.
- **Iconografía línea fina** (lucide en stroke 1.5).

### Componentes ideales
- `bento-grid` (MagicUI)
- `border-beam` en cards de feature
- `number-ticker` para métricas
- `code-comparison` si es DevTool

### NO usar para
Negocios artesanales, hostelería (frío), brand emocional.

---

## 3. Luxury Dark Warm (LDW)

**Tono**: Calidez íntima, premium, "ven a esta cena".
**Para**: Hospitalidad alta gama, joyería, moda heritage, restaurantes de autor, vinos.
**Vibe**: lobby de hotel boutique, hora dorada.

### Tokens base

```css
--color-bg: #12100E;
--color-card: #1F1B17;
--color-primary: #D4AF37;
--color-secondary: #8C7B50;
--color-accent: #C5A059;
--color-text: #F5F5DC;
--color-muted: #9A8E76;

--font-display: "Cinzel", "Trajan Pro", serif;
--font-body: "Montserrat", "Avenir Next", sans-serif;
--font-size-base: 16px;
--line-height-body: 1.65;

--radius: 2px;
--spacing-unit: 12px;
--shadow: 0 4px 30px rgba(0,0,0,0.5);
```

### Características clave
- **Dark first**: el contraste es texto crema sobre marrón profundo.
- **Acento dorado** en logos, divisores ornamentales, CTAs.
- **Sin radios marcados**: 2px máximo, las cosas son sólidas.
- **Tipografía Cinzel** en H1 (versalitas elegantes), Montserrat en body.
- **Imágenes con grano sutil** (filter: contrast(1.05) saturate(0.95)).

### Componentes ideales
- `magic-card` (MagicUI) con hover dorado
- `shine-border` en CTAs
- `animated-beam` entre elementos

### NO usar para
Tech, startups disruptivas (demasiado formal), salud (demasiado dramático).

---

## 4. Corporate Bold (CB)

**Tono**: Confianza estructurada, autoridad B2B sin frialdad.
**Para**: Enterprise, fintech corporativa, legal, asesorías financieras, formación profesional, consultoras grandes.
**Vibe**: Stripe, Linear, Vercel — confianza moderna sin ser rígido.

### Tokens base

```css
--color-bg: #F6F9FC;
--color-card: #FFFFFF;
--color-primary: #0A2540;
--color-secondary: #425466;
--color-accent: #635BFF;
--color-text: #0A2540;
--color-muted: #6B7785;

--font-display: "Inter", "Roboto", sans-serif;
--font-body: "Inter", "Open Sans", sans-serif;
--font-size-base: 16px;
--line-height-body: 1.6;

--radius: 8px;
--spacing-unit: 8px;
--shadow: 0 4px 16px rgba(10,37,64,0.08);
```

### Características clave
- **Azul marino + lila acento**: confianza + modernidad.
- **Cards con sombra sutil pero visible**.
- **Iconos en círculo de color** (acento al 12% opacity).
- **Gradientes muy ligeros** (acento → secondary, 0.05 opacity).
- **Estadísticas grandes** con number-ticker.

### Componentes ideales
- `orbiting-circles` (MagicUI) para "ecosistema"
- `icon-cloud` para integraciones
- `globe` para alcance internacional
- `bento-grid` clásico para features

### NO usar para
Productos artesanales, marca personal de creativo.

---

## 5. Understated Elegance (UE)

**Tono**: Calma editorial, artesanía, "respira".
**Para**: Agencias creativas pequeñas, bienestar, tostadores de café, panaderías de autor, portfolios, estudios de diseño.
**Vibe**: papel reciclado de buen gramaje, fotografía analógica, espacios amplios.

### Tokens base

```css
--color-bg: #F4F1EB;
--color-card: #FFFFFF;
--color-primary: #4A5D4E;
--color-secondary: #8B9D8F;
--color-accent: #D4A373;
--color-text: #2C352D;
--color-muted: #8A8C7E;

--font-display: "Cormorant Garamond", "Cormorant", serif;
--font-body: "Lato", "Source Sans 3", sans-serif;
--font-size-base: 17px;
--line-height-body: 1.7;

--radius: 8px;
--spacing-unit: 12px;
--shadow: 0 10px 40px rgba(0,0,0,0.04);
```

### Características clave
- **Paleta tierra-oliva-arena**: la naturaleza filtrada por un editor.
- **Tipografía contraste** display serif fina + body sans humanista.
- **Espacios amplios**: padding generoso (`py-32` en secciones).
- **Imágenes en escala de grises cálido** o filtro suave.
- **Sin acentos saturados**: el color cuenta historias, no grita.

### Componentes ideales
- `blur-fade` (MagicUI)
- `progressive-blur`
- `text-reveal` lento

### NO usar para
SaaS (demasiado pausado), apps de consumo masivo.

---

## 6. Neo-Brutalist (NB)

**Tono**: Irreverencia cruda, energía, "no me importa lo que pienses".
**Para**: Startups disruptivas, comunidades creativas, productos de artistas, tools indie, herramientas anti-corporate.
**Vibe**: zine punk + página de artista de Cassie + Gumroad early days.

### Tokens base

```css
--color-bg: #FFE500;
--color-card: #FFFFFF;
--color-primary: #000000;
--color-secondary: #FFFFFF;
--color-accent: #FF00FF;
--color-text: #000000;
--color-muted: #333333;

--font-display: "Space Grotesk", "Archivo", sans-serif;
--font-body: "Space Grotesk", "JetBrains Mono", sans-serif;
--font-size-base: 17px;
--line-height-body: 1.4;

--radius: 0px;
--spacing-unit: 16px;
--shadow: 6px 6px 0px 0px #000000;
```

### Características clave
- **Sombras duras desplazadas** en lugar de blur.
- **Borders gruesos** (3px sólido negro) en cards y botones.
- **Sin border-radius**: todo cuadrado, todo afirmativo.
- **Mayúsculas selectivas** en headings ("LA IA QUE NO PIDE PERDÓN").
- **Color saturado** en fondos completos (no solo acento).

### Componentes ideales
- `SplitText` (ReactBits) en H1
- `tilted-card` (ReactBits) si hay producto
- `Ballpit` (ReactBits) en hero opcional

### NO usar para
Legal/finanzas (mata credibilidad), salud (genera ansiedad).

---

## 7. Playful Gradient (PG)

**Tono**: Optimista, alegre, energía moderna.
**Para**: Apps consumer, productos creativos, herramientas para niños/familia, comunidades positivas, edtech.
**Vibe**: Linear early + Notion + Figma 2020.

### Tokens base

```css
--color-bg: #FAFAFA;
--color-card: #FFFFFF;
--color-primary: #7B2CBF;
--color-secondary: #9D4EDD;
--color-accent: #FF9E00;
--color-text: #10002B;
--color-muted: #6F578A;

--font-display: "Poppins", "Quicksand", sans-serif;
--font-body: "Nunito", "Nunito Sans", sans-serif;
--font-size-base: 16px;
--line-height-body: 1.6;

--radius: 16px;
--spacing-unit: 8px;
--shadow: 0 8px 32px rgba(123,44,191,0.12);

/* Gradiente de marca */
--gradient-brand: linear-gradient(135deg, #7B2CBF 0%, #FF9E00 100%);
```

### Características clave
- **Border-radius generoso** (16px+ en cards, 999px en botones).
- **Gradientes en CTAs y headings clave** (no abusar).
- **Iconos en círculos de color** (acento + secondary).
- **Animaciones suaves y rebotes** (ease-out generoso).
- **Confetti en evento de éxito** (form submit).

### Componentes ideales
- `aurora-text` en H1
- `animated-gradient-text`
- `particles` o `confetti` en submit
- `sparkles-text` en badges

### NO usar para
Legal/finanzas (poco serio), enterprise (demasiado lúdico).

---

## 8. Retro Terminal (RT)

**Tono**: DevTools, hacker chic, "para los nuestros".
**Para**: Herramientas para developers, CLI tools, documentación técnica, side projects de programadores.
**Vibe**: 80s green-on-black + monospace + CRT scan lines opcional.

### Tokens base

```css
--color-bg: #0D0208;
--color-card: #14081A;
--color-primary: #00FF41;
--color-secondary: #008F11;
--color-accent: #FE019A;
--color-text: #00FF41;
--color-muted: #4D7A4D;

--font-display: "JetBrains Mono", "Fira Code", monospace;
--font-body: "JetBrains Mono", "Fira Code", monospace;
--font-size-base: 15px;
--line-height-body: 1.6;

--radius: 0px;
--spacing-unit: 8px;
--shadow: 0 0 12px rgba(0,255,65,0.25);
```

### Características clave
- **Monospace en todo** — incluso body, sí, en serio.
- **Cursor parpadeante** (`▮` blink) al final de headings.
- **Borders 1px sólidos verde**, sin radios.
- **Scan lines sutiles opcionales** (background overlay con líneas horizontales 1px).
- **Pink magenta como acento** en links, opuesto cromático del verde.

### Componentes ideales
- `terminal` (MagicUI)
- `typing-animation`
- `hyper-text`
- `code-comparison`

### NO usar para
Cualquier negocio que no sea explícitamente para desarrolladores. Es nicho extremo.

---

## Tabla resumen — cuándo usar cada una

| Dirección | Adjetivos | Sectores top |
|---|---|---|
| Editorial Serif (ED) | autoritario, intelectual, calmado | medios, consultoras, personal brand |
| Swiss Minimal (SM) | claro, funcional, preciso | SaaS, devtools, fintech B2B |
| Luxury Dark Warm (LDW) | premium, cálido, íntimo | hospitalidad alta, joyería, moda |
| Corporate Bold (CB) | confiable, moderno, estructurado | enterprise, formación, asesorías |
| Understated Elegance (UE) | artesano, calmo, editorial | agencias, café, bienestar, portfolio |
| Neo-Brutalist (NB) | irreverente, crudo, energético | startups, comunidades creativas |
| Playful Gradient (PG) | optimista, alegre, moderno | apps consumer, edtech, herramientas creativas |
| Retro Terminal (RT) | nicho dev, hacker chic | CLIs, docs técnicos, devtools |

---

## Cómo elegir si no hay claro ganador

1. **¿El cliente vende emoción o función?**
   - Emoción → ED, LDW, UE, NB, PG
   - Función → SM, CB, RT
2. **¿Es premium o accesible?**
   - Premium → ED, LDW, UE
   - Accesible → SM, CB, PG, NB
3. **¿Habla a profesionales o a consumer general?**
   - Profesionales → SM, CB, RT, ED
   - Consumer → LDW, UE, NB, PG
4. **Si sigues sin saber**: Swiss Minimal (SM) es el fallback universal — funciona en el 80% de los casos sin destacar pero sin fallar.

---

## Paletas combinables (10 paletas globales)

Cada dirección tiene su paleta nativa, pero puedes combinar las paletas globales `D1-D5` (dark) y `L1-L5` (light) con cualquier dirección para variar:

**Dark themes** (combinables con LDW, RT, NB, CB):
| ID | Nombre | --bg | --card | --accent | --text | --muted |
|----|--------|------|--------|----------|--------|---------|
| D1 | Warm Night | #1A1412 | #2A2220 | #C4956A | #F5F0EB | #8A7E75 |
| D2 | Deep Teal | #0D1B1E | #1A2D31 | #4ECDC4 | #E8F4F2 | #6B8F8A |
| D3 | Noir Plum | #1A0F1E | #2D1F33 | #B56EFF | #F0E8FF | #8A7596 |
| D4 | Slate Ember | #1C1C1E | #2C2C2E | #FF6B35 | #F5F5F5 | #8A8A8C |
| D5 | Midnight Forest | #0F1A14 | #1A2D22 | #5BBA6F | #E8F5EC | #6B8F75 |

**Light themes** (combinables con ED, SM, UE, CB, PG):
| ID | Nombre | --bg | --card | --accent | --text | --muted |
|----|--------|------|--------|----------|--------|---------|
| L1 | Cream & Sage | #FAF7F2 | #FFFFFF | #7D8A6E | #2D2D2D | #9A9A8E |
| L2 | Blush Editorial | #FDF6F4 | #FFFFFF | #C27B7B | #333333 | #B0A3A0 |
| L3 | Warm Ivory | #FEFCF8 | #FFFFFF | #D4A574 | #2D2517 | #B5A896 |
| L4 | Cloud Lavender | #F8F6FD | #FFFFFF | #8B7EC8 | #2D2D3D | #A09AB5 |
| L5 | Pearl Marine | #F5F9FA | #FFFFFF | #3D8B9E | #1A2D33 | #8AABB5 |

---

## Parejas tipográficas (10 pairings)

| ID | Display (titulares) | Body (texto) | Vibe | Direcciones recomendadas |
|----|---------------------|--------------|------|--------------------------|
| F1 | Cormorant Garamond | Outfit | Luxury elegante | UE, LDW, ED |
| F2 | Playfair Display | DM Sans | Editorial clásico | ED, UE |
| F3 | Crimson Pro | Space Grotesk | Contemporáneo | UE, ED, NB |
| F4 | Fraunces | Inter | Warm moderno | UE, CB, LDW |
| F5 | Libre Baskerville | Karla | Profesional serio | ED, CB |
| F6 | Lora | Source Sans 3 | Académico confiable | ED, CB |
| F7 | DM Serif Display | Manrope | Bold statement | ED, NB |
| F8 | Merriweather | Nunito Sans | Friendly readable | CB, PG |
| F9 | Bitter | Rubik | Tech con carácter | CB, RT |
| F10 | Josefin Sans | Work Sans | Clean minimal | SM, CB |

**Reglas**:
- En Retro Terminal, ambos slots deben ser monospace (JetBrains Mono / Fira Code) — ignorar la tabla.
- En Neo-Brutalist, una sola familia (Space Grotesk) — display y body iguales.
- En Swiss Minimal, una sola familia (Inter) — variando peso.

---

## Combo final = Dirección × Paleta × Pareja tipográfica

Ejemplos de combos válidos:
- `STYLE:ED-L2-F2` — Editorial Serif + Blush Editorial + Playfair/DM Sans
- `STYLE:UE-L1-F4` — Understated Elegance + Cream & Sage + Fraunces/Inter
- `STYLE:LDW-D1-F1` — Luxury Dark Warm + Warm Night + Cormorant/Outfit
- `STYLE:CB-L5-F8` — Corporate Bold + Pearl Marine + Merriweather/Nunito
- `STYLE:NB-D4-F7` — Neo-Brutalist + Slate Ember + DM Serif/Manrope (variante atípica)

Total combinaciones posibles: 8 × 10 × 10 = **800 combos únicos**. Build-log evita repetir entre clientes.
