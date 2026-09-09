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
// Icono: cuadrado azul con degradado, casco de obra ámbar con visera y un check blanco.
const NAVY = [15, 61, 110], BLUE = [30, 111, 217], AMBER = [245, 166, 35], BRIM = [217, 123, 11], WHITE = [255, 255, 255];
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const seg = (u, v, ax, ay, bx, by) => { const t = Math.max(0, Math.min(1, ((u - ax) * (bx - ax) + (v - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2))); return Math.hypot(u - (ax + t * (bx - ax)), v - (ay + t * (by - ay))); };
function paint(x, y, s) {
  const r = s * .22, u = x / s, v = y / s;
  const cx = Math.min(Math.max(x, r), s - r), cy = Math.min(Math.max(y, r), s - r);
  const dCorner = Math.hypot(x - cx, y - cy) - r; if (dCorner > .5) return [0, 0, 0, 0];
  let col = mix(NAVY, BLUE, (u + v) / 2);
  const aa = d => Math.min(1, Math.max(0, d / .008));
  // cúpula del casco: semicírculo centro (0.5,0.60) radio 0.30, sólo por encima
  const dd = .30 - Math.hypot(u - .5, v - .60); if (v <= .60 && dd > -.008) col = mix(col, AMBER, aa(dd + .008));
  // visera: rectángulo redondeado y=0.585..0.665, x=0.13..0.87
  const bx = Math.max(.13 + .04 - u, u - (.87 - .04), 0), by = Math.max(.585 + .04 - v, v - (.665 - .04), 0); const db = .04 - Math.hypot(bx, by);
  if (db > -.008) col = mix(col, BRIM, aa(db + .008));
  // check blanco sobre la cúpula
  const dv = Math.min(seg(u, v, .37, .42, .47, .52), seg(u, v, .47, .52, .64, .33));
  if (dv < .05) col = mix(col, WHITE, aa(.05 - dv));
  const alpha = Math.round(255 * Math.min(1, .5 - dCorner));
  return [...col, alpha];
}
for (const s of [192, 512]) writeFileSync(`icons/icon-${s}.png`, png(s, paint));
console.log('icons ok');
