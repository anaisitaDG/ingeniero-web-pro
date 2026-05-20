import { Reveal, RevealText } from "@/components/Reveal";

const lines = [
  "Más publicaciones no arreglan una mala estrategia.",
  "Más anuncios no arreglan una oferta floja.",
  "Más trabajo no arregla el caos.",
];

export function Problema() {
  return (
    <section className="section" style={{ background: "#f5f5f3", borderTop: "1px solid #e5e5e5" }}>
      <Reveal>
        <h2
          className="font-black tracking-tight leading-none mb-16"
          style={{ fontSize: "clamp(40px, 7vw, 96px)", color: "#000" }}
        >
          La mayoría no necesita más acciones.
          <br />
          Necesita alguien que{" "}
          <span style={{ color: "#E8522B" }}>IMPULSA.</span>
        </h2>
      </Reveal>

      <div className="flex flex-col gap-4 mb-16 max-w-2xl">
        {lines.map((line, i) => (
          <RevealText key={line} delay={i * 0.08}>
            <p
              className="font-light tracking-tight"
              style={{
                fontSize: "clamp(16px, 1.8vw, 22px)",
                color: "#777",
              }}
            >
              {line}
            </p>
          </RevealText>
        ))}
      </div>

      <Reveal delay={0.3}>
        <p
          className="font-semibold tracking-tight"
          style={{ fontSize: "clamp(20px, 2.8vw, 38px)", color: "#000" }}
        >
          Lo que falta no suele ser esfuerzo.
          <br />
          <span style={{ color: "#E8522B" }}>Suele ser claridad.</span>
        </p>
      </Reveal>
    </section>
  );
}
