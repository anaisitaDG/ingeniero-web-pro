import { Reveal } from "@/components/Reveal";

export function Nosotros() {
  return (
    <section className="section" style={{ borderTop: "1px solid #111" }}>
      <div className="max-w-3xl">
        <Reveal>
          <h2
            className="font-black tracking-tight leading-tight mb-12"
            style={{ fontSize: "clamp(36px, 6vw, 80px)" }}
          >
            No somos para
            <br />
            <span style={{ color: "#444" }}>todo el mundo.</span>
          </h2>
        </Reveal>

        <Reveal delay={0.1}>
          <p
            className="font-light leading-relaxed mb-6"
            style={{ fontSize: "clamp(15px, 1.5vw, 20px)", color: "#555" }}
          >
            Si buscas humo, promesas vacías o "viralidad" sin negocio, no somos la opción.
          </p>
        </Reveal>

        <Reveal delay={0.2}>
          <p
            className="font-semibold leading-relaxed"
            style={{ fontSize: "clamp(15px, 1.5vw, 20px)", color: "#fff" }}
          >
            Si buscas criterio, ejecución y crecimiento serio,{" "}
            <span style={{ color: "#E8522B" }}>te damos el SÍ QUIERO.</span>
          </p>
        </Reveal>
      </div>
    </section>
  );
}
