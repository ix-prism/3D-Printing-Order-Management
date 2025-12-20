import fs from "node:fs/promises";
import path from "node:path";
import pngToIco from "png-to-ico";

const root = path.resolve(import.meta.dirname, "..");
const iconsDir = path.join(root, "build", "icons");
const outPath = path.join(root, "build", "icon.ico");

const sizes = [16, 24, 32, 48, 64, 128, 256];
const pngBuffers = await Promise.all(
  sizes.map((size) => fs.readFile(path.join(iconsDir, `icon-${size}.png`)))
);

const icoBuffer = await pngToIco(pngBuffers);
await fs.writeFile(outPath, icoBuffer);
