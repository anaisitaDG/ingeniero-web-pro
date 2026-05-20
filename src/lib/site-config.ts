export const siteConfig = {
  name:        "IMPULSA",
  tagline:     "Alquimistas del Marketing",
  description: "Convertimos marketing desordenado en un sistema de crecimiento claro, medible y rentable.",
  url:         "https://impulsaagencia.com",
  locale:      "es",
  vertical:    "agencia-marketing",

  contact: {
    // TODO: reemplaza con el número de WhatsApp real de IMPULSA
    whatsapp: "https://wa.me/34600000000?text=Hola%2C%20quiero%20solicitar%20un%20diagn%C3%B3stico",
    email:    "hola@impulsaagencia.com",
  },

  cta: {
    primary:   "Solicitar diagnóstico",
    secondary: "Ver resultados",
    final:     "Hablar con IMPULSA",
  },

  social: {
    instagram: "",
    linkedin:  "",
  },

  og: {
    image: "/og-image.jpg",
    width:  1200,
    height: 630,
  },
} as const;
