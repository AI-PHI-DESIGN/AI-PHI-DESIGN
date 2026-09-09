# Comprobación estructural de un PDF generado por la app: xref, objetos, páginas e imágenes.
import re, sys
b = open(sys.argv[1], 'rb').read()
assert b.startswith(b'%PDF-1.4'), 'cabecera'
sx = int(re.search(rb'startxref\s+(\d+)\s+%%EOF', b).group(1))
assert b[sx:sx+4] == b'xref', 'startxref no apunta a xref'
m = re.match(rb'xref\s+0 (\d+)\s+', b[sx:]); n = int(m.group(1)); pos = sx + m.end()
bad = 0
for i in range(n):
    ent = b[pos:pos+20]; pos += 20
    off, gen, typ = int(ent[:10]), int(ent[11:16]), ent[17:18]
    if typ == b'n' and not b[off:].startswith(f'{i} 0 obj'.encode()): bad += 1; print('objeto', i, 'offset incorrecto', off, b[off:off+20])
size = int(re.search(rb'/Size (\d+)', b[sx:]).group(1))
pages = len(re.findall(rb'/Type /Page\b', b)); imgs = len(re.findall(rb'/Subtype /Image', b)); fonts = len(re.findall(rb'/Type /Font', b))
# comprobar Length de cada stream
for mm in re.finditer(rb'/Length (\d+) >>\nstream\n', b):
    L = int(mm.group(1)); end = mm.end() + L
    assert b[end:end+10] == b'\nendstream', f'Length incorrecto en offset {mm.start()}'
print(f'OK: {n-1} objetos (Size {size}), {pages} páginas, {imgs} imágenes, {fonts} fuentes, xref errores={bad}')
sys.exit(1 if bad else 0)
