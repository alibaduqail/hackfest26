// Build the portable review copy with the same engine and source as the editable page.
import { build } from "vite";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const { output } = await build({
  root,
  configFile: false,
  logLevel: "warn",
  build: {
    write: false,
    assetsInlineLimit: Infinity,
    modulePreload: false,
    rollupOptions: { input: resolve(root, "cutaway.html") },
  },
});
const script = output.find((file) => file.type === "chunk" && file.isEntry).code;
const css = output.find((file) => file.fileName.endsWith(".css")).source;
const html = output.find((file) => file.fileName === "cutaway.html").source
  .replace(
    /<script type="module"[^>]*src="[^"]*"[^>]*><\/script>/,
    () => '<script type="module">' + script.replace(/<\/script/gi, "<\\/script") + "</script>",
  )
  .replace(/<link rel="stylesheet"[^>]*>/, () => "<style>" + css + "</style>")
  .replace('href="./index.html"', 'href="https://hollow-world-eight.vercel.app/"');
const folder = resolve(root, "../cutaway-mockup");
await mkdir(folder, { recursive: true });
await writeFile(resolve(folder, "index.html"), html);
