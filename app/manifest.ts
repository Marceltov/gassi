import type { MetadataRoute } from "next";

// "Add to Home Screen": Gassi opens full screen, in the colours of the day theme (the dark ones come from the
// layout's theme-color, which follows prefers-color-scheme).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Gassi",
    short_name: "Gassi",
    description: "Das Hundetagebuch für den Haushalt",
    lang: "de",
    start_url: "/",
    display: "standalone",
    background_color: "#e8ece3",
    theme_color: "#e8ece3",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
