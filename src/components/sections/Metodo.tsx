import { Reveal } from "@/components/Reveal";

const pasos = [
  {
    num:   "01",
    titulo: "Diagnóstico brutalmente honesto",
    texto:  "Qué falla y qué potencial hay.",
  },
  {
    num:   "02",
    titulo: "Estrategia rentable",
    texto:  "Qué hacer primero y qué ignorar.",
  },
  {
    num:   "03",
    titulo: "Activación precisa",
    texto:  "Campañas, contenido y sistema.",
  },
  {
    num:   "04",
    titulo: "Escalado inteligente",
    texto:  "Datos, optimización y crecimiento.",
  },
];

export function Metodo() {
  return (
    <section className="section" style={{ background: "#f5f5f3", borderTop: "1px solid #e5e5e5" }}>
      <Reveal>
        <h2
          className="font-black tracking-tight leading-none mb-20"
          style={{ fontSize: "clamp(36px, 6vw, 80px)", color: "#000" }}
        >
          Método{" "}
          <span style={{ color: "#E8522B" }}>Alquimia™</span>
        </h2>
      </Reveal>

      <div className="flex flex-col" style={{ borderTop: "1px solid #e5e5e5" }}>
        {pasos.map((paso, i) => (
          <Reveal key={paso.num} delay={i * 0.08}>
            <div
              className="flex items-start gap-8 py-8 group"
              style={{ borderBottom: "1px solid #e5e5e5" }}
            >
              <span
                className="font-black tracking-tighter shrink-0 w-16 group-hover:text-black transition-colors duration-300"
                style={{
                  fontSize: "clamp(32px, 4vw, 56px)",
                  color: "#ddd",
                  lineHeight: 1,
                }}
                aria-hidden
              >
                {paso.num}
              </span>
              <div className="flex flex-col sm:flex-row sm:items-baseline gap-2 sm:gap-8 pt-1">
                <h3
                  className="font-bold tracking-tight shrink-0"
                  style={{ fontSize: "clamp(16px, 1.6vw, 22px)", color: "#000" }}
                >
                  {paso.titulo}
                </h3>
                <p
                  className="font-light"
                  style={{ fontSize: "clamp(14px, 1.2vw, 17px)", color: "#777" }}
                >
                  {paso.texto}
                </p>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
