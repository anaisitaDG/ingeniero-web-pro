import { Reveal } from "@/components/Reveal";

const pasos = [
  {
    titulo: "Pensamos",
    texto:  "Definimos el camino correcto.",
    num:    "01",
  },
  {
    titulo: "Ejecutamos",
    texto:  "Lo convertimos en realidad.",
    num:    "02",
  },
  {
    titulo: "Escalamos",
    texto:  "Mejoramos lo que funciona.",
    num:    "03",
  },
];

export function Solucion() {
  return (
    <section className="section" style={{ borderTop: "1px solid #111" }}>
      <Reveal>
        <p
          className="font-light tracking-tight max-w-2xl mb-20"
          style={{ fontSize: "clamp(20px, 2.5vw, 34px)", color: "#fff" }}
        >
          Convertimos marketing desordenado en un sistema de crecimiento{" "}
          <span style={{ color: "#E8522B" }}>claro, medible y rentable.</span>
        </p>
      </Reveal>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-px" style={{ background: "#111" }}>
        {pasos.map((paso, i) => (
          <Reveal key={paso.num} delay={i * 0.1}>
            <div className="p-10 flex flex-col gap-6" style={{ background: "#000" }}>
              <span
                className="font-black tracking-tight leading-none"
                style={{ fontSize: "clamp(48px, 7vw, 80px)", color: "#111" }}
                aria-hidden
              >
                {paso.num}
              </span>
              <div>
                <h3
                  className="font-bold tracking-tight mb-2"
                  style={{ fontSize: "clamp(20px, 2vw, 28px)", color: "#fff" }}
                >
                  {paso.titulo}
                </h3>
                <p
                  className="font-light"
                  style={{ fontSize: "clamp(14px, 1.2vw, 17px)", color: "#555" }}
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
