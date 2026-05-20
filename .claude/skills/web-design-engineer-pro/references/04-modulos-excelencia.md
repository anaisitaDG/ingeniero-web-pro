# Módulos de Excelencia

Módulos opcionales que se apilan **encima** del stack base (Next.js 16 + Framer Motion). Se activan según el brief — algunos siempre, otros solo cuando el proyecto lo justifica.

---

## Árbol de decisión

```
Cualquier proyecto
│
├── SIEMPRE
│   ├── M1: Smooth Scroll con Lenis
│   ├── M5: Tipografía cinética con SplitType (en H1/H2 clave)
│   ├── M7: Imágenes con next/image + blur placeholder
│   ├── M9: SEO técnico completo (OG + JSON-LD + sitemap + robots)
│   └── M10: Tokens CSS automáticos (en Fase 4)
│
├── SI desktop (no mobile-only)
│   └── M2: Cursor magnético personalizado [opcional, solo si LDW/NB]
│
├── SI multi-página/ruta
│   └── M3: Transiciones de página con Framer Motion
│
├── SI brief menciona storytelling, hero de producto, features con reveal
│   └── M4: Scroll storytelling pinneado (GSAP + ScrollTrigger)
│
├── SI brief tiene imágenes hero/galerías/fondos fotográficos
│   └── M6: Parallax real de imágenes
│
└── SI brief incluye producto 3D, hero inmersivo, experiencia premium
    └── M8: Three.js + React Three Fiber [requiere modelo .glb del cliente]
```

---

## M1 — Smooth Scroll con Lenis (siempre)

**Por qué**: el scroll nativo es mecánico y varía entre Windows y macOS. Lenis lo unifica con inercia natural.

**Instalación**:
```bash
npm install lenis
```

**`src/components/SmoothScroll.tsx`**:
```tsx
"use client";
import { ReactLenis, useLenis } from "lenis/react";
import { useEffect } from "react";

export function SmoothScroll({ children }: { children: React.ReactNode }) {
  const lenis = useLenis();

  useEffect(() => {
    if (!lenis) return;
    let raf: number;
    const tick = (time: number) => {
      lenis.raf(time);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [lenis]);

  return (
    <ReactLenis
      root
      options={{
        duration: 1.2,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
      }}
    >
      {children}
    </ReactLenis>
  );
}
```

**Integración GSAP** (solo si M4 activo):
```tsx
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

useEffect(() => {
  if (!lenis) return;
  const onScroll = () => ScrollTrigger.update();
  lenis.on("scroll", onScroll);
  return () => lenis.off("scroll", onScroll);
}, [lenis]);
```

**Reglas**:
- Para deshabilitar Lenis en un elemento (modal con scroll interno): `data-lenis-prevent`
- En sección con `position: fixed`: `lenis.stop()` al abrir, `lenis.start()` al cerrar
- `prefers-reduced-motion: reduce` desactiva Lenis automáticamente (gestionado por la lib)

---

## M2 — Cursor magnético (opcional desktop)

**Por qué**: el cursor es el primer punto de contacto. Personalizado comunica artesanía.

**Cuándo usar**: solo en proyectos desktop-first con direcciones LDW, NB, ED. NUNCA en mobile-only ni en sitios con muchos formularios (interfiere con accesibilidad).

**`src/components/MagneticCursor.tsx`**:
```tsx
"use client";
import { useEffect, useRef } from "react";

export function MagneticCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Respetar a11y
    const isCoarse = window.matchMedia("(pointer: coarse)").matches;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (isCoarse || reducedMotion) return;

    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return;

    document.documentElement.style.cursor = "none";

    let mouseX = 0, mouseY = 0;
    let ringX = 0, ringY = 0;

    const onMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      dot.style.transform = `translate(${mouseX}px, ${mouseY}px)`;
    };
    window.addEventListener("mousemove", onMove);

    let raf = 0;
    const tick = () => {
      ringX += (mouseX - ringX) * 0.18;
      ringY += (mouseY - ringY) * 0.18;
      ring.style.transform = `translate(${ringX}px, ${ringY}px)`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const handlers: Array<{ el: Element; enter: () => void; leave: () => void }> = [];
    const interactive = document.querySelectorAll("a, button, [data-magnetic]");
    interactive.forEach((el) => {
      const enter = () => ring.classList.add("magnetic-active");
      const leave = () => ring.classList.remove("magnetic-active");
      el.addEventListener("mouseenter", enter);
      el.addEventListener("mouseleave", leave);
      handlers.push({ el, enter, leave });
    });

    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
      handlers.forEach(({ el, enter, leave }) => {
        el.removeEventListener("mouseenter", enter);
        el.removeEventListener("mouseleave", leave);
      });
      document.documentElement.style.cursor = "auto";
    };
  }, []);

  return (
    <>
      <div
        ref={dotRef}
        aria-hidden
        className="fixed left-0 top-0 z-[9999] -translate-x-1/2 -translate-y-1/2 pointer-events-none"
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: "var(--color-accent)",
        }}
      />
      <div
        ref={ringRef}
        aria-hidden
        className="fixed left-0 top-0 z-[9998] -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-[width,height,opacity] duration-200"
        style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          border: "1px solid var(--color-accent)",
          opacity: 0.6,
        }}
      />
      <style jsx>{`
        :global(.magnetic-active) {
          width: 64px !important;
          height: 64px !important;
          opacity: 0.3 !important;
        }
      `}</style>
    </>
  );
}
```

**Cleanup correcto** — fix del bug del skill original que dejaba listeners colgando.

---

## M3 — Transiciones de página con Framer Motion

**Por qué**: GSAP/Framer animan dentro de una página; las transiciones entre páginas requieren coordinar exit + enter.

**Instalación** (ya viene con `motion`):
```bash
npm install motion
```

**`src/components/PageTransition.tsx`** (con las 8 direcciones):
```tsx
"use client";
import { motion, AnimatePresence } from "motion/react";
import { usePathname } from "next/navigation";

const variants = {
  ED: { in: { opacity: 0, y: 20 }, on: { opacity: 1, y: 0 }, out: { opacity: 0, y: -20 }, t: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
  SM: { in: { opacity: 0 }, on: { opacity: 1 }, out: { opacity: 0 }, t: { duration: 0.3, ease: "easeInOut" } },
  LDW: { in: { opacity: 0, scale: 1.02 }, on: { opacity: 1, scale: 1 }, out: { opacity: 0, scale: 0.98 }, t: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } },
  CB: { in: { opacity: 0, y: 16 }, on: { opacity: 1, y: 0 }, out: { opacity: 0, y: -16 }, t: { duration: 0.45, ease: "easeOut" } },
  UE: { in: { opacity: 0, y: 30 }, on: { opacity: 1, y: 0 }, out: { opacity: 0, y: -30 }, t: { duration: 0.8, ease: [0.22, 1, 0.36, 1] } },
  NB: { in: { opacity: 0, x: -40 }, on: { opacity: 1, x: 0 }, out: { opacity: 0, x: 40 }, t: { duration: 0.4, ease: "easeOut" } },
  PG: { in: { opacity: 0, scale: 0.98 }, on: { opacity: 1, scale: 1 }, out: { opacity: 0, scale: 0.98 }, t: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
  RT: { in: { opacity: 0 }, on: { opacity: 1 }, out: { opacity: 0 }, t: { duration: 0.15, ease: "linear" } },
} as const;

type Direction = keyof typeof variants;

export function PageTransition({
  children,
  direction = "SM",
}: {
  children: React.ReactNode;
  direction?: Direction;
}) {
  const pathname = usePathname();
  const v = variants[direction];

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        initial={v.in}
        animate={v.on}
        exit={v.out}
        transition={v.t}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
```

**Las 8 direcciones cubiertas** — fix del bug del skill original que solo tenía 4.

---

## M4 — Scroll storytelling pinneado (GSAP)

**Por qué**: el scroll deja de ser navegación y se vuelve narración. Una sección queda fija mientras el contenido cambia.

**Cuándo usar**: brief menciona "proceso", "cómo funciona", "nuestra historia", o producto con features que se revelan.

**Instalación**:
```bash
npm install gsap @gsap/react
```

**Patrón base**:
```tsx
"use client";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useRef } from "react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

export function PinnedStory() {
  const container = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduced) return;

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: container.current,
          start: "top top",
          end: "+=300%",
          scrub: 1.5,
          pin: true,
          anticipatePin: 1,
        },
      });

      tl.to(".panel-1", { autoAlpha: 0, y: -40, duration: 1 })
        .from(".panel-2", { autoAlpha: 0, y: 40, duration: 1 }, "<")
        .to(".panel-2", { autoAlpha: 0, y: -40, duration: 1 }, "+=0.5")
        .from(".panel-3", { autoAlpha: 0, y: 40, duration: 1 }, "<");
    },
    { scope: container },
  );

  return (
    <section ref={container} className="relative h-screen overflow-hidden">
      <div className="panel-1 absolute inset-0 flex items-center justify-center">{/* ... */}</div>
      <div className="panel-2 absolute inset-0 flex items-center justify-center">{/* ... */}</div>
      <div className="panel-3 absolute inset-0 flex items-center justify-center">{/* ... */}</div>
    </section>
  );
}
```

**Reglas**:
- `useGSAP` con `scope` SIEMPRE — nunca `useEffect`
- `autoAlpha` (no `opacity` directo) — gestiona visibility + opacity juntos
- Alias hardware (`x`, `y`, `scale`) — nunca `transform: translate(...)` directo
- `prefers-reduced-motion` respetado dentro del propio hook

---

## M5 — Tipografía cinética con SplitType (siempre)

**Por qué**: animar bloques enteros de texto es plano. Dividir por carácter/palabra/línea da firma de premio.

**Instalación**:
```bash
npm install split-type
```

**Hook reusable `src/hooks/useSplitText.ts`**:
```tsx
"use client";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import SplitType from "split-type";
import { useRef } from "react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

export function useSplitText(
  selector: string,
  options?: {
    type?: "chars" | "words" | "lines";
    stagger?: number;
    trigger?: "immediate" | "scroll";
  },
) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduced) return;

      const el = ref.current?.querySelector(selector);
      if (!el) return;

      const split = new SplitType(el as HTMLElement, {
        types: options?.type ?? "words",
      });
      const targets =
        options?.type === "chars" ? split.chars
          : options?.type === "lines" ? split.lines
          : split.words;
      if (!targets || targets.length === 0) return;

      split.lines?.forEach((l) => ((l as HTMLElement).style.overflow = "hidden"));

      const config = {
        autoAlpha: 0,
        y: options?.type === "lines" ? "110%" : 20,
        duration: 0.7,
        stagger: options?.stagger ?? 0.04,
        ease: "power3.out",
      };

      if (options?.trigger === "scroll") {
        gsap.from(targets, {
          ...config,
          scrollTrigger: { trigger: el, start: "top 85%" },
        });
      } else {
        gsap.from(targets, config);
      }

      return () => split.revert();
    },
    { scope: ref },
  );

  return ref;
}
```

**Uso**:
```tsx
const ref = useSplitText("h1", { type: "chars", stagger: 0.03, trigger: "scroll" });
return <section ref={ref}><h1>Café que cuenta historias</h1></section>;
```

---

## M6 — Parallax de imágenes real

**Por qué**: parallax CSS deforma. El real es velocidad diferencial — la imagen se mueve más lenta que el scroll.

**Cuándo usar**: hero fotográfico, galerías grandes, fondos cinemáticos.

**Hook `src/hooks/useParallax.ts`**:
```tsx
"use client";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useRef } from "react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

export function useParallax(speed = 0.4) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduced) return;

      const target = ref.current?.querySelector("img, [data-parallax]");
      if (!target) return;

      gsap.fromTo(
        target,
        { y: `-${speed * 100}%` },
        {
          y: `${speed * 100}%`,
          ease: "none",
          scrollTrigger: {
            trigger: ref.current,
            start: "top bottom",
            end: "bottom top",
            scrub: true,
          },
        },
      );
    },
    { scope: ref },
  );

  return ref;
}
```

**Uso**:
```tsx
const ref = useParallax(0.3);
return (
  <div ref={ref} className="relative h-[60vh] overflow-hidden">
    <Image src="/hero.jpg" alt="..." fill className="object-cover scale-125" data-parallax />
  </div>
);
```

**Speed**: 0.2 sutil · 0.4 medio · 0.6 dramático.

---

## M7 — Imágenes optimizadas (siempre)

**Por qué**: imágenes pesadas matan SEO + retención. Sin blur placeholder se ven mal cargando.

**Instalación**:
```bash
npm install plaiceholder sharp
```

**`src/lib/blur.ts`** (lee desde filesystem, NO `fetch` — fix del bug del skill original):
```ts
import { getPlaiceholder } from "plaiceholder";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const FALLBACK = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

export async function getBlurDataURL(publicPath: string): Promise<string> {
  try {
    // publicPath: "/images/hero.jpg" → "<root>/public/images/hero.jpg"
    const cleanPath = publicPath.replace(/^\//, "");
    const filePath = join(process.cwd(), "public", cleanPath);
    const buffer = await readFile(filePath);
    const { base64 } = await getPlaiceholder(buffer);
    return base64;
  } catch {
    return FALLBACK;
  }
}
```

**Uso en Server Component**:
```tsx
import Image from "next/image";
import { getBlurDataURL } from "@/lib/blur";

export default async function Hero() {
  const blur = await getBlurDataURL("/images/hero.jpg");
  return (
    <Image
      src="/images/hero.jpg"
      alt="Interior de Ritmo Negro — cafetería de especialidad"
      fill
      priority
      placeholder="blur"
      blurDataURL={blur}
      className="object-cover"
      sizes="(max-width: 768px) 100vw, 50vw"
    />
  );
}
```

**Reglas**:
- `priority={true}` solo en above-the-fold (1 imagen por página)
- `alt` SIEMPRE descriptivo (negocio + contexto), nunca vacío
- `sizes` SIEMPRE definido para evitar descargar 4K en mobile

---

## M8 — Three.js + React Three Fiber (opcional)

**Cuándo usar**: solo si el brief incluye producto 3D explícito Y el cliente tiene modelo `.glb` listo. NO usar para "decoración 3D" genérica.

**Instalación**:
```bash
npm install three @react-three/fiber @react-three/drei
npm install -D @types/three
```

**`src/components/Hero3D.tsx`** (con dispose correcto + error boundary):
```tsx
"use client";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF, Environment, ContactShadows, useScroll } from "@react-three/drei";
import { useRef, Suspense, useEffect } from "react";
import type { Group } from "three";

function ProductModel({ path }: { path: string }) {
  const { scene } = useGLTF(path);
  const ref = useRef<Group>(null);
  const scroll = useScroll();

  useFrame(() => {
    if (!ref.current) return;
    ref.current.rotation.y = scroll.offset * Math.PI * 2;
  });

  useEffect(() => {
    return () => {
      scene.traverse((obj: any) => {
        obj.geometry?.dispose?.();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach((m: any) => m.dispose());
          else obj.material.dispose();
        }
      });
    };
  }, [scene]);

  return <primitive ref={ref} object={scene} scale={1.5} />;
}

export function Hero3D({ modelPath }: { modelPath: string }) {
  return (
    <div className="w-full h-screen">
      <Canvas
        camera={{ position: [0, 0, 5], fov: 45 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        aria-label="Modelo 3D interactivo del producto"
        role="img"
      >
        <Suspense fallback={null}>
          <ProductModel path={modelPath} />
          <Environment preset="studio" />
          <ContactShadows position={[0, -1.5, 0]} opacity={0.4} scale={10} blur={2.5} />
        </Suspense>
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} />
      </Canvas>
    </div>
  );
}
```

**Detector de capacidad mobile** con SSR guard:
```tsx
"use client";
import { useEffect, useState } from "react";

export function useGPUCapability() {
  const [capable, setCapable] = useState<boolean | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    if (!gl) {
      setCapable(false);
      return;
    }
    const maxTex = (gl as WebGLRenderingContext).getParameter(
      (gl as WebGLRenderingContext).MAX_TEXTURE_SIZE,
    );
    setCapable(maxTex >= 4096 && navigator.hardwareConcurrency >= 4);
  }, []);

  return capable;
}
```

**Uso con fallback**:
```tsx
const capable = useGPUCapability();
if (capable === false) return <Image src="/product-fallback.jpg" alt="..." fill />;
if (capable === null) return <div className="h-screen bg-[var(--color-card)]" />;
return <Hero3D modelPath="/models/product.glb" />;
```

**Reglas**:
- Máximo 3 `<Canvas>` por página
- Modelos `.glb` máx 5MB con compresión Draco
- `dispose()` SIEMPRE en cleanup
- Error boundary alrededor (no `Suspense fallback={null}` solamente — UX horrible)

---

## M9 — SEO técnico (siempre)

**Tres componentes** (templates en `templates/`):

1. **Metadata Next.js 16 en `layout.tsx`** — OpenGraph + Twitter Cards + robots
2. **JSON-LD Organization + WebSite** — siempre. Si negocio físico, además LocalBusiness.
3. **`sitemap.ts` + `robots.ts`** — generación dinámica con `process.env.NEXT_PUBLIC_SITE_URL`.

Plus: `public/llms.txt` + `public/identity.json` (LLMO) — descubribilidad por LLMs.

Ver `templates/proxy.ts`, `templates/sitemap.ts`, `templates/robots.ts`, `templates/llms.txt`, `templates/identity.json`.

---

## M10 — Tokens CSS automáticos (siempre, en Fase 4)

**`templates/tokens.css`** se copia a `src/app/globals.css` y se rellena con la dirección elegida.

Genera escala de espaciado, tipografía y radios derivada de las variables base, así puedes usar `var(--space-4)`, `var(--font-size-xl)` en cualquier componente.

Soporte de dark mode condicional según dirección (ver `01-direcciones-visuales.md`).
