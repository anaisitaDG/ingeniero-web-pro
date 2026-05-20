import { Reveal, RevealText } from "@/components/Reveal";

const lines = [
  "Más publicaciones no arreglan una mala estrategia.",
  "Más anuncios no arreglan una oferta floja.",
  "Más trabajo no arregla el caos.",
];

export function Problema() {
  return (
    <section className="section" style={{ borderTop: "1px solid #111" }}>
      <Reveal>
        <h2
          className="font-black tracking-tight leading-none mb-16"
          style={{ fontSize: "clamp(40px, 7vw, 96px)" }}
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
                color: "#444",
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
          style={{ fontSize: "clamp(20px, 2.8vw, 38px)", color: "#fff" }}
        >
          Lo que falta no suele ser esfuerzo.
          <br />
          <span style={{ color: "#7DC9CA" }}>Suele ser claridad.</span>
        </p>
      </Reveal>
    </section>
  );
}
