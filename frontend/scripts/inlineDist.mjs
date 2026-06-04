import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const frontendRoot = resolve(__dirname, "..");
const repoRoot = resolve(frontendRoot, "..");
const distDir = join(frontendRoot, "dist");
const distIndexPath = join(distDir, "index.html");
const stakeFrontDir = join(repoRoot, "stake-front");

const indexHtml = await readFile(distIndexPath, "utf8");
const scriptStart = indexHtml.indexOf('<script type="module" crossorigin src="./assets/');
const scriptEnd = scriptStart === -1 ? -1 : indexHtml.indexOf("</script>", scriptStart) + "</script>".length;

if (scriptStart === -1 || scriptEnd === -1) {
  throw new Error("Could not find Vite module script in dist/index.html");
}

const scriptTag = indexHtml.slice(scriptStart, scriptEnd);
const srcStart = scriptTag.indexOf('src="./assets/') + 'src="./assets/'.length;
const srcEnd = scriptTag.indexOf('"', srcStart);
const scriptFile = scriptTag.slice(srcStart, srcEnd);
const scriptPath = join(distDir, "assets", scriptFile);
const scriptBody = await readFile(scriptPath, "utf8");
const inlinedHtml = indexHtml.replace(
  scriptTag,
  `<script type="module">\n${scriptBody}\n</script>`,
);

await writeFile(distIndexPath, inlinedHtml, "utf8");
await rm(join(distDir, "assets"), { recursive: true, force: true });
await mkdir(stakeFrontDir, { recursive: true });
await copyFile(distIndexPath, join(stakeFrontDir, "index.html"));
