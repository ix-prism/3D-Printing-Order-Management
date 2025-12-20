import { defineConfig } from "vite";

export default defineConfig({
  clearScreen: false,
  base: "./",
  server: {
    strictPort: true,
    port: 5180
  }
});
