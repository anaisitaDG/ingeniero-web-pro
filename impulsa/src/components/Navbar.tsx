"use client";
import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { siteConfig } from "@/lib/site-config";

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      style={{
        background:  scrolled ? "rgba(0,0,0,0.92)" : "transparent",
        backdropFilter: scrolled ? "blur(12px)" : "none",
        borderBottom: scrolled ? "1px solid #111" : "1px solid transparent",
      }}
    >
      <div className="flex items-center justify-between px-[clamp(24px,6vw,80px)] py-5">
        <Logo size="sm" />
        <a
          href={siteConfig.contact.whatsapp}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-semibold tracking-widest uppercase px-5 py-2.5 border border-white/20 hover:border-white/60 hover:bg-white hover:text-black transition-all duration-200"
        >
          {siteConfig.cta.primary}
        </a>
      </div>
    </header>
  );
}
