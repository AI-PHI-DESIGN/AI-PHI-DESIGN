# Visitas de Obra

Aplicación web para registrar visitas de obra, inspirada en la app **ACTA** pero en **tonos azules**.
Funciona en el móvil (Android e iPhone) y en el ordenador, sin instalar nada y sin conexión una vez cargada.

## Qué hace

- **Obras**: nombre, dirección, tipo, estado (Activa / Cerrada) y **agentes** con nombre y contacto (teléfono y correo):
  Promotor, Constructor, Dirección Facultativa, Dir. Ejecución de Obra, Coord. Seguridad y Salud y **Otros** (rol libre, tantos como se quiera).
- **Visitas**: dentro de cada obra, botón **Nueva visita**. Cada visita se organiza por bloques:
  - **Texto** (notas).
  - **Foto** (cámara o galería, varias a la vez) con **comentario** debajo de cada una.
  - **Voz**: dictado con el micrófono, el texto aparece escrito en un bloque.
  - Los bloques se pueden reordenar y borrar. Todo se guarda automáticamente.
- **Emitir documento** (icono PDF en la visita): se elige el tipo y el formato.
  - Tipo **Acta de visita** (azul, con bloque de firmas de los agentes y texto legal) o **Informe de situación de obra** (verde).
  - Formato **PDF** o **Word (.docx)** editable. Ambos llevan el encabezado con el **logotipo**, datos de la empresa, título, **fecha**, obra y dirección; tabla de datos de obra; tabla de agentes con contacto; textos y fotos (en rejilla de dos columnas) con sus comentarios; pie con paginación.
- **Mi perfil** (menú ☰): logotipo, empresa, nombre y contacto que van en el encabezado de los documentos.
- **Copia de seguridad / Restaurar** (menú ☰): exporta e importa todos los datos en un archivo `.json`.
  Los datos viven en el propio dispositivo (IndexedDB), no en ningún servidor.

## Cómo usarla

### Opción A · enlace de claude.ai (inmediata)
La app está publicada como Artifact de claude.ai (enlace en la conversación). Ábrelo en el móvil y úsalo directamente.
Nota: dentro del artefacto el dictado por voz puede no tener permiso de micrófono; en ese caso añade un bloque de texto
y usa el micrófono del **teclado** del móvil, que dicta igual.

### Opción B · GitHub Pages (recomendada, instalable como app)
1. En GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `main` (o la rama que contenga `index.html`) / root → Save**.
2. Al minuto, la app queda en `https://<usuario>.github.io/<repositorio>/`.
3. En el móvil, abre la URL y elige **Añadir a pantalla de inicio** (Chrome: menú ⋮ → *Instalar aplicación*; Safari: Compartir → *Añadir a pantalla de inicio*). Desde entonces abre como una app, con icono propio y funciona sin conexión.

### Opción C · archivo local
Copiar `index.html` al móvil y abrirlo con Chrome también funciona (sin instalación ni modo sin conexión).

## Desarrollo

No hay dependencias ni build: toda la app es `index.html` (HTML + CSS + JS).

```
index.html             La aplicación completa
manifest.webmanifest   Manifest PWA (nombre, icono, color)
sw.js                  Service worker: caché para uso sin conexión
icons/                 Iconos (icon.svg, icon-192.png, icon-512.png)
tools/make-icons.mjs   Genera los PNG de los iconos (node tools/make-icons.mjs)
tools/make-artifact.py Genera dist/artifact.html para publicar como Artifact de claude.ai
tools/e2e.mjs          Prueba de extremo a extremo con Playwright (crea obra, visita, fotos, exporta PDF y DOCX)
tools/check-pdf.py     Comprobación estructural de un PDF generado
docs/COMO-SE-HIZO.md   Receta completa de cómo se construyó, para repetirlo igual
```

Probar en local:

```bash
npx http-server -p 8080 .        # y abrir http://localhost:8080
node tools/e2e.mjs /tmp/salida foto1.jpg foto2.jpg   # prueba automática (requiere playwright)
python3 tools/check-pdf.py "/tmp/salida/Acta visita 1 - ....pdf"
```
