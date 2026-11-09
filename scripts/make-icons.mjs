import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(root, "assets/icons");
const sizes = [16, 32, 48, 128];

function hex(value) {
  return {
    r: Number.parseInt(value.slice(1, 3), 16),
    g: Number.parseInt(value.slice(3, 5), 16),
    b: Number.parseInt(value.slice(5, 7), 16),
    a: 255,
  };
}

const BLUE = hex("#004f9e");
const DARK = hex("#003b76");
const WHITE = hex("#ffffff");
const ORANGE = hex("#f59e0b");
const TRANSPARENT = { r: 0, g: 0, b: 0, a: 0 };

function setPixel(png, x, y, color) {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) return;
  const index = (png.width * y + x) << 2;
  png.data[index] = color.r;
  png.data[index + 1] = color.g;
  png.data[index + 2] = color.b;
  png.data[index + 3] = color.a;
}

function fillRect(png, x, y, width, height, color) {
  for (let py = Math.round(y); py < Math.round(y + height); py += 1) {
    for (let px = Math.round(x); px < Math.round(x + width); px += 1) {
      setPixel(png, px, py, color);
    }
  }
}

function roundedRect(png, x, y, width, height, radius, color) {
  for (let py = Math.floor(y); py < Math.ceil(y + height); py += 1) {
    for (let px = Math.floor(x); px < Math.ceil(x + width); px += 1) {
      const nearestX = Math.min(Math.max(px + 0.5, x + radius), x + width - radius);
      const nearestY = Math.min(Math.max(py + 0.5, y + radius), y + height - radius);
      const dx = px + 0.5 - nearestX;
      const dy = py + 0.5 - nearestY;
      if (dx * dx + dy * dy <= radius * radius) setPixel(png, px, py, color);
    }
  }
}

function drawIcon(size) {
  const png = new PNG({ width: size, height: size });
  for (let index = 0; index < png.data.length; index += 4) {
    setPixel(png, (index >> 2) % size, Math.floor((index >> 2) / size), TRANSPARENT);
  }

  const unit = size / 16;
  roundedRect(png, 0, 0, size, size, Math.max(2, 2.5 * unit), BLUE);
  roundedRect(png, 2 * unit, 3.2 * unit, 12 * unit, 11 * unit, 1.4 * unit, WHITE);
  roundedRect(png, 2 * unit, 3.2 * unit, 12 * unit, 3 * unit, 1.2 * unit, DARK);

  fillRect(png, 4.6 * unit, 1.3 * unit, 1.3 * unit, 3.2 * unit, WHITE);
  fillRect(png, 10.1 * unit, 1.3 * unit, 1.3 * unit, 3.2 * unit, WHITE);

  const cell = 1.7 * unit;
  const left = 3.6 * unit;
  const top = 7.6 * unit;
  const colours = [DARK, DARK, DARK, DARK, DARK, ORANGE, DARK, DARK, DARK];
  for (let row = 0; row < 3; row += 1) {
    for (let column = 0; column < 3; column += 1) {
      const colour = colours[row * 3 + column] ?? DARK;
      fillRect(png, left + column * 2.2 * unit, top + row * 2.2 * unit, cell, cell, colour);
    }
  }

  return PNG.sync.write(png);
}

await mkdir(outputDir, { recursive: true });
for (const size of sizes) {
  await writeFile(path.join(outputDir, `icon-${size}.png`), drawIcon(size));
}
console.log(`Wrote ${sizes.length} icons to assets/icons.`);
