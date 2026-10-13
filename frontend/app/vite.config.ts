import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { defineConfig } from "vitest/config";
import { pwaOptions } from "./src/pwa-options";

export default defineConfig({
  plugins: [react(), tailwindcss(), VitePWA(pwaOptions)],
  test: {
    environment: "jsdom",
    setupFiles: "src/test/setup.ts",
    globals: true,
    // Fechas probadas en la zona de los usuarios: así el test detecta desfases de un día por UTC.
    env: { TZ: "America/Bogota" },
  },
});
