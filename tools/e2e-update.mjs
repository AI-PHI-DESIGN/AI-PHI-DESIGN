// Prueba de actualización: con la app ya "instalada" (service worker activo y caché llena),
// se publica una versión nueva en el servidor y se comprueba que el móvil la ve al reabrirla.
// Uso: node tools/e2e-update.mjs [dirSalida]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, extname } from 'node:path';
const OUT = process.argv[2] || '.'; mkdirSync(OUT, { recursive: true });
const root = process.cwd();
const types = { '.html': 'text/html', '.js': 'text/javascript', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml' };

let marca = 'VERSION-VIEJA';   // texto que distingue lo que sirve el servidor en cada momento
const srv = createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
  const f = join(root, p); if (!existsSync(f)) { res.writeHead(404); return res.end(); }
  let body = readFileSync(f);
  if (p === '/index.html') body = Buffer.from(body.toString('utf8').replace('Visitas de Obra · v1.2', 'Visitas de Obra · ' + marca));
  res.writeHead(200, { 'content-type': types[extname(f)] || 'application/octet-stream', 'cache-control': 'no-cache' });
  res.end(body);
});
await new Promise(r => srv.listen(0, r)); const port = srv.address().port;
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, locale: 'es-ES', isMobile: true, hasTouch: true });
const page = await ctx.newPage();
page.on('pageerror', e => { console.error('PAGE ERROR', e); process.exitCode = 1; });

// 1) Primera visita: se instala el service worker y se llena la caché
await page.goto(`http://127.0.0.1:${port}/`);
await page.waitForSelector('text=Mis obras');
await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 15000 });
const verVieja = await page.evaluate(() => { document.querySelector('[data-go="menu"]').click(); return document.querySelector('.drawer .ver').textContent; });
if (!verVieja.includes('VERSION-VIEJA')) throw new Error('la primera carga no es la esperada: ' + verVieja);
await page.click('.backdrop');

// 2) Se publica una versión nueva en el servidor y se vuelve a abrir la app
marca = 'VERSION-NUEVA';
await page.reload();
await page.waitForSelector('text=Mis obras');
await page.waitForFunction(() => {
  const b = document.querySelector('[data-go="menu"]'); if (!b) return false;
  if (!document.querySelector('.drawer')) b.click();
  const v = document.querySelector('.drawer .ver');
  return v && v.textContent.includes('VERSION-NUEVA');
}, null, { timeout: 20000 });
await page.screenshot({ path: join(OUT, 'update-ok.png') });
console.log('UPDATE OK: al reabrir con cobertura se sirve la versión publicada, no la guardada');

// 3) Y sin cobertura sigue arrancando con la copia guardada
await ctx.setOffline(true);
await page.reload();
await page.waitForSelector('text=Mis obras', { timeout: 20000 });
console.log('OFFLINE OK: sin cobertura sigue arrancando con la copia guardada');
await browser.close(); srv.close();
