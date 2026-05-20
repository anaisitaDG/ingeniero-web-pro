#!/usr/bin/env node
/**
 * scrape-cascade.mjs
 *
 * Extrae contenido de una URL en 3 niveles automáticos:
 *   1) curl con User-Agent real (sitios estáticos)
 *   2) Puppeteer headless (SPAs, JS dinámico)
 *   3) Devuelve instrucciones manuales (Cloudflare, login, sitios protegidos)
 *
 * Uso:
 *   node scrape-cascade.mjs <URL> [--out path/to/scrape.json]
 *
 * Output:
 *   JSON con { url, method, title, headings, paragraphs, navLinks, sections,
 *              colors, fonts, error?, manualInstructions? }
 */

import { writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { existsSync } from "node:fs";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const TIMEOUT_MS = 20000;

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { _: [] };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--out") out.out = args[++i];
    else if (args[i].startsWith("--")) out[args[i].slice(2)] = true;
    else out._.push(args[i]);
  }
  return out;
}

async function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`timeout ${ms}ms`)), ms)
    ),
  ]);
}

// ===== NIVEL 1: curl =====
async function level1Curl(url) {
  try {
    const res = await withTimeout(
      fetch(url, {
        headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
        redirect: "follow",
      }),
      TIMEOUT_MS
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    if (html.length < 2000) throw new Error("HTML demasiado corto");

    const semanticTags = (html.match(/<(h[1-6]|p|nav|section|main|article)\b/gi) || []).length;
    if (semanticTags < 5) throw new Error("HTML sin contenido semántico suficiente");

    return { method: "curl", html };
  } catch (err) {
    return { method: "curl_failed", error: err.message };
  }
}

// ===== NIVEL 2: Puppeteer =====
async function level2Puppeteer(url) {
  let puppeteer;
  try {
    puppeteer = await import("puppeteer");
  } catch {
    return {
      method: "puppeteer_unavailable",
      error: "Puppeteer no instalado. Instálalo con: npm install --save-dev puppeteer",
    };
  }

  let browser;
  try {
    browser = await puppeteer.default.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    await page.setUserAgent(UA);
    await page.setViewport({ width: 1280, height: 800 });

    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
    await page.waitForSelector("h1, h2, p, nav", { timeout: 8000 }).catch(() => {});

    const html = await page.content();

    const data = await page.evaluate(() => {
      const getText = (sel, max = 50) =>
        [...document.querySelectorAll(sel)]
          .map((el) => (el.textContent || "").trim())
          .filter((t) => t.length > 2)
          .slice(0, max);

      const colors = new Set();
      const fonts = new Set();
      let count = 0;
      for (const el of document.querySelectorAll("*")) {
        if (++count > 800) break;
        const s = window.getComputedStyle(el);
        if (s.color && s.color !== "rgba(0, 0, 0, 0)") colors.add(s.color);
        if (s.backgroundColor && s.backgroundColor !== "rgba(0, 0, 0, 0)") {
          colors.add(s.backgroundColor);
        }
        if (s.fontFamily) fonts.add(s.fontFamily.split(",")[0].trim().replace(/^["']|["']$/g, ""));
      }

      const navLinks = [...document.querySelectorAll("nav a, header a")]
        .map((a) => ({ text: (a.textContent || "").trim(), href: a.getAttribute("href") }))
        .filter((l) => l.text.length > 0)
        .slice(0, 30);

      const sections = [...document.querySelectorAll("section, [class*='section'], main > div")]
        .map((el) => el.id || el.className || "section")
        .slice(0, 20);

      return {
        title: document.title,
        headings: getText("h1, h2, h3", 60),
        paragraphs: getText("p", 60),
        navLinks,
        sections,
        colors: [...colors].slice(0, 30),
        fonts: [...fonts].slice(0, 10),
      };
    });

    return { method: "puppeteer", html, data };
  } catch (err) {
    return { method: "puppeteer_failed", error: err.message };
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

// ===== NIVEL 3: instrucciones manuales =====
function level3Manual(url) {
  return {
    method: "manual_required",
    manualInstructions: `
No se pudo acceder automáticamente a ${url} (probablemente Cloudflare,
login requerido o protección anti-bot activa).

Tres opciones para continuar:

OPCIÓN A — Guardar página completa (2 min):
  1. Abre ${url} en Chrome
  2. Espera a que cargue completamente
  3. Pulsa Ctrl+S (Windows) o Cmd+S (Mac)
  4. Elige "Página web, completa" como formato
  5. Guarda el archivo .html en la carpeta del proyecto
  6. Dime el nombre del archivo y lo proceso

OPCIÓN B — Captura completa (1 min):
  1. Abre ${url} en Chrome
  2. F12 → pestaña Elements → clic derecho en <html> → Capture Node Screenshot
     (o instala extensión GoFullPage)
  3. Sube la imagen en el chat

OPCIÓN C — Copiar el HTML directo (técnico):
  1. Abre ${url}
  2. Clic derecho → "Ver código fuente" (Ctrl+U)
  3. Selecciona todo (Ctrl+A), copia y pega aquí

Con cualquiera de las tres continúo el análisis.
    `.trim(),
  };
}

// ===== Extracción de datos del HTML estático (Nivel 1) =====
function extractFromHtml(html) {
  const stripTags = (s) => s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : "";

  const headings = [];
  for (const m of html.matchAll(/<h[1-3][^>]*>([^]*?)<\/h[1-3]>/gi)) {
    const t = stripTags(m[1]);
    if (t && t.length > 2 && t.length < 200) headings.push(t);
    if (headings.length >= 60) break;
  }

  const paragraphs = [];
  for (const m of html.matchAll(/<p[^>]*>([^]*?)<\/p>/gi)) {
    const t = stripTags(m[1]);
    if (t && t.length > 10) paragraphs.push(t);
    if (paragraphs.length >= 60) break;
  }

  const navLinks = [];
  const navMatch = html.match(/<nav[^>]*>([^]*?)<\/nav>/i);
  if (navMatch) {
    for (const m of navMatch[1].matchAll(/<a[^>]*href=["']([^"']+)["'][^>]*>([^]*?)<\/a>/gi)) {
      const t = stripTags(m[2]);
      if (t) navLinks.push({ text: t, href: m[1] });
      if (navLinks.length >= 30) break;
    }
  }

  const colorSet = new Set();
  for (const m of html.matchAll(/#([0-9a-fA-F]{3,6})\b/g)) colorSet.add(`#${m[1]}`);
  for (const m of html.matchAll(/rgb\([^)]+\)/g)) colorSet.add(m[0]);
  const colors = [...colorSet].slice(0, 30);

  const fontSet = new Set();
  for (const m of html.matchAll(/font-family\s*:\s*([^;"'}]+)/gi)) {
    const f = m[1].split(",")[0].trim().replace(/^["']|["']$/g, "");
    if (f && f.length < 50) fontSet.add(f);
  }
  const fonts = [...fontSet].slice(0, 10);

  return { title, headings, paragraphs, navLinks, sections: [], colors, fonts };
}

// ===== Main =====
async function main() {
  const args = parseArgs();
  const url = args._[0];
  if (!url) {
    console.error("Uso: node scrape-cascade.mjs <URL> [--out path/to/scrape.json]");
    process.exit(1);
  }

  const outPath = resolve(args.out || ".brief/scrape.json");

  console.error(`[1/3] Probando curl: ${url}`);
  const lvl1 = await level1Curl(url);
  let result;

  if (lvl1.method === "curl") {
    console.error("✓ Nivel 1 exitoso (sitio estático)");
    const data = extractFromHtml(lvl1.html);
    result = { url, method: "curl", ...data };
  } else {
    console.error(`✗ Nivel 1: ${lvl1.error}`);
    console.error("[2/3] Probando Puppeteer...");
    const lvl2 = await level2Puppeteer(url);

    if (lvl2.method === "puppeteer") {
      console.error("✓ Nivel 2 exitoso (sitio renderizado con JS)");
      result = { url, method: "puppeteer", ...lvl2.data };
    } else {
      console.error(`✗ Nivel 2: ${lvl2.error}`);
      console.error("[3/3] Generando instrucciones manuales");
      result = {
        url,
        method: "manual_required",
        ...level3Manual(url),
      };
    }
  }

  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, JSON.stringify(result, null, 2), "utf-8");

  console.error("");
  console.error(`✓ Resultado guardado en: ${outPath}`);
  console.error(`  Método usado: ${result.method}`);
  if (result.headings) console.error(`  Headings: ${result.headings.length}`);
  if (result.paragraphs) console.error(`  Párrafos: ${result.paragraphs.length}`);
  if (result.colors) console.error(`  Colores: ${result.colors.length}`);
  if (result.fonts) console.error(`  Fuentes: ${result.fonts.length}`);

  // imprimir el JSON a stdout para que el llamador pueda hacer pipe
  process.stdout.write(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error("Error fatal:", err.message);
  process.exit(1);
});
