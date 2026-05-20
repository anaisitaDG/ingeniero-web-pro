import { Reveal } from "@/components/Reveal";

export function Status() {
  return (
    <section className="section" style={{ background: "#ffffff", borderTop: "1px solid #e5e5e5" }}>
      <Reveal>
        <p
          className="font-light leading-tight tracking-tight max-w-3xl"
          style={{ fontSize: "clamp(24px, 3.5vw, 48px)", color: "#000" }}
        >
          No buscamos clientes para facturar más.
          <br />
          <span style={{ color: "#bbb" }}>
            Buscamos marcas con potencial para crecer mejor.
          </span>
        </p>
      </Reveal>
    </section>
  );
}
