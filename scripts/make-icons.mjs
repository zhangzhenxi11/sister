/**
 * 生成 PWA/App 图标（零依赖：Node 内置 zlib 手写 PNG 编码）
 * 用法：node scripts/make-icons.mjs
 * 产出：public/icons/icon-512.png、icon-192.png、apple-touch-icon.png(180)
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'icons');
mkdirSync(outDir, { recursive: true });

/* ---------- CRC32 ---------- */
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/* ---------- PNG 编码 ---------- */
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ---------- 绘制：粉紫渐变 + 白色爱心 ---------- */
// 爱心隐函数：(x²+y²-1)³ - x²·y³ < 0（坐标归一化，y 向上）
function heartCoverage(x, y) {
  const a = x * x + y * y - 1;
  const v = a * a * a - x * x * y * y * y;
  // 近似抗锯齿：按隐函数值在边界 ±0.08 内渐变
  const aa = 0.08;
  if (v < -aa) return 1;
  if (v > aa) return 0;
  return (aa - v) / (2 * aa);
}

function render(size) {
  const px = Buffer.alloc(size * size * 4);
  const c1 = [236, 72, 153];   // #ec4899 粉
  const c2 = [147, 51, 234];   // #9333ea 紫
  const ss = 4;                // 每像素 4x4 采样抗锯齿
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let cover = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const nx = ((x + (sx + 0.5) / ss) / size) * 2 - 1;
          const ny = 1 - ((y + (sy + 0.5) / ss) / size) * 2; // y 翻转
          cover += heartCoverage(nx / 0.46, (ny + 0.08) / 0.46);
        }
      }
      cover /= ss * ss;
      const t = (x + y) / (2 * size); // 对角渐变
      const r = Math.round(c1[0] + (c2[0] - c1[0]) * t);
      const g = Math.round(c1[1] + (c2[1] - c1[1]) * t);
      const b = Math.round(c1[2] + (c2[2] - c1[2]) * t);
      const i = (y * size + x) * 4;
      px[i] = Math.round(r + (255 - r) * cover);
      px[i + 1] = Math.round(g + (255 - g) * cover);
      px[i + 2] = Math.round(b + (255 - b) * cover);
      px[i + 3] = 255;
    }
  }
  return px;
}

const targets = [
  ['icon-512.png', 512],
  ['icon-192.png', 192],
  ['apple-touch-icon.png', 180],
];
for (const [name, size] of targets) {
  writeFileSync(join(outDir, name), encodePng(size, size, render(size)));
  console.log('generated', name, size + 'x' + size);
}
