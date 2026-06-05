import { copyFile, cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const frontendRoot = resolve(__dirname, "..");
const repoRoot = resolve(frontendRoot, "..");
const distDir = join(frontendRoot, "dist");
const distIndexPath = join(distDir, "index.html");
const stakeFrontDir = join(repoRoot, "upload", "frontend");

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
const versionManifest = {
  version: 1,
  changed: false,
};

await writeFile(distIndexPath, inlinedHtml, "utf8");
await writeFile(join(distDir, "version.json"), JSON.stringify(versionManifest, null, 2) + "\n", "utf8");

// The JS is now inlined into index.html. Vite resolves image assets via
// `new URL("<file>.png", import.meta.url)`, which is now relative to the HTML
// document — i.e. the PNGs must sit NEXT TO index.html, not in an assets/
// subfolder. So: keep the images, move them up to the dist root beside the
// HTML, and drop the now-redundant JS chunk(s).
const assetsDir = join(distDir, "assets");
const assetFiles = await readdir(assetsDir).catch(() => []);
const imageFiles = [];
for (const file of assetFiles) {
  if (file.endsWith(".js") || file.endsWith(".js.map")) continue;
  await copyFile(join(assetsDir, file), join(distDir, file));
  imageFiles.push(file);
}
await rm(assetsDir, { recursive: true, force: true });

await mkdir(stakeFrontDir, { recursive: true });
await copyFile(distIndexPath, join(stakeFrontDir, "index.html"));
await copyFile(join(distDir, "version.json"), join(stakeFrontDir, "version.json"));

// Ship the image assets beside the HTML in the upload bundle too.
for (const file of imageFiles) {
  await copyFile(join(distDir, file), join(stakeFrontDir, file));
}
