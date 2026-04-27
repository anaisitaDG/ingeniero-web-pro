#!/usr/bin/env node
/**
 * verify-build.mjs
 *
 * Verifica entorno y, opcionalmente, smoke-tests sobre un proyecto Next.js generado.
 *
 * Modos:
 *   --check-env       Solo verifica Node, npm, git (rápido)
 *   --full            Ejecuta todos los checks: tsc, build, content audit
 *   (default)         Lo mismo que --check-env
 *
 * Salida:
 *   stdout: tabla legible
 *   exit 0 si todo OK, exit 1 si algo fallido
 */

import { existsSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";

const args = new Set(process.argv.slice(2));
const FULL = args.has("--full");
const CHECK_ENV = args.has("--check-env") || !FULL;

const checks = [];
let failures = 0;

function record(name, ok, detail = "") {
  checks.push({ name, ok, detail });
  if (!ok) failures++;
}

function safeExec(cmd) {
  try {
    return { ok: true, out: execSync(cmd, { stdio: ["ignore", "pipe", "pipe"] }).toString().trim() };
  } catch (err) {
    return { ok: false, out: (err.stderr || err.stdout || err.message || "").toString().trim() };
  }
}

// ===== CHECK ENV =====

function checkNode() {
  const v = process.versions.node;
  const [major, minor] = v.split(".").map(Number);
  const ok = major > 20 || (major === 20 && minor >= 9);
  record("Node.js >= 20.9", ok, `actual: v${v}`);
}

function checkNpm() {
  const r = safeExec("npm --version");
  if (!r.ok) return record("npm disponible", false, r.out);
  const major = parseInt(r.out.split(".")[0], 10);
  record("npm >= 9", major >= 9, `actual: v${r.out}`);
}

function checkGit() {
  const r = safeExec("git --version");
  record("git disponible", r.ok, r.out);
}

function checkPlatform() {
  const platform = process.platform;
  const supported = ["win32", "darwin", "linux"].includes(platform);
  record("Plataforma soportada", supported, platform);
}

// ===== CHECK PROYECTO (FULL) =====

function checkPackageJson() {
  const path = join(process.cwd(), "package.json");
  if (!existsSync(path)) {
    record("package.json existe", false, "no encontrado en cwd");
    return null;
  }
  const pkg = JSON.parse(readFileSync(path, "utf-8"));
  record("package.json existe", true);

  const next = pkg.dependencies?.next || pkg.devDependencies?.next;
  if (!next) {
    record("Next.js instalado", false);
    return pkg;
  }
  const version = String(next).replace(/[^\d.]/g, "");
  const major = parseInt(version.split(".")[0], 10);
  record("Next.js >= 16", major >= 16, `actual: ${next}`);

  const react = pkg.dependencies?.react;
  if (react) {
    const m = parseInt(String(react).replace(/[^\d.]/g, "").split(".")[0], 10);
    record("React >= 19", m >= 19, `actual: ${react}`);
  }

  return pkg;
}

function checkTypeScript() {
  console.log("→ Ejecutando tsc --noEmit ...");
  const r = safeExec("npx tsc --noEmit");
  record("TypeScript compila", r.ok, r.ok ? "" : (r.out.split("\n").slice(0, 5).join("\n")));
}

function checkBuild() {
  console.log("→ Ejecutando npm run build ...");
  const r = safeExec("npm run build");
  record("Build exitoso", r.ok, r.ok ? "" : (r.out.split("\n").slice(-10).join("\n")));
}

function checkSeoFiles() {
  const must = [
    "src/app/sitemap.ts",
    "src/app/robots.ts",
    "public/llms.txt",
    "public/identity.json",
  ];
  for (const f of must) {
    record(`Existe ${f}`, existsSync(join(process.cwd(), f)));
  }
}

function checkNoTemplateLeftovers() {
  // Detecta restos del template de Next.js
  try {
    const home = readFileSync(join(process.cwd(), "src/app/page.tsx"), "utf-8");
    const leftovers = [
      "Get started by editing",
      "Deploy on Vercel",
      "Read our docs",
      "Save and see your changes",
    ];
    const found = leftovers.filter((l) => home.includes(l));
    record(
      "Sin template inicial Next.js",
      found.length === 0,
      found.length ? `restos: ${found.join(", ")}` : ""
    );
  } catch {
    record("page.tsx leíble", false);
  }
}

function checkNoHardcodedColors() {
  // Heurística básica: busca clases Tailwind genéricas
  try {
    const r = safeExec("git ls-files \"src/**/*.tsx\" \"src/**/*.ts\"");
    if (!r.ok) {
      record("Sin colores hardcoded (Tailwind genérico)", true, "skip - no git");
      return;
    }
    const files = r.out.split("\n").filter(Boolean);
    const offenders = [];
    const pattern = /\b(bg|text|border)-(red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|gray|zinc|neutral|stone|slate)-\d{2,3}\b/;
    for (const f of files) {
      try {
        const c = readFileSync(f, "utf-8");
        if (pattern.test(c)) offenders.push(f);
      } catch {}
      if (offenders.length >= 5) break;
    }
    record(
      "Sin colores Tailwind genéricos",
      offenders.length === 0,
      offenders.length ? `${offenders.length} archivos: ${offenders.slice(0, 3).join(", ")}` : ""
    );
  } catch {
    record("Auditoría de colores", true, "skip");
  }
}

function checkGitignore() {
  const path = join(process.cwd(), ".gitignore");
  if (!existsSync(path)) {
    record(".gitignore existe", false);
    return;
  }
  const c = readFileSync(path, "utf-8");
  record(".env.local en .gitignore", c.includes(".env.local") || c.includes(".env*"));
  record(".brief/ en .gitignore", c.includes(".brief"));
}

// ===== RUN =====

function printResults() {
  const PASS = "✓";
  const FAIL = "✗";
  console.log("");
  console.log("┌─ Verificación ─────────────────────────────────────────┐");
  for (const c of checks) {
    const sym = c.ok ? PASS : FAIL;
    const line = `${sym} ${c.name}`.padEnd(54);
    console.log(`│ ${line}│`);
    if (c.detail) {
      const dl = c.detail.split("\n").slice(0, 3);
      for (const d of dl) {
        const ldetail = `   ${d}`.padEnd(54).slice(0, 54);
        console.log(`│ ${ldetail}│`);
      }
    }
  }
  console.log(`└─ ${checks.length - failures}/${checks.length} OK ──────────────────────────────────────┘`);
  console.log("");
}

(async function main() {
  // Always run env checks
  checkNode();
  checkNpm();
  checkGit();
  checkPlatform();

  if (FULL) {
    const pkg = checkPackageJson();
    if (pkg) {
      checkGitignore();
      checkSeoFiles();
      checkNoTemplateLeftovers();
      checkNoHardcodedColors();
      checkTypeScript();
      checkBuild();
    }
  }

  printResults();
  process.exit(failures > 0 ? 1 : 0);
})();
