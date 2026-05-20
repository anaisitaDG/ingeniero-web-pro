"use client";
import { motion } from "motion/react";
import { Logo } from "@/components/Logo";
import { siteConfig } from "@/lib/site-config";

export function Hero() {
  return (
    <section
      className="relative flex flex-col items-center justify-center min-h-svh text-center px-6"
      style={{ background: "#000" }}
      aria-label="Hero"
    >
      {/* Logo central */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="w-full flex justify-center"
      >
        <Logo size="hero" />
      </motion.div>

      {/* Botones */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col sm:flex-row items-center gap-4 mt-14"
      >
        <a
          href={siteConfig.contact.whatsapp}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block bg-white text-black font-bold text-sm tracking-wider uppercase px-8 py-4 hover:bg-[var(--color-accent)] hover:text-white transition-all duration-200"
        >
          {siteConfig.cta.primary} →
        </a>
        <a
          href="#resultados"
          className="text-sm font-medium tracking-wider uppercase underline underline-offset-4 text-white/40 hover:text-white transition-colors duration-200"
        >
          {siteConfig.cta.secondary}
        </a>
      </motion.div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.8 }}
        className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
        aria-hidden
      >
        <div className="w-px h-12 bg-gradient-to-b from-white/0 to-white/20" />
      </motion.div>
    </section>
  );
}
