// proxy.ts — Next.js 16+ (sustituye al middleware.ts deprecado)
// Ubicar en: src/proxy.ts (raíz de src/)
//
// Si NO necesitas redirects, auth gate o headers globales,
// puedes omitir este archivo por completo.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const response = NextResponse.next();

  // Headers de seguridad globales (recomendado)
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains"
  );

  // Ejemplo: redirect /home → /
  if (request.nextUrl.pathname === "/home") {
    return NextResponse.redirect(new URL("/", request.url), 308);
  }

  // Ejemplo: auth gate (descomentar si aplica)
  // const token = request.cookies.get("session")?.value;
  // if (request.nextUrl.pathname.startsWith("/dashboard") && !token) {
  //   return NextResponse.redirect(new URL("/login", request.url));
  // }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
