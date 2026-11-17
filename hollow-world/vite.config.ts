import { resolve } from "node:path";
import { defineConfig } from "vite";

// Landing page is Echo Tower Down (index.html, same page as echo.html); the Strata city sim lives at strata.html.
// `npm run build` emits dist/index.html, dist/echo.html and dist/strata.html.
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, "index.html"),
        echo: resolve(import.meta.dirname, "echo.html"),
        strata: resolve(import.meta.dirname, "strata.html"),
      },
    },
  },
});
