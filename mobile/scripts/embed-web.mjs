import { mkdir, readFile, writeFile } from "node:fs/promises";

const dist = new URL("../../frontend/dist/", import.meta.url);
const output = new URL("../.local/", import.meta.url);
let html = await readFile(new URL("index.html", dist), "utf8");
const script = html.match(/<script type="module"[^>]* src="\/?(assets\/[^"]+\.js)"[^>]*><\/script>/);
const stylesheet = html.match(/<link rel="stylesheet"[^>]* href="\/?(assets\/[^"]+\.css)"[^>]*>/);
if (!script || !stylesheet) throw new Error("The built web application must have one JS entry and one stylesheet.");

const [js, css] = await Promise.all([
  readFile(new URL(script[1], dist), "utf8"),
  readFile(new URL(stylesheet[1], dist), "utf8"),
]);
html = html.replace(script[0], "")
  .replace(stylesheet[0], () => `<style>${css.replace(/@import\s*(?:url\([^)]*\)|"[^"]*"|'[^']*')\s*;/g, "").replace(/<\/style/gi, "<\\/style")}</style>`)
  .replace(/<link rel="icon"[^>]*>/, "")
  .replace("</body>", () => `<script type="module">${js.replace(/<\/script/gi, "<\\/script")}</script></body>`);

await mkdir(output, { recursive: true });
await writeFile(new URL("embeddedWeb.js", output), `export default ${JSON.stringify(html)};\n`);
