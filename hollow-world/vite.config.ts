import { resolve } from "node:path";
import { defineConfig } from "vite";

// Two pages: the Strata city sim (index.html) and Echo (echo.html). `npm run build` emits dist/index.html and dist/echo.html.
export default defineConfig({
  build: {
    rollupOptions: {
      input: { main: resolve(import.meta.dirname, "index.html"), echo: resolve(import.meta.dirname, "echo.html") },
    },
  },
});
