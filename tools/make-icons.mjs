// Genera icons/icon-192.png e icons/icon-512.png sin dependencias (PNG RGBA + zlib de Node).
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
const crcT = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = b => { let c = ~0; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return ~c >>> 0; };
const chunk = (t, d) => { const len = Buffer.alloc(4); len.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
function png(size, paint) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) { raw[y * (size * 4 + 1)] = 0; for (let x = 0; x < size; x++) { const [r, g, b, a] = paint(x + .5, y + .5, size); const o = y * (size * 4 + 1) + 1 + x * 4; raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = a; } }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
// Icono: cuadrado azul marino con esquinas redondeadas, arco celeste y una "V" blanca.
const NAVY = [18, 59, 99], SKY = [143, 188, 230], WHITE = [255, 255, 255];
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
function paint(x, y, s) {
  const r = s * .22, u = x / s, v = y / s;
  const cx = Math.min(Math.max(x, r), s - r), cy = Math.min(Math.max(y, r), s - r);
  const dCorner = Math.hypot(x - cx, y - cy) - r; if (dCorner > .5) return [0, 0, 0, 0];
  let col = NAVY;
  // arco: anillo centrado en (0.5, 0.62), radio 0.30, grosor 0.06, sólo mitad superior
  const ar = Math.hypot(u - .5, v - .62), aw = Math.abs(ar - .30);
  if (v < .62 && aw < .035) col = mix(col, SKY, Math.min(1, (.035 - aw) / .012));
  // "V": dos trazos desde (0.32,0.5) y (0.68,0.5) hasta (0.5,0.78)
  const seg = (ax, ay, bx, by) => { const t = Math.max(0, Math.min(1, ((u - ax) * (bx - ax) + (v - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2))); return Math.hypot(u - (ax + t * (bx - ax)), v - (ay + t * (by - ay))); };
  const dv = Math.min(seg(.33, .50, .5, .78), seg(.67, .50, .5, .78));
  if (dv < .045) col = mix(col, WHITE, Math.min(1, (.045 - dv) / .012));
  const alpha = Math.round(255 * Math.min(1, .5 - dCorner));
  return [...col, alpha];
}
for (const s of [192, 512]) writeFileSync(`icons/icon-${s}.png`, png(s, paint));
console.log('icons ok');
