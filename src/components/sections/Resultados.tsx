"use client";
import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "motion/react";
import { Reveal } from "@/components/Reveal";

const metricas = [
  { valor: "+214%", etiqueta: "ventas",             acento: "#E8522B" },
  { valor: "+97",   etiqueta: "leads / mes",         acento: "#7DC9CA" },
  { valor: "−42%",  etiqueta: "coste por adquisición", acento: "#E8522B" },
  { valor: "×3",    etiqueta: "notoriedad de marca", acento: "#7DC9CA" },
];

function MetricaCard({
  valor,
  etiqueta,
  acento,
  delay,
}: (typeof metricas)[0] & { delay: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col gap-2 p-8"
      style={{ borderRight: "1px solid #111" }}
    >
      <span
        className="font-black tracking-tight leading-none"
        style={{ fontSize: "clamp(48px, 8vw, 96px)", color: acento }}
      >
        {valor}
      </span>
      <span
        className="font-light uppercase tracking-widest"
        style={{ fontSize: "clamp(11px, 1vw, 14px)", color: "#555" }}
      >
        {etiqueta}
      </span>
    </motion.div>
  );
}

export function Resultados() {
  return (
    <section
      id="resultados"
      className="section"
      style={{ borderTop: "1px solid #111" }}
    >
      <Reveal>
        <h2
          className="font-black tracking-tight leading-none mb-16"
          style={{ fontSize: "clamp(36px, 6vw, 80px)" }}
        >
          El marketing se mide
          <br />
          <span style={{ color: "#444" }}>en negocio.</span>
        </h2>
      </Reveal>

      <div
        className="grid grid-cols-2 lg:grid-cols-4"
        style={{ borderTop: "1px solid #111", borderLeft: "1px solid #111" }}
      >
        {metricas.map((m, i) => (
          <MetricaCard key={m.etiqueta} {...m} delay={i * 0.1} />
        ))}
      </div>
    </section>
  );
}
