import type { Metadata } from "next";
import { Cormorant_Garamond, Outfit } from "next/font/google";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Lovic Athletica Gym — Tu plataforma digital de entrenamiento",
  description:
    "Propuesta de plataforma personalizada para gestión de clientes, planes de entrenamiento y nutrición. Automatiza tu negocio y ofrece una experiencia premium.",
  openGraph: {
    title: "Lovic Athletica Gym — Tu plataforma digital",
    description: "De Google Drive a tu propia plataforma profesional.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`${cormorant.variable} ${outfit.variable}`}>
      <body>{children}</body>
    </html>
  );
}
