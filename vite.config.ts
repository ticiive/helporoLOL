import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Tauri espera uma porta fixa no dev
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: { port: 1420, strictPort: true },
  // No Windows o app roda no WebView2 (Chromium)
  build: { target: "es2021", outDir: "dist" },
});
