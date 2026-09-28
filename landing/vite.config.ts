/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// The page is served by GitHub Pages from /docs on main, next to guia.html and mapa.html,
// so the build writes into ../docs without wiping it and keeps its bundles in one folder.
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  build: {
    outDir: "../docs",
    emptyOutDir: false,
    assetsDir: "portada",
    target: "es2020",
    chunkSizeWarningLimit: 1600,
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
