import { Navbar }     from "@/components/Navbar";
import { Hero }       from "@/components/sections/Hero";
import { Status }     from "@/components/sections/Status";
import { Problema }   from "@/components/sections/Problema";
import { Solucion }   from "@/components/sections/Solucion";
import { Servicios }  from "@/components/sections/Servicios";
import { Metodo }     from "@/components/sections/Metodo";
import { Resultados } from "@/components/sections/Resultados";
import { Nosotros }   from "@/components/sections/Nosotros";
import { CtaFinal }   from "@/components/sections/CtaFinal";
import { Footer }     from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <Status />
        <Problema />
        <Solucion />
        <Servicios />
        <Metodo />
        <Resultados />
        <Nosotros />
        <CtaFinal />
      </main>
      <Footer />
    </>
  );
}
