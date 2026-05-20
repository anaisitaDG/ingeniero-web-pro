import { Reveal } from "@/components/Reveal";
import {
  TrendingUp,
  Palette,
  Share2,
  BarChart2,
  Zap,
  Globe,
} from "lucide-react";

const servicios = [
  { icon: TrendingUp, nombre: "Growth Strategy",              desc: "Estrategia de crecimiento con foco en negocio." },
  { icon: Palette,    nombre: "Branding que posiciona",       desc: "Identidad que diferencia y atrae al cliente correcto." },
  { icon: Share2,     nombre: "Redes con intención comercial",desc: "Contenido que convierte, no solo que gusta." },
  { icon: BarChart2,  nombre: "Paid Media rentable",          desc: "Anuncios que generan retorno, no solo clics." },
  { icon: Zap,        nombre: "Automatización comercial",     desc: "Sistemas que trabajan cuando tú no estás." },
  { icon: Globe,      nombre: "Webs que convierten",          desc: "Presencia digital que cierra ventas." },
];

export function Servicios() {
  return (
    <section className="section" style={{ background: "#ffffff", borderTop: "1px solid #e5e5e5" }}>
      <Reveal>
        <h2
          className="font-black tracking-tight leading-none mb-16"
          style={{ fontSize: "clamp(36px, 6vw, 80px)", color: "#000" }}
        >
          Lo que hacemos
          <br />
          <span style={{ color: "#bbb" }}>cuando entramos.</span>
        </h2>
      </Reveal>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px" style={{ background: "#e5e5e5" }}>
        {servicios.map((s, i) => {
          const Icon = s.icon;
          return (
            <Reveal key={s.nombre} delay={i * 0.06}>
              <div
                className="p-8 flex flex-col gap-4 group hover:bg-[#f8f8f8] transition-colors duration-200"
                style={{ background: "#ffffff" }}
              >
                <Icon
                  size={20}
                  className="transition-colors duration-200"
                  style={{ color: "#bbb" }}
                  aria-hidden
                />
                <div>
                  <h3
                    className="font-bold mb-2 group-hover:text-black transition-colors duration-200"
                    style={{ fontSize: "clamp(15px, 1.4vw, 19px)", color: "#000" }}
                  >
                    {s.nombre}
                  </h3>
                  <p
                    className="font-light leading-relaxed"
                    style={{ fontSize: "clamp(13px, 1vw, 15px)", color: "#888" }}
                  >
                    {s.desc}
                  </p>
                </div>
              </div>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
