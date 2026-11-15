import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  root: "web",
  publicDir: false,
  build: { outDir: "../dist/web", emptyOutDir: true },
  server: { port: 5173, proxy: { "/api": { target: "http://127.0.0.1:4317", changeOrigin: false } } },
  test: { root: ".", include: ["tests/**/*.test.ts"], environment: "node" },
} as never);
