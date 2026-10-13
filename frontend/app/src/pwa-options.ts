import type { VitePWAOptions } from "vite-plugin-pwa";

export const pwaOptions: Partial<VitePWAOptions> = {
  registerType: "autoUpdate",
  includeAssets: ["soplate.svg", "favicon.ico", "apple-touch-icon-180x180.png"],
  manifest: {
    name: "Soplate",
    short_name: "Soplate",
    lang: "es-CO",
    display: "standalone",
    start_url: "/",
    theme_color: "#0f2742",
    background_color: "#0f2742",
    icons: [
      { src: "pwa-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "pwa-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "maskable-icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  },
  workbox: {
    navigateFallback: "/index.html",
    // La API, el admin y los estáticos de Django nunca se sirven desde el cascarón de la app.
    navigateFallbackDenylist: [/^\/api\//, /^\/admin\//, /^\/static\//],
    globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
  },
};
