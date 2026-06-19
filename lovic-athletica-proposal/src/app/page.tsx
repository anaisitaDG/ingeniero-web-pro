import { Reveal } from "@/components/Reveal";
import {
  Zap,
  Users,
  LineChart,
  ClipboardList,
  Dumbbell,
  Salad,
  Scale,
  BellRing,
  Star,
  ArrowRight,
  CheckCircle2,
  XCircle,
} from "lucide-react";

const PROBLEMS = [
  { bad: "Formulario de Google Drive", good: "Enlace único con perfil automático" },
  { bad: "Plan en PDF por WhatsApp", good: "Plan en su perfil, siempre visible" },
  { bad: "Seguimiento por mensajes", good: "Dashboard de progreso en tiempo real" },
  { bad: "Sin imagen de marca", good: "Plataforma con tu nombre y colores" },
  { bad: "No puedes escalar", good: "30 clientes sin más caos" },
];

const TRAINER_FEATURES = [
  { icon: Users, title: "Gestión de clientes", desc: "Alta, perfiles y semáforo de actividad. Verde, amarillo, rojo de un vistazo." },
  { icon: ClipboardList, title: "Creación de planes", desc: "Diseña rutinas y dietas directamente en el perfil de cada cliente." },
  { icon: Scale, title: "Bioimpedancia", desc: "Sube capturas de báscula y documentos de análisis corporal." },
  { icon: BellRing, title: "Alertas automáticas", desc: "Notificación cuando un cliente lleva 3+ días sin entrenar." },
  { icon: LineChart, title: "Métricas del negocio", desc: "Altas del mes, retención y porcentaje de cumplimiento de planes." },
  { icon: Star, title: "Notas privadas", desc: "Anota observaciones sobre el cliente que solo tú puedes ver." },
];

const CLIENT_FEATURES = [
  { icon: Dumbbell, title: "Mi rutina de hoy", desc: "El cliente ve exactamente qué toca, con series, reps y descanso." },
  { icon: LineChart, title: "Registro de cargas", desc: "Anota el peso usado cada semana por ejercicio. El progreso queda guardado." },
  { icon: Salad, title: "Plan nutricional", desc: "Macros, calorías y comidas sugeridas siempre accesibles." },
  { icon: Scale, title: "Mi evolución", desc: "Gráfica de peso corporal semana a semana. El progreso visible motiva." },
  { icon: ClipboardList, title: "Mis medidas", desc: "Registro de medidas corporales y fotos de progreso." },
  { icon: CheckCircle2, title: "Mis objetivos", desc: "El cliente sabe exactamente qué está persiguiendo y por qué." },
];

const FLOW_STEPS = [
  { step: "01", title: "Alta del cliente", desc: "Tú creas al cliente desde tu panel. El sistema genera y envía automáticamente el enlace de valoración." },
  { step: "02", title: "Valoración inicial", desc: "El cliente rellena el formulario: hábitos, alergias, objetivos, disponibilidad. En segundos, se crea su perfil." },
  { step: "03", title: "Notificaciones", desc: "Ambos reciben email de confirmación. Tú ves la alerta: perfil listo para crear el plan." },
  { step: "04", title: "Tú creas el plan", desc: "Accedes al perfil, cargas rutina semanal, dieta y documentos de análisis corporal." },
  { step: "05", title: "El cliente entrena", desc: "Registra cargas, marca ejercicios, sube fotos, anota su peso. Todo en un lugar." },
  { step: "06", title: "Tú haces seguimiento", desc: "Ves el progreso real de cada cliente en tiempo real, sin preguntar por WhatsApp." },
];

const PHASES = [
  {
    num: "Fase 1",
    title: "MVP — Producto listo para usar",
    weeks: "6–8 semanas",
    items: [
      "Registro y login (entrenador + cliente)",
      "Enlace único de valoración",
      "Perfil del cliente con todas las pestañas",
      "Carga de plan de entrenamiento y nutrición",
      "Registro de peso y cargas por ejercicio",
      "Emails automáticos de confirmación",
    ],
  },
  {
    num: "Fase 2",
    title: "Crecimiento",
    weeks: "+ 4–6 semanas",
    items: [
      "Gráficas de progreso interactivas",
      "Chat interno entrenador ↔ cliente",
      "Biblioteca de ejercicios reutilizable",
      "Plantillas de rutinas para asignar en 2 clics",
      "Check-in semanal automatizado",
      "Alertas de inactividad",
    ],
  },
];

export default function Home() {
  return (
    <main style={{ background: "var(--color-bg)", color: "var(--color-text)", fontFamily: "var(--font-body)" }}>

      {/* NAVBAR */}
      <nav style={{ borderBottom: "1px solid var(--color-border)" }} className="sticky top-0 z-50 backdrop-blur-md">
        <div style={{ background: "rgba(10,10,10,0.85)" }} className="absolute inset-0" />
        <div className="relative max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <span style={{ fontFamily: "var(--font-display)", color: "var(--color-accent)", fontSize: "1.4rem", fontWeight: 600, letterSpacing: "0.05em" }}>
            LOVIC ATHLETICA GYM
          </span>
          <a
            href="#contacto"
            style={{ background: "var(--color-accent)", color: "#0a0a0a", fontWeight: 600, fontSize: "0.85rem", letterSpacing: "0.08em" }}
            className="px-5 py-2 rounded-sm uppercase tracking-widest transition-opacity hover:opacity-80"
          >
            Hablemos
          </a>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(201,168,76,0.12) 0%, transparent 70%)" }} />
        <div className="absolute inset-0" style={{ backgroundImage: "linear-gradient(rgba(201,168,76,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(201,168,76,0.03) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />
        <div className="relative max-w-5xl mx-auto px-6 text-center py-32">
          <Reveal>
            <p style={{ color: "var(--color-accent)", fontFamily: "var(--font-body)", fontSize: "0.8rem", letterSpacing: "0.25em", fontWeight: 600 }} className="uppercase mb-6">
              Propuesta de plataforma digital
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(2.8rem, 7vw, 5.5rem)", fontWeight: 300, lineHeight: 1.05, color: "var(--color-white)" }}>
              Tu negocio de entrenamiento,{" "}
              <em style={{ color: "var(--color-accent)", fontStyle: "italic" }}>automatizado.</em>
            </h1>
          </Reveal>
          <Reveal delay={0.2}>
            <p style={{ color: "var(--color-muted)", fontSize: "1.15rem", maxWidth: "600px", lineHeight: 1.7 }} className="mx-auto mt-6 mb-10">
              Deja de gestionar clientes por WhatsApp y Google Drive. Una plataforma con tu nombre, tus colores y tu marca — donde cada cliente tiene su perfil, su plan y su progreso.
            </p>
          </Reveal>
          <Reveal delay={0.3}>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="#como-funciona"
                style={{ background: "var(--color-accent)", color: "#0a0a0a", fontWeight: 700, fontSize: "0.9rem", letterSpacing: "0.1em" }}
                className="px-8 py-4 rounded-sm uppercase tracking-widest inline-flex items-center gap-2 transition-opacity hover:opacity-85"
              >
                Ver cómo funciona <ArrowRight size={16} />
              </a>
              <a
                href="#contacto"
                style={{ border: "1px solid var(--color-accent)", color: "var(--color-accent)", fontWeight: 600, fontSize: "0.9rem", letterSpacing: "0.08em" }}
                className="px-8 py-4 rounded-sm uppercase tracking-widest transition-all hover:bg-[var(--color-accent)] hover:text-black"
              >
                Hablemos
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      {/* EL PROBLEMA */}
      <section className="py-28 px-6" style={{ background: "var(--color-bg-2)" }}>
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <p style={{ color: "var(--color-accent)", fontSize: "0.78rem", letterSpacing: "0.25em", fontWeight: 600 }} className="uppercase mb-4 text-center">El problema</p>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(2rem, 4.5vw, 3.2rem)", fontWeight: 400, textAlign: "center", color: "var(--color-white)", marginBottom: "3.5rem" }}>
              Herramientas de oficina no son herramientas de negocio
            </h2>
          </Reveal>
          <div className="grid gap-4">
            {PROBLEMS.map(({ bad, good }, i) => (
              <Reveal key={i} delay={i * 0.07}>
                <div style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: "4px" }} className="grid grid-cols-1 md:grid-cols-2 overflow-hidden">
                  <div className="flex items-center gap-3 px-6 py-4" style={{ borderBottom: "1px solid var(--color-border)" }}>
                    <XCircle size={18} style={{ color: "#ef4444", flexShrink: 0 }} />
                    <span style={{ color: "var(--color-muted)", fontSize: "0.95rem" }}>{bad}</span>
                  </div>
                  <div className="flex items-center gap-3 px-6 py-4" style={{ borderLeft: "1px solid var(--color-border)" }}>
                    <CheckCircle2 size={18} style={{ color: "var(--color-accent)", flexShrink: 0 }} />
                    <span style={{ fontSize: "0.95rem", color: "var(--color-text)" }}>{good}</span>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* CÓMO FUNCIONA */}
      <section id="como-funciona" className="py-28 px-6">
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <p style={{ color: "var(--color-accent)", fontSize: "0.78rem", letterSpacing: "0.25em", fontWeight: 600 }} className="uppercase mb-4 text-center">El flujo completo</p>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(2rem, 4.5vw, 3.2rem)", fontWeight: 400, textAlign: "center", color: "var(--color-white)", marginBottom: "3.5rem" }}>
              Cómo funciona tu plataforma
            </h2>
          </Reveal>
          <div className="grid md:grid-cols-2 gap-6">
            {FLOW_STEPS.map(({ step, title, desc }, i) => (
              <Reveal key={i} delay={i * 0.08}>
                <div style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: "4px", padding: "2rem" }} className="h-full">
                  <div style={{ fontFamily: "var(--font-display)", color: "var(--color-accent-muted)", fontSize: "3rem", fontWeight: 300, lineHeight: 1, marginBottom: "1rem" }}>{step}</div>
                  <h3 style={{ color: "var(--color-accent)", fontSize: "1rem", fontWeight: 600, letterSpacing: "0.05em", marginBottom: "0.6rem", textTransform: "uppercase" }}>{title}</h3>
                  <p style={{ color: "var(--color-muted)", fontSize: "0.95rem", lineHeight: 1.65 }}>{desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* FUNCIONALIDADES — ENTRENADOR */}
      <section className="py-28 px-6" style={{ background: "var(--color-bg-2)" }}>
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <p style={{ color: "var(--color-accent)", fontSize: "0.78rem", letterSpacing: "0.25em", fontWeight: 600 }} className="uppercase mb-4 text-center">Panel del entrenador</p>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(2rem, 4.5vw, 3.2rem)", fontWeight: 400, textAlign: "center", color: "var(--color-white)", marginBottom: "1rem" }}>
              Tu centro de control
            </h2>
            <p style={{ color: "var(--color-muted)", textAlign: "center", fontSize: "1rem", marginBottom: "3.5rem" }}>
              Todo lo que necesitas para gestionar tu negocio en un solo lugar.
            </p>
          </Reveal>
          <div className="grid md:grid-cols-3 gap-5">
            {TRAINER_FEATURES.map(({ icon: Icon, title, desc }, i) => (
              <Reveal key={i} delay={i * 0.07}>
                <div style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: "4px", padding: "1.75rem" }} className="h-full">
                  <div style={{ width: "44px", height: "44px", background: "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.25)", borderRadius: "4px", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "1.1rem" }}>
                    <Icon size={20} style={{ color: "var(--color-accent)" }} />
                  </div>
                  <h3 style={{ color: "var(--color-text)", fontWeight: 600, fontSize: "0.95rem", marginBottom: "0.5rem" }}>{title}</h3>
                  <p style={{ color: "var(--color-muted)", fontSize: "0.88rem", lineHeight: 1.65 }}>{desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* FUNCIONALIDADES — CLIENTE */}
      <section className="py-28 px-6">
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <p style={{ color: "var(--color-accent)", fontSize: "0.78rem", letterSpacing: "0.25em", fontWeight: 600 }} className="uppercase mb-4 text-center">Panel del cliente</p>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(2rem, 4.5vw, 3.2rem)", fontWeight: 400, textAlign: "center", color: "var(--color-white)", marginBottom: "1rem" }}>
              Lo que ve tu cliente
            </h2>
            <p style={{ color: "var(--color-muted)", textAlign: "center", fontSize: "1rem", marginBottom: "3.5rem" }}>
              Una experiencia que ningún entrenador del gimnasio puede ofrecer.
            </p>
          </Reveal>
          <div className="grid md:grid-cols-3 gap-5">
            {CLIENT_FEATURES.map(({ icon: Icon, title, desc }, i) => (
              <Reveal key={i} delay={i * 0.07}>
                <div style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: "4px", padding: "1.75rem" }} className="h-full">
                  <div style={{ width: "44px", height: "44px", background: "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.25)", borderRadius: "4px", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "1.1rem" }}>
                    <Icon size={20} style={{ color: "var(--color-accent)" }} />
                  </div>
                  <h3 style={{ color: "var(--color-text)", fontWeight: 600, fontSize: "0.95rem", marginBottom: "0.5rem" }}>{title}</h3>
                  <p style={{ color: "var(--color-muted)", fontSize: "0.88rem", lineHeight: 1.65 }}>{desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* FASES */}
      <section className="py-28 px-6" style={{ background: "var(--color-bg-2)" }}>
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <p style={{ color: "var(--color-accent)", fontSize: "0.78rem", letterSpacing: "0.25em", fontWeight: 600 }} className="uppercase mb-4 text-center">Plan de trabajo</p>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(2rem, 4.5vw, 3.2rem)", fontWeight: 400, textAlign: "center", color: "var(--color-white)", marginBottom: "3.5rem" }}>
              Lo que construimos juntos
            </h2>
          </Reveal>
          <div className="grid md:grid-cols-2 gap-8">
            {PHASES.map(({ num, title, weeks, items }, i) => (
              <Reveal key={i} delay={i * 0.1}>
                <div style={{ background: "var(--color-card)", border: i === 0 ? "1px solid var(--color-accent)" : "1px solid var(--color-border)", borderRadius: "4px", padding: "2rem", position: "relative", overflow: "hidden" }}>
                  {i === 0 && (
                    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "3px", background: "linear-gradient(90deg, var(--color-accent), var(--color-accent-muted))" }} />
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem" }}>
                    <div>
                      <span style={{ color: "var(--color-accent)", fontSize: "0.78rem", fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase" }}>{num}</span>
                      <h3 style={{ color: "var(--color-white)", fontFamily: "var(--font-display)", fontSize: "1.4rem", fontWeight: 400, marginTop: "0.3rem" }}>{title}</h3>
                    </div>
                    <span style={{ background: "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.3)", color: "var(--color-accent)", fontSize: "0.78rem", padding: "0.3rem 0.75rem", borderRadius: "2px", fontWeight: 500, whiteSpace: "nowrap" }}>
                      {weeks}
                    </span>
                  </div>
                  <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                    {items.map((item, j) => (
                      <li key={j} style={{ display: "flex", alignItems: "flex-start", gap: "0.6rem" }}>
                        <CheckCircle2 size={15} style={{ color: "var(--color-accent)", flexShrink: 0, marginTop: "0.15rem" }} />
                        <span style={{ color: "var(--color-muted)", fontSize: "0.9rem", lineHeight: 1.5 }}>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* NÚMEROS */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8 text-center">
            {[
              { value: "60–70%", label: "Reducción en tiempo de gestión" },
              { value: "3×", label: "Más clientes sin más caos" },
              { value: "100%", label: "Imagen profesional desde el día 1" },
            ].map(({ value, label }, i) => (
              <Reveal key={i} delay={i * 0.1}>
                <div>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: "clamp(2.5rem, 5vw, 4rem)", fontWeight: 300, color: "var(--color-accent)", lineHeight: 1 }}>{value}</div>
                  <p style={{ color: "var(--color-muted)", fontSize: "0.9rem", marginTop: "0.75rem", maxWidth: "200px" }} className="mx-auto">{label}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section id="contacto" className="py-28 px-6" style={{ background: "var(--color-bg-2)", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 60% 80% at 50% 100%, rgba(201,168,76,0.08) 0%, transparent 70%)" }} />
        <div className="relative max-w-3xl mx-auto text-center">
          <Reveal>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", background: "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.3)", borderRadius: "2px", padding: "0.4rem 1rem", marginBottom: "2rem" }}>
              <Zap size={14} style={{ color: "var(--color-accent)" }} />
              <span style={{ color: "var(--color-accent)", fontSize: "0.78rem", fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase" }}>Primer paso sin compromiso</span>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(2.2rem, 5vw, 3.8rem)", fontWeight: 300, color: "var(--color-white)", lineHeight: 1.1, marginBottom: "1.25rem" }}>
              ¿Listo para tener una plataforma que trabaje por ti?
            </h2>
          </Reveal>
          <Reveal delay={0.2}>
            <p style={{ color: "var(--color-muted)", fontSize: "1.05rem", lineHeight: 1.7, marginBottom: "2.5rem" }}>
              Hablamos sin compromiso. Te explico el proceso, los tiempos y resuelvo todas tus dudas antes de arrancar.
            </p>
          </Reveal>
          <Reveal delay={0.3}>
            <a
              href="mailto:hola@anaismoralesmkt.com"
              style={{ background: "var(--color-accent)", color: "#0a0a0a", fontWeight: 700, fontSize: "1rem", letterSpacing: "0.08em", display: "inline-flex", alignItems: "center", gap: "0.6rem", padding: "1rem 2.5rem", borderRadius: "2px", textDecoration: "none" }}
              className="transition-opacity hover:opacity-85"
            >
              Quiero mi plataforma <ArrowRight size={18} />
            </a>
          </Reveal>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop: "1px solid var(--color-border)", padding: "1.75rem 1.5rem" }}>
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <span style={{ fontFamily: "var(--font-display)", color: "var(--color-accent)", fontSize: "1.1rem", fontWeight: 500, letterSpacing: "0.08em" }}>
            LOVIC ATHLETICA GYM
          </span>
          <p style={{ color: "var(--color-muted)", fontSize: "0.82rem" }}>
            Propuesta de plataforma digital · {new Date().getFullYear()}
          </p>
        </div>
      </footer>

    </main>
  );
}
