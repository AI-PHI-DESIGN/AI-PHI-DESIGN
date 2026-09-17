// Prueba sin conexión: carga la app, registra el service worker, crea una obra, corta la red
// (contexto offline + servidor apagado), recarga y comprueba que arranca y conserva los datos.
// Uso: node tools/e2e-offline.mjs <dirSalida>   (requiere playwright y chromium en /opt/pw-browsers)
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
const root = process.cwd();
const types = { '.html':'text/html', '.js':'text/javascript', '.webmanifest':'application/manifest+json', '.png':'image/png', '.svg':'image/svg+xml' };
const srv = createServer((req,res)=>{ let p=decodeURIComponent(req.url.split('?')[0]); if(p==='/')p='/index.html'; const f=join(root,p); if(!existsSync(f)){res.writeHead(404);return res.end();} res.writeHead(200,{'content-type':types[extname(f)]||'application/octet-stream'}); res.end(readFileSync(f)); });
await new Promise(r=>srv.listen(0,r)); const port=srv.address().port;
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await browser.newContext({ viewport:{width:412,height:915}, isMobile:true, hasTouch:true, locale:'es-ES' });
const page = await ctx.newPage();
page.on('pageerror', e => { console.error('PAGE ERROR', e); process.exitCode = 1; });
await page.goto(`http://127.0.0.1:${port}/`);
await page.waitForSelector('text=Mis obras');
await page.waitForFunction(() => navigator.serviceWorker.controller !== null || navigator.serviceWorker.ready.then(()=>true), null, { timeout: 15000 }).catch(()=>{});
await page.evaluate(() => navigator.serviceWorker.ready);
// crear una obra para comprobar persistencia offline
await page.click('text=Nueva obra'); await page.fill('#f-nombre','Obra sin cobertura'); await page.click('[data-act="saveObra"]');
await page.waitForSelector('text=Obra sin cobertura');
await page.waitForTimeout(1500);
// cortar la red del todo: se apaga el servidor y se pone el contexto offline
await ctx.setOffline(true);
await new Promise(r => srv.close(r));
await page.reload({ waitUntil: 'load' });
await page.waitForSelector('text=Mis obras', { timeout: 15000 });
await page.waitForSelector('text=Obra sin cobertura', { timeout: 15000 });
console.log('OFFLINE OK: la app arranca y conserva los datos sin conexión');
// menú → instalar
await page.click('[data-go="menu"]'); await page.click('[data-act="instalar"]');
await page.waitForSelector('.sheet h3');
console.log('Hoja instalar:', await page.locator('.sheet h3').textContent());
await page.screenshot({ path: process.argv[2] + '/offline-instalar.png' });
await browser.close();
