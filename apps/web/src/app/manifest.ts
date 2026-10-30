import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "VerasJuris",
    short_name: "VerasJuris",
    description: "Organizar trabalho jurídico com controle humano.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#06295B",
    lang: "pt-BR",
    orientation: "any",
    icons: [
      {
        src: "/brand/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/brand/icon.svg",
        sizes: "192x192",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
