// Generates the placeholder icons in icons/ with no dependencies:
// a blue rounded square with a white document and an orange "extension" tag.
// Run with: npm run icons

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { crc32 } from './crc32.js';

const OUT_DIR = fileURLToPath(new URL('../icons/', import.meta.url));
const SIZES = [16, 48, 128];
const SAMPLES = 4;

const BLUE = [31, 95, 191];
const WHITE = [255, 255, 255];
const FOLD = [200, 214, 235];
const ORANGE = [245, 158, 11];

function inRoundedRect(x, y, x0, y0, x1, y1, r) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = Math.min(Math.max(x, x0 + r), x1 - r);
  const cy = Math.min(Math.max(y, y0 + r), y1 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

// Colour at a point in unit coordinates, or null for transparent.
function shade(x, y) {
  if (!inRoundedRect(x, y, 0.03, 0.03, 0.97, 0.97, 0.2)) return null;

  const [dx0, dy0, dx1, dy1, fold] = [0.27, 0.16, 0.73, 0.84, 0.14];
  const inDoc = x >= dx0 && x <= dx1 && y >= dy0 && y <= dy1 && !(x > dx1 - fold && y < dy0 + fold && (x - (dx1 - fold)) > (y - dy0));
  if (inDoc) {
    if (x > dx1 - fold && y < dy0 + fold) return FOLD;
    if (y >= 0.58 && y <= 0.74 && x >= 0.2 && x <= 0.8) return ORANGE;
    return WHITE;
  }
  if (y >= 0.58 && y <= 0.74 && x >= 0.2 && x <= 0.8) return ORANGE;
  return BLUE;
}

function render(size) {
  const rgba = Buffer.alloc(size * size * 4);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          const c = shade((px + (sx + 0.5) / SAMPLES) / size, (py + (sy + 0.5) / SAMPLES) / size);
          if (c) { r += c[0]; g += c[1]; b += c[2]; a++; }
        }
      }
      const i = (py * size + px) * 4;
      if (a) {
        rgba[i] = Math.round(r / a);
        rgba[i + 1] = Math.round(g / a);
        rgba[i + 2] = Math.round(b / a);
      }
      rgba[i + 3] = Math.round((a / (SAMPLES * SAMPLES)) * 255);
    }
  }
  return rgba;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(size, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync(OUT_DIR, { recursive: true });
for (const size of SIZES) {
  const file = new URL(`../icons/icon${size}.png`, import.meta.url);
  writeFileSync(file, encodePng(size, render(size)));
  console.log(`wrote icons/icon${size}.png`);
}
