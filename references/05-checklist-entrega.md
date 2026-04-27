# Checklist de entrega

Ejecutar en CADA proyecto antes de levantar el dev server y dar la URL al usuario.

El script `scripts/verify-build.mjs --full` automatiza la mayoría de estos checks. Los que no se pueden automatizar están marcados con `[manual]`.

---

## 1. TypeScript & build

- [ ] `npx tsc --noEmit` sin errores
- [ ] `npm run build` completa sin errores ni warnings críticos
- [ ] No hay `any` injustificado en el código generado
- [ ] Todos los hooks tienen sus dependencias correctas (sin warnings de `react-hooks/exhaustive-deps`)

## 2. Accesibilidad (WCAG AA)

- [ ] Contraste texto ≥ 4.5:1 en todos los pares (verificable con tokens de la dirección)
- [ ] Contraste texto grande (≥18pt o 14pt bold) ≥ 3:1
- [ ] Cada `<img>` tiene `alt` descriptivo (no vacío, no genérico)
- [ ] Cada `<input>` tiene `<label>` asociado o `aria-label`
- [ ] `<button>` con `type="button"` cuando no envía form
- [ ] Elementos interactivos tienen `:focus-visible` definido
- [ ] Headings en orden jerárquico (H1 único, H2-H6 sin saltar niveles)
- [ ] Skip link para teclado al inicio del `<body>`
- [ ] `lang` correcto en `<html>` (es / es-ES / en según locale)
- [ ] `prefers-reduced-motion` respetado en TODAS las animaciones (Lenis, GSAP, Framer Motion)
- [ ] `pointer: coarse` respetado (cursor magnético deshabilitado en táctil)
- [ ] Canvas Spline/Three.js con `aria-label` y `role="img"`
- [ ] Colores no transmiten información solos (combinar con texto, icono o forma)

## 3. Rendimiento

- [ ] Lighthouse Performance ≥ 90
- [ ] Lighthouse Accessibility ≥ 95
- [ ] Lighthouse Best Practices ≥ 95
- [ ] Lighthouse SEO ≥ 95
- [ ] LCP (Largest Contentful Paint) < 2.5s
- [ ] CLS (Cumulative Layout Shift) < 0.1
- [ ] FCP (First Contentful Paint) < 1.8s
- [ ] Bundle JS principal < 200KB (gzipped)
- [ ] Imágenes con `next/image` (nunca `<img>` cruda)
- [ ] Fuentes con `next/font/google` (nunca `<link>` directo)
- [ ] `priority` SOLO en imagen above-the-fold
- [ ] `sizes` definido en cada `<Image>`
- [ ] `loading="lazy"` por defecto en imágenes below-the-fold
- [ ] Componentes pesados con `dynamic()` import si no son críticos
- [ ] No más de 3 canvas WebGL por página (Three.js)
- [ ] Modelos 3D < 5MB comprimidos con Draco

## 4. Server Components & Next.js 16

- [ ] `"use client"` SOLO donde es necesario (hooks, eventos, estado)
- [ ] Server Components por defecto
- [ ] `params` y `searchParams` con `await` (son Promise en Next 16)
- [ ] `cookies()`, `headers()`, `draftMode()` con `await`
- [ ] Parallel routes con `default.tsx` en cada slot
- [ ] `proxy.ts` (no `middleware.ts`) si hay redirects/auth
- [ ] No usar `experimental.ppr` (deprecated) — usar `cacheComponents: true`
- [ ] `revalidateTag()` con segundo argumento (`'max'` o cacheLife)

## 5. Diseño & sistema de tokens

- [ ] `globals.css` con tokens de la dirección visual (no colores Tailwind genéricos)
- [ ] Cero ocurrencias de `bg-blue-500`, `text-gray-700`, `border-purple-300`, etc. en el código
- [ ] Fuentes aplicadas vía `--font-display` y `--font-body`
- [ ] Espaciado consistente (múltiplos de `--spacing-unit`)
- [ ] Border-radius consistente (`var(--radius)` o `var(--radius-lg)`)
- [ ] Mobile-first: todas las clases responsive empiezan sin breakpoint y crecen a `sm:`, `md:`, `lg:`
- [ ] Verificado en 375px (mobile) → 768px (tablet) → 1280px (desktop)
- [ ] Dark mode funcional si la dirección lo soporta (ver `01-direcciones-visuales.md`)

## 6. SEO & LLMO

- [ ] `generateMetadata()` o `metadata` en cada `page.tsx`
- [ ] Title con marca + descripción corta (`%s | Marca`)
- [ ] Description de 150-160 caracteres
- [ ] OpenGraph completo (title, description, image 1200×630, locale)
- [ ] Twitter Card configurada (summary_large_image)
- [ ] JSON-LD Organization + WebSite en `layout.tsx`
- [ ] JSON-LD LocalBusiness si hay negocio físico (con address, geo, openingHours, priceRange)
- [ ] `sitemap.ts` genera URLs reales del proyecto
- [ ] `robots.ts` apunta al sitemap real
- [ ] `public/llms.txt` con resumen del negocio
- [ ] `public/llms-full.txt` con descripción extendida
- [ ] `public/identity.json` con datos estructurados
- [ ] Slugs SEO-friendly (kebab-case, sin acentos, sin caracteres especiales)
- [ ] URLs limpias (no `?id=123`, sí `/post/titulo-del-post`)
- [ ] Canonical URLs configuradas si hay paginación
- [ ] hreflang si multi-idioma

## 7. Funcionalidad

- [ ] Formulario de contacto/reservas envía email correctamente (probar con email real)
- [ ] Newsletter signup guarda en backend (Resend o Supabase)
- [ ] Mapa de Google Maps carga sin errores de API key
- [ ] Pasarela de pagos en modo test (si Stripe activado)
- [ ] CTA principal lleva a la acción correcta (no es link roto)
- [ ] Footer con links funcionales (no `#`)
- [ ] Redes sociales abren en nueva pestaña con `rel="noopener noreferrer"`

## 8. Seguridad

- [ ] `.env.local` en `.gitignore`
- [ ] `.brief/` en `.gitignore` (info sensible del cliente)
- [ ] Cero secretos commiteados (revisar con `gitleaks` o búsqueda de patrones API_KEY)
- [ ] Headers de seguridad en `next.config.ts` o `proxy.ts`:
  - `X-Frame-Options: DENY`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- [ ] Supabase con RLS activado en TODAS las tablas (sin excepción)
- [ ] Stripe con webhooks firmados (`STRIPE_WEBHOOK_SECRET` validado)
- [ ] Resend con dominio verificado
- [ ] CORS configurado correctamente en API routes públicas

## 9. UX & contenido

- [ ] Copyright dinámico (`{new Date().getFullYear()}`)
- [ ] Sin "Lorem ipsum" en producción
- [ ] Sin contenido del template inicial de Next.js (logo SVG, "Get started by editing")
- [ ] Errores de formulario tienen mensajes claros
- [ ] Estados de loading visibles en acciones lentas
- [ ] Estados vacíos tienen mensaje + CTA
- [ ] 404 page personalizada con tono de la marca
- [ ] Confirmación visible tras submits (no "envíado" sin más)
- [ ] [manual] Texto leído por hablante nativo del idioma (sin tipos, calcos)

## 10. Cross-browser

- [ ] Chrome/Edge (Chromium 111+) ✓
- [ ] Safari 16.4+ ✓
- [ ] Firefox 109+ ✓
- [ ] iOS Safari (mobile) ✓
- [ ] Chrome Android ✓
- [ ] [manual] Probado en al menos un dispositivo real (no solo DevTools)

## 11. Antes de deploy

- [ ] Build local exitoso (`npm run build`)
- [ ] Variables de entorno de producción listas en Vercel
- [ ] Dominio configurado en Vercel (si aplica)
- [ ] DNS apuntando a Vercel (si aplica)
- [ ] Resend dominio verificado para emails (si aplica)
- [ ] Stripe webhook URL configurada (si aplica)
- [ ] Supabase URL + ANON_KEY de producción (no de dev)

## 12. Post-deploy

- [ ] URL de producción carga 200 ✓
- [ ] `/sitemap.xml` accesible
- [ ] `/robots.txt` accesible
- [ ] OG image carga correctamente al compartir en WhatsApp/LinkedIn
- [ ] Formularios funcionan en producción (probar con email real)
- [ ] Lighthouse en producción ≥ 90 en las 4 categorías
- [ ] Google Search Console: enviar sitemap
- [ ] [manual] Cliente recibe acceso (URL + credenciales si tiene panel admin)

---

## Auto-fix de fallos

Si un check falla durante `verify-build.mjs --full`, el script intenta auto-fix solo cuando es seguro:

| Check fallido | Auto-fix |
|---|---|
| Imagen sin `alt` | NO — escalar al usuario, requiere texto descriptivo real |
| Falta `priority` | NO — requiere decidir cuál es above-the-fold |
| Color hardcoded | SÍ — reemplazar por token correspondiente |
| `<img>` cruda | SÍ — convertir a `<Image>` |
| Sin `sizes` | SÍ — añadir default `(max-width: 768px) 100vw, 50vw` |
| Heading order roto | NO — escalar, requiere repensar estructura |
| Falta `lang` | SÍ — añadir según `site-config.ts` |
| `tsc` errors | NO — escalar, son lógica del código |

---

## Aprobación final

Solo levantar `npm run dev` cuando **todos los checks no-manuales** pasan. Si quedan items `[manual]`, listarlos al usuario con: "Antes de publicar, queda revisar manualmente: [...]".
