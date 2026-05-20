import { Reveal } from "@/components/Reveal";

export function Status() {
  return (
    <section className="section" style={{ borderTop: "1px solid #111" }}>
      <Reveal>
        <p
          className="font-light leading-tight tracking-tight max-w-3xl"
          style={{ fontSize: "clamp(24px, 3.5vw, 48px)", color: "#fff" }}
        >
          No buscamos clientes para facturar más.
          <br />
          <span style={{ color: "#3a3a3a" }}>
            Buscamos marcas con potencial para crecer mejor.
          </span>
        </p>
      </Reveal>
    </section>
  );
}
