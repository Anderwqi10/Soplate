import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: "jsdom",
    setupFiles: "src/test/setup.ts",
    globals: true,
    // Fechas probadas en la zona de los usuarios: así el test detecta desfases de un día por UTC.
    env: { TZ: "America/Bogota" },
  },
});
