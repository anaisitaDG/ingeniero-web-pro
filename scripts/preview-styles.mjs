#!/usr/bin/env node
/**
 * preview-styles.mjs
 *
 * Genera un HTML standalone con N direcciones visuales lado a lado.
 * El usuario lo abre en su navegador y elige una con un clic.
 *
 * Uso:
 *   node preview-styles.mjs --brand "Ritmo Negro" --tagline "Café que cuenta historias" \
 *     --cta "Reservar mesa" --directions "UE,LDW,ED" --paletteIds "L1,D1,L2" \
 *     --fontIds "F4,F1,F2" --out .brief/preview.html
 *
 * Sin --paletteIds y --fontIds, el script elige los recomendados por dirección.
 *
 * Argumentos (todos opcionales menos --brand):
 *   --brand "<nombre>"          Nombre del negocio (obligatorio)
 *   --tagline "<frase>"         Subtítulo (default: "Hecho con cuidado")
 *   --cta "<texto>"             CTA principal (default: "Empezar")
 *   --cta2 "<texto>"            CTA secundario (default: "Saber más")
 *   --directions "ED,SM,UE"     IDs de direcciones (default: "UE,SM,ED")
 *   --paletteIds "L1,L2,L3"     IDs de paletas (uno por dirección, opcional)
 *   --fontIds "F1,F4,F2"        IDs de fuentes (uno por dirección, opcional)
 *   --out "<ruta>"              Output (default: ".brief/preview.html")
 *   --template "<ruta>"         Template alternativo
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ===== CONFIG: 8 direcciones visuales =====
const DIRECTIONS = {
  ED: {
    name: "Editorial Serif",
    code: "ED",
    tone: "Autoridad intelectual y calma editorial",
    fontPairDefault: "F2",
    paletteDefault: "L2",
    cssTokens: {
      bg: "#F9F9F7", card: "#FFFFFF", primary: "#111111", secondary: "#4A4A4A",
      accent: "#8B0000", text: "#111111", muted: "#6B6B6B",
      radius: "0px", shadow: "none",
      lineHeight: "1.7", textAlign: "left",
    },
  },
  SM: {
    name: "Swiss Minimal",
    code: "SM",
    tone: "Claridad funcional y precisión",
    fontPairDefault: "F10",
    paletteDefault: "L5",
    cssTokens: {
      bg: "#FFFFFF", card: "#F8F8F8", primary: "#000000", secondary: "#888888",
      accent: "#0055FF", text: "#000000", muted: "#6E6E6E",
      radius: "4px", shadow: "0 1px 3px rgba(0,0,0,0.08)",
      lineHeight: "1.5", textAlign: "left",
    },
  },
  LDW: {
    name: "Luxury Dark Warm",
    code: "LDW",
    tone: "Calidez íntima y premium",
    fontPairDefault: "F1",
    paletteDefault: "D1",
    cssTokens: {
      bg: "#12100E", card: "#1F1B17", primary: "#D4AF37", secondary: "#8C7B50",
      accent: "#C5A059", text: "#F5F5DC", muted: "#9A8E76",
      radius: "2px", shadow: "0 4px 30px rgba(0,0,0,0.5)",
      lineHeight: "1.65", textAlign: "left",
    },
  },
  CB: {
    name: "Corporate Bold",
    code: "CB",
    tone: "Confianza estructurada moderna",
    fontPairDefault: "F8",
    paletteDefault: "L5",
    cssTokens: {
      bg: "#F6F9FC", card: "#FFFFFF", primary: "#0A2540", secondary: "#425466",
      accent: "#635BFF", text: "#0A2540", muted: "#6B7785",
      radius: "8px", shadow: "0 4px 16px rgba(10,37,64,0.08)",
      lineHeight: "1.6", textAlign: "left",
    },
  },
  UE: {
    name: "Understated Elegance",
    code: "UE",
    tone: "Calma editorial y artesanía",
    fontPairDefault: "F4",
    paletteDefault: "L1",
    cssTokens: {
      bg: "#F4F1EB", card: "#FFFFFF", primary: "#4A5D4E", secondary: "#8B9D8F",
      accent: "#D4A373", text: "#2C352D", muted: "#8A8C7E",
      radius: "8px", shadow: "0 10px 40px rgba(0,0,0,0.04)",
      lineHeight: "1.7", textAlign: "left",
    },
  },
  NB: {
    name: "Neo-Brutalist",
    code: "NB",
    tone: "Irreverencia cruda y energía",
    fontPairDefault: "F7",
    paletteDefault: "L4",
    cssTokens: {
      bg: "#FFE500", card: "#FFFFFF", primary: "#000000", secondary: "#FFFFFF",
      accent: "#FF00FF", text: "#000000", muted: "#333333",
      radius: "0px", shadow: "6px 6px 0px 0px #000000",
      lineHeight: "1.4", textAlign: "left",
    },
  },
  PG: {
    name: "Playful Gradient",
    code: "PG",
    tone: "Optimista y moderno",
    fontPairDefault: "F8",
    paletteDefault: "L4",
    cssTokens: {
      bg: "#FAFAFA", card: "#FFFFFF", primary: "#7B2CBF", secondary: "#9D4EDD",
      accent: "#FF9E00", text: "#10002B", muted: "#6F578A",
      radius: "16px", shadow: "0 8px 32px rgba(123,44,191,0.12)",
      lineHeight: "1.6", textAlign: "left",
    },
  },
  RT: {
    name: "Retro Terminal",
    code: "RT",
    tone: "Hacker chic para developers",
    fontPairDefault: "F9",
    paletteDefault: "D5",
    cssTokens: {
      bg: "#0D0208", card: "#14081A", primary: "#00FF41", secondary: "#008F11",
      accent: "#FE019A", text: "#00FF41", muted: "#4D7A4D",
      radius: "0px", shadow: "0 0 12px rgba(0,255,65,0.25)",
      lineHeight: "1.6", textAlign: "left",
    },
  },
};

// ===== CONFIG: 10 paletas globales =====
const PALETTES = {
  D1: { name: "Warm Night", bg: "#1A1412", card: "#2A2220", accent: "#C4956A", text: "#F5F0EB", muted: "#8A7E75" },
  D2: { name: "Deep Teal", bg: "#0D1B1E", card: "#1A2D31", accent: "#4ECDC4", text: "#E8F4F2", muted: "#6B8F8A" },
  D3: { name: "Noir Plum", bg: "#1A0F1E", card: "#2D1F33", accent: "#B56EFF", text: "#F0E8FF", muted: "#8A7596" },
  D4: { name: "Slate Ember", bg: "#1C1C1E", card: "#2C2C2E", accent: "#FF6B35", text: "#F5F5F5", muted: "#8A8A8C" },
  D5: { name: "Midnight Forest", bg: "#0F1A14", card: "#1A2D22", accent: "#5BBA6F", text: "#E8F5EC", muted: "#6B8F75" },
  L1: { name: "Cream & Sage", bg: "#FAF7F2", card: "#FFFFFF", accent: "#7D8A6E", text: "#2D2D2D", muted: "#9A9A8E" },
  L2: { name: "Blush Editorial", bg: "#FDF6F4", card: "#FFFFFF", accent: "#C27B7B", text: "#333333", muted: "#B0A3A0" },
  L3: { name: "Warm Ivory", bg: "#FEFCF8", card: "#FFFFFF", accent: "#D4A574", text: "#2D2517", muted: "#B5A896" },
  L4: { name: "Cloud Lavender", bg: "#F8F6FD", card: "#FFFFFF", accent: "#8B7EC8", text: "#2D2D3D", muted: "#A09AB5" },
  L5: { name: "Pearl Marine", bg: "#F5F9FA", card: "#FFFFFF", accent: "#3D8B9E", text: "#1A2D33", muted: "#8AABB5" },
};

// ===== CONFIG: 10 parejas tipográficas =====
const FONT_PAIRS = {
  F1: { display: "Cormorant Garamond", body: "Outfit", googleParam: "Cormorant+Garamond:wght@400;600;700&family=Outfit:wght@300;400;500;600" },
  F2: { display: "Playfair Display", body: "DM Sans", googleParam: "Playfair+Display:wght@400;600;700&family=DM+Sans:wght@300;400;500;600" },
  F3: { display: "Crimson Pro", body: "Space Grotesk", googleParam: "Crimson+Pro:wght@400;600;700&family=Space+Grotesk:wght@300;400;500;600" },
  F4: { display: "Fraunces", body: "Inter", googleParam: "Fraunces:wght@400;600;700&family=Inter:wght@300;400;500;600" },
  F5: { display: "Libre Baskerville", body: "Karla", googleParam: "Libre+Baskerville:wght@400;700&family=Karla:wght@300;400;500;600" },
  F6: { display: "Lora", body: "Source Sans 3", googleParam: "Lora:wght@400;500;600;700&family=Source+Sans+3:wght@300;400;500;600" },
  F7: { display: "DM Serif Display", body: "Manrope", googleParam: "DM+Serif+Display&family=Manrope:wght@300;400;500;600" },
  F8: { display: "Merriweather", body: "Nunito Sans", googleParam: "Merriweather:wght@400;700&family=Nunito+Sans:wght@300;400;600" },
  F9: { display: "Bitter", body: "JetBrains Mono", googleParam: "Bitter:wght@400;600;700&family=JetBrains+Mono:wght@300;400;500;600" },
  F10: { display: "Inter", body: "Inter", googleParam: "Inter:wght@300;400;500;600;700;800" },
};

// ===== Argumento parsing =====
function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      const key = args[i].slice(2);
      const value = args[i + 1] && !args[i + 1].startsWith("--") ? args[++i] : true;
      out[key] = value;
    }
  }
  return out;
}

// ===== Helpers =====
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildSection(direction, palette, fontPair, brand, tagline, cta, cta2, index) {
  const D = DIRECTIONS[direction];
  if (!D) throw new Error(`Dirección desconocida: ${direction}`);
  const P = PALETTES[palette];
  const F = FONT_PAIRS[fontPair];

  // Combinar tokens de dirección con paleta global (paleta override colors)
  const tokens = {
    ...D.cssTokens,
    bg: P.bg,
    card: P.card,
    accent: P.accent,
    text: P.text,
    muted: P.muted,
  };

  const code = `${D.code}-${palette}-${fontPair}`;
  const sectionId = `direction-${index}`;

  // Estilos específicos de esta dirección
  const directionStyles = `
  #${sectionId} {
    background: ${tokens.bg};
    color: ${tokens.text};
    font-family: "${F.body}", system-ui, sans-serif;
    line-height: ${tokens.lineHeight};
  }
  #${sectionId} .hero-meta { color: ${tokens.muted}; }
  #${sectionId} .hero-meta-badge { background: ${tokens.card}; }
  #${sectionId} h2 {
    font-family: "${F.display}", "Georgia", serif;
    color: ${tokens.text};
    ${D.code === "NB" ? "text-transform: uppercase;" : ""}
    ${D.code === "RT" ? "text-transform: lowercase; letter-spacing: -0.02em;" : ""}
  }
  #${sectionId} h2 .accent { color: ${tokens.accent}; }
  #${sectionId} p.subtitle { color: ${tokens.muted}; }
  #${sectionId} .btn-primary {
    background: ${tokens.accent};
    color: ${pickContrastingText(tokens.accent)};
    border-radius: ${tokens.radius};
    box-shadow: ${tokens.shadow};
    ${D.code === "NB" ? `border: 3px solid ${tokens.text};` : ""}
    ${D.code === "RT" ? `border: 1px solid ${tokens.accent}; text-transform: lowercase;` : ""}
  }
  #${sectionId} .btn-secondary {
    background: transparent;
    color: ${tokens.text};
    border: 1px solid ${tokens.text};
    border-radius: ${tokens.radius};
    ${D.code === "NB" ? `border-width: 3px; box-shadow: ${tokens.shadow};` : ""}
  }
  #${sectionId}::before {
    background: ${getDirectionalBackground(D.code, tokens)};
  }
  #${sectionId} .pick-info strong { color: ${tokens.text}; }
  `;

  const sectionHtml = `
  <section class="hero" id="${sectionId}">
    <div class="hero-meta">
      <span>${escapeHtml(D.name)}</span>
      <span class="hero-meta-badge">${escapeHtml(P.name)}</span>
      <span class="hero-meta-badge">${escapeHtml(F.display)} · ${escapeHtml(F.body)}</span>
    </div>
    <h2>${escapeHtml(brand)} <span class="accent">${escapeHtml(headlinePunctuation(D.code))}</span></h2>
    <p class="subtitle">${escapeHtml(tagline)}</p>
    <div class="hero-actions">
      <button class="btn-primary" type="button">${escapeHtml(cta)} →</button>
      <button class="btn-secondary" type="button">${escapeHtml(cta2)}</button>
    </div>
  </section>
  <div class="pick-bar" style="background: ${tokens.bg}; color: ${tokens.text};">
    <div class="pick-info">
      <strong>${escapeHtml(D.name)}</strong> · ${escapeHtml(D.tone)}<br />
      Código: <code>STYLE:${code}</code>
    </div>
    <button class="pick-btn" type="button" onclick="pickStyle('${code}', '${escapeHtml(D.name)}')">
      Elegir este estilo →
    </button>
  </div>
  `;

  return { directionStyles, sectionHtml };
}

function pickContrastingText(hex) {
  const c = hex.replace("#", "");
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 128 ? "#000" : "#FFF";
}

function getDirectionalBackground(code, tokens) {
  switch (code) {
    case "PG":
      return `radial-gradient(60% 40% at 80% 0%, ${tokens.accent}22 0%, transparent 60%), radial-gradient(50% 50% at 0% 100%, ${tokens.muted}33 0%, transparent 70%)`;
    case "LDW":
      return `radial-gradient(50% 60% at 80% 20%, ${tokens.accent}22 0%, transparent 70%)`;
    case "RT":
      return `repeating-linear-gradient(0deg, transparent 0, transparent 3px, rgba(0,255,65,0.03) 3px, rgba(0,255,65,0.03) 4px)`;
    case "NB":
      return `repeating-linear-gradient(45deg, ${tokens.text}11 0, ${tokens.text}11 2px, transparent 2px, transparent 24px)`;
    case "SM":
      return `linear-gradient(to right, transparent 0%, transparent calc(100% - 1px), ${tokens.muted}33 100%)`;
    default:
      return "transparent";
  }
}

function headlinePunctuation(code) {
  switch (code) {
    case "ED": return "·";
    case "RT": return "_";
    case "NB": return "!";
    default: return "";
  }
}

// ===== Main =====
async function main() {
  const args = parseArgs();
  if (!args.brand) {
    console.error("Error: --brand es obligatorio");
    console.error('Uso: node preview-styles.mjs --brand "Mi Marca" --directions "UE,SM,ED"');
    process.exit(1);
  }

  const brand = args.brand;
  const tagline = args.tagline || "Hecho con intención.";
  const cta = args.cta || "Empezar ahora";
  const cta2 = args.cta2 || "Saber más";
  const directions = (args.directions || "UE,SM,ED").split(",").map(s => s.trim().toUpperCase());

  // Validar direcciones
  for (const d of directions) {
    if (!DIRECTIONS[d]) {
      console.error(`Dirección desconocida: ${d}. Disponibles: ${Object.keys(DIRECTIONS).join(", ")}`);
      process.exit(1);
    }
  }

  // Resolver paletas y fuentes
  const paletteIds = args.paletteIds
    ? args.paletteIds.split(",").map(s => s.trim().toUpperCase())
    : directions.map(d => DIRECTIONS[d].paletteDefault);
  const fontIds = args.fontIds
    ? args.fontIds.split(",").map(s => s.trim().toUpperCase())
    : directions.map(d => DIRECTIONS[d].fontPairDefault);

  if (paletteIds.length !== directions.length) {
    console.error("Error: --paletteIds debe tener el mismo número de elementos que --directions");
    process.exit(1);
  }
  if (fontIds.length !== directions.length) {
    console.error("Error: --fontIds debe tener el mismo número de elementos que --directions");
    process.exit(1);
  }

  // Cargar template
  const templatePath = args.template || resolve(__dirname, "../templates/preview-template.html");
  const templateRaw = await readFile(templatePath, "utf-8");

  // Construir secciones
  const sections = directions.map((d, i) =>
    buildSection(d, paletteIds[i], fontIds[i], brand, tagline, cta, cta2, i)
  );

  const directionStyles = sections.map(s => s.directionStyles).join("\n");
  const sectionHtml = sections.map(s => s.sectionHtml).join("\n");

  // Construir href de Google Fonts
  const uniqueFontIds = [...new Set(fontIds)];
  const googleFontParts = uniqueFontIds.map(f => FONT_PAIRS[f].googleParam);
  const fontsHref = `https://fonts.googleapis.com/css2?family=${googleFontParts.join("&family=")}&display=swap`;

  // Render
  let html = templateRaw
    .replace(/\{\{BRAND\}\}/g, escapeHtml(brand))
    .replace(/\{\{FONTS_HREF\}\}/g, fontsHref)
    .replace(/\{\{DIRECTION_STYLES\}\}/g, directionStyles)
    .replace(/\{\{PREVIEW_SECTIONS\}\}/g, sectionHtml);

  // Escribir output
  const outPath = resolve(args.out || ".brief/preview.html");
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, html, "utf-8");

  console.log("✓ Preview generado:");
  console.log("  " + outPath);
  console.log("");
  console.log("  Direcciones incluidas:");
  directions.forEach((d, i) => {
    console.log(`    [${i + 1}] ${DIRECTIONS[d].name} · paleta ${PALETTES[paletteIds[i]].name} · fuentes ${FONT_PAIRS[fontIds[i]].display}/${FONT_PAIRS[fontIds[i]].body}`);
  });
  console.log("");
  console.log("  Abre en navegador con:");
  if (process.platform === "win32") {
    console.log(`    start "" "${outPath}"`);
  } else if (process.platform === "darwin") {
    console.log(`    open "${outPath}"`);
  } else {
    console.log(`    xdg-open "${outPath}"`);
  }
}

main().catch(err => {
  console.error("Error:", err.message);
  process.exit(1);
});
