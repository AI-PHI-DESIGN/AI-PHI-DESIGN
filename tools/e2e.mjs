// Prueba de extremo a extremo: crea obra, visita, bloques y exporta PDF/DOCX.
// Uso: node tools/e2e.mjs <dirSalida>   (requiere playwright global y chromium en /opt/pw-browsers)
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
const OUT = process.argv[2] || '.';
const root = process.cwd();
const types = { '.html': 'text/html', '.js': 'text/javascript', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg' };
const srv = createServer((req, res) => { let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html'; const f = join(root, p); if (!existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': types[extname(f)] || 'application/octet-stream' }); res.end(readFileSync(f)); });
await new Promise(r => srv.listen(0, r)); const port = srv.address().port;
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, locale: 'es-ES', acceptDownloads: true, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
page.on('pageerror', e => { console.error('PAGE ERROR', e); process.exitCode = 1; });
page.on('console', m => { if (m.type() === 'error') console.error('CONSOLE', m.text()); });
await page.goto(`http://127.0.0.1:${port}/`);
await page.waitForSelector('text=Mis obras');
await page.screenshot({ path: join(OUT, '01-home-vacio.png') });
// Nueva obra
await page.click('text=Nueva obra');
await page.fill('#f-nombre', 'San Jacinto 22 B');
await page.fill('#f-dir', 'Calle San Jacinto 22, Sevilla');
await page.fill('#f-tipo', 'Apartahotel');
await page.click('.chip:has-text("Dir. Ejecución de Obra")');
const agents = page.locator('.agent');
const fillAgent = async (i, n, t, e) => { const a = agents.nth(i); await a.locator('[data-af="nombre"]').fill(n); await a.locator('[data-af="telefono"]').fill(t); await a.locator('[data-af="email"]').fill(e); };
await fillAgent(0, 'Alerce Promociones S.L.', '954 123 456', 'info@alerce.es');
await fillAgent(1, 'Construcciones 2MS', '600 111 222', 'obras@2ms.es');
await fillAgent(2, 'Francisco J. López, arquitecto', '600 333 444', 'fjlopez@estudio.es');
await fillAgent(3, 'PREMEA Aparejadores', '600 555 666', 'premea@premea.es');
await page.click('.chip:has-text("Otros")');
const last = page.locator('.agent').last();
await last.locator('[data-af="rol"]').fill('Instalador eléctrico');
await last.locator('[data-af="nombre"]').fill('Electricidad Vila');
await last.locator('[data-af="telefono"]').fill('600 777 888');
await page.screenshot({ path: join(OUT, '02-obra-form.png'), fullPage: true });
await page.click('button:has-text("Guardar")');
await page.waitForSelector('text=Visitas de obra');
await page.screenshot({ path: join(OUT, '03-obra.png') });
// Nueva visita
await page.click('text=Nueva visita');
await page.waitForSelector('text=Organiza tu visita');
await page.screenshot({ path: join(OUT, '04-visita-vacia.png') });
await page.click('[data-act="addTexto"]');
await page.locator('.bloque textarea').last().fill('Se comprueba el forjado de planta primera. Las viguetas están correctamente apoyadas y el encofrado se retirará el jueves.\nSe recuerda al constructor que debe presentar el plan de seguridad actualizado antes de iniciar la fase de cerramientos.');
await page.click('[data-act="addFoto"]');
await page.click('[data-act="fotoGal"]');
const fotos = process.argv.slice(3);
await page.setInputFiles('#file-gal', fotos);
await page.waitForFunction(n => document.querySelectorAll('.bloque img').length >= n, fotos.length);
const cms = page.locator('.bloque [data-bf="comentario"]');
await cms.nth(0).fill('Forjado de planta primera, encofrado a la espera de desmontaje.');
await cms.nth(1).fill('Pilares de fábrica de ladrillo en patio interior.');
await page.click('[data-act="addTexto"]');
await page.locator('.bloque textarea').last().fill('Próxima visita prevista para la semana que viene, tras el desencofrado.');
await page.waitForTimeout(800);
await page.screenshot({ path: join(OUT, '05-visita-bloques.png'), fullPage: true });
// Exportar: interceptamos deliver() para guardar los blobs
await page.evaluate(() => { window.__files = {}; window.deliver = async (blob, name) => { const b = await blob.arrayBuffer(); window.__files[name] = Array.from(new Uint8Array(b)); }; });
await page.click('[data-act="export"]');
await page.screenshot({ path: join(OUT, '06-export-sheet.png') });
await page.click('[data-act="expPdf"]');
await page.waitForFunction(() => Object.keys(window.__files).some(k => k.endsWith('.pdf')));
await page.click('[data-act="export"]'); await page.click('[data-act="expDocx"]');
await page.waitForFunction(() => Object.keys(window.__files).some(k => k.endsWith('.docx')));
await page.click('[data-act="export"]'); await page.click('[data-act="docTipo"][data-v="informe"]'); await page.waitForTimeout(200); await page.click('[data-act="expPdf"]');
await page.waitForFunction(() => Object.keys(window.__files).filter(k => k.endsWith('.pdf')).length >= 2);
await page.click('[data-act="export"]'); await page.click('[data-act="expDocx"]');
await page.waitForFunction(() => Object.keys(window.__files).filter(k => k.endsWith('.docx')).length >= 2);
const files = await page.evaluate(() => window.__files);
for (const [name, bytes] of Object.entries(files)) { writeFileSync(join(OUT, name), Buffer.from(bytes)); console.log('exportado', name, bytes.length, 'bytes'); }
// Persistencia: recargar y comprobar que la obra y la visita siguen ahí
await page.reload(); await page.waitForSelector('text=San Jacinto 22 B');
await page.click('text=San Jacinto 22 B'); await page.waitForSelector('text=Visita 1');
await page.screenshot({ path: join(OUT, '07-obra-con-visita.png') });
await page.click('[data-go="back"]'); await page.waitForSelector('text=Mis obras'); await page.click('[data-go="menu"]'); await page.waitForTimeout(300); await page.screenshot({ path: join(OUT, '08-menu.png') });
await browser.close(); srv.close();
console.log('E2E OK');
