# Cómo se hizo «Visitas de Obra» (receta para repetirlo igual)

Este documento recoge las decisiones y pasos seguidos para construir la app, de modo que una petición futura
del tipo «hazme una app de visitas de obra como ACTA» se resuelva de la misma manera.

## 1. Petición original y referencia

- Cliente: jefe de estudio; necesitaba usar el programa **al día siguiente**, desde el móvil.
- Referencia visual: capturas de la app **ACTA** (Mis proyectos → obra → visitas → visita por bloques; ajustes de obra con chips de agentes; menú lateral; PDF con logo, título «ACTA DE VISITA N», fecha, obra, dirección, fotos en dos columnas, firmas y texto legal).
- Requisitos explícitos:
  1. Obra con datos y **agentes** (Dirección Facultativa, Promotor, Constructor…), todos con **nombre y contacto (teléfono y correo)**.
  2. Visitas con **texto, fotos con comentarios y dictado por voz**.
  3. **Tonos azules** en la interfaz.
  4. **Exportar PDF** con encabezado de datos de obra, logo, fecha y los textos y fotos. Mejor si además es **editable** (→ Word .docx).
  5. Poder **elegir el tipo de documento** al emitirlo: *Acta de visita* o *Informe de situación de obra* (verde).

## 2. Decisiones de arquitectura

| Decisión | Motivo |
|---|---|
| **Un solo `index.html`** con CSS y JS inline, sin frameworks ni build | Se abre en cualquier móvil, se publica como Artifact de claude.ai o en GitHub Pages sin tocar nada, y no depende de CDNs (el entorno no tenía acceso a ellos y en obra puede no haber cobertura). |
| **PWA** (`manifest.webmanifest` + `sw.js` + iconos) | Se instala en la pantalla de inicio y funciona sin conexión. |
| **IndexedDB** (con respaldo en `localStorage`) | Las fotos en base64 superan el límite de localStorage; IndexedDB admite decenas de MB. Un único store `obras` (cada obra lleva dentro sus visitas y bloques) y un store `kv` para el perfil. |
| **Fotos redimensionadas a 1600 px JPEG 0.82** al añadirlas | Tamaño contenido, y JPEG permite incrustarlas en PDF (`DCTDecode`) y DOCX sin recodificar. |
| **Generador PDF propio** (`MiniPDF`) | Sin librerías: objetos, fuentes Helvetica con `WinAnsiEncoding` (acentos y ñ), imágenes JPEG, tabla xref correcta. El ancho de texto se mide con un canvas (`Helvetica, Arial`) para el ajuste de líneas. |
| **Generador DOCX propio** | ZIP en modo *store* (CRC32 + cabeceras locales, directorio central y EOCD) con las partes OOXML mínimas: `[Content_Types].xml`, `_rels/.rels`, `word/document.xml`, `word/styles.xml`, `word/footer1.xml`, `word/_rels/document.xml.rels`, `word/media/*.jpg`. Ojo al **orden de los elementos** en `pPr`/`rPr` (pBdr → shd → spacing → jc; color → sz), Word es estricto. |
| **Dictado por voz** con Web Speech API (`webkitSpeechRecognition`, `es-ES`, continuo) | Crea un bloque «Dictado por voz» y va escribiendo el texto. Si no hay soporte o permiso (p. ej. dentro de un iframe), mensaje con la alternativa: micrófono del teclado. |
| **Entrega de archivos** en cascada | 1) capacidad `downloads` de claude.ai si la página corre como Artifact (`claude.use("downloads")`); 2) `navigator.share({files})` en móvil (abre WhatsApp, correo…); 3) enlace de descarga. |
| **Navegación** con `history.pushState`/`popstate` | El botón «atrás» del móvil funciona como en una app nativa. |

## 3. Diseño

El cliente pidió primero «muy parecido a ACTA» y después matizó: **el contenido es lo importante, el diseño no tiene que ser igual; cambiar el logo y darle más vida**. La versión final:

- Paleta (tokens CSS en `:root`, con variante oscura): fondo `#EDF3FA`, tarjetas blancas, azul marino `#0F3D6E` y azul vivo `#1E6FD9` (cabeceras con **degradado** entre ambos), celeste `#BFD8F7`, **ámbar** `#F5A623` como acento cálido (casco, botón «Nueva visita», marcador de sección, herramienta Voz), verde-azulado `#12A08A` (Foto), verde `#31A85B` para «Activa», rojo `#E8554E` para borrar.
- Tipografía: *Nunito* (Google Fonts, pesos 500/700/800) con fallback del sistema; títulos en 800.
- Logotipo propio: **casco de obra ámbar con visera y un check blanco** + marca «Visitas / DE OBRA». Mismo motivo en los iconos PWA (`tools/make-icons.mjs` los rasteriza de forma procedimental) y como logotipo por defecto en el PDF (dibujado con curvas Bézier) cuando la empresa no ha subido el suyo.
- Elementos «con vida»: cabecera en degradado con esquinas inferiores redondeadas, tarjetas con **franja lateral de color** (verde activa, gris cerrada, azul visita), etiquetas de tipo, contador de visitas y última visita, herramientas Texto/Foto/Voz con etiqueta y color propio, insignias de color en cada bloque de la visita, ilustración de estado vacío con grúa, casco y edificios.
- Estructura de pantallas calcada de ACTA (lo que el cliente conoce): Mis obras → Ajustes de obra con chips de agentes → Obra con lista de visitas → Visita por bloques → menú lateral.
- Documentos: *Acta* en azules con firmas y texto legal; *Informe de situación* en verdes (`#1C6640`, `#3F9A61`) sin firmas. Ambos: logo + empresa a la izquierda, título/fecha/obra/dirección a la derecha, tabla de datos de obra, tabla de agentes con contacto, contenido con fotos en rejilla de 2 columnas y separador vertical, pie con paginación.

## 4. Modelo de datos

```js
obra = { id, nombre, direccion, tipo, estado: 'activa'|'cerrada',
         agentes: [{ rol, nombre, telefono, email, custom?: true }],
         visitas: [{ id, numero, fecha: 'AAAA-MM-DD', createdAt,
                     bloques: [{ id, tipo: 'texto'|'voz', texto } | { id, tipo: 'foto', src, w, h, comentario }] }],
         createdAt, updatedAt }
perfil = { nombre, empresa, telefono, email, logo: { src, w, h } | null }
```

## 5. Pasos de construcción (en orden)

1. Ver las capturas de referencia y listar pantallas: Mis obras → Ajustes de obra → Obra (visitas) → Visita (bloques) → Mi perfil → menú lateral → hoja «Emitir documento».
2. Escribir `index.html`: tokens CSS, iconos SVG inline, `Store` (IndexedDB), estado `S`, `render()` por vistas, delegación de eventos (`data-go`, `data-act`, `data-f`, `data-af`, `data-bf`, `data-p`), bloques, fotos, voz, `MiniPDF`, `buildPDF`, `makeZip`, `buildDOCX`, `deliver`, `init`.
3. Iconos: `node tools/make-icons.mjs` (PNG generado con zlib de Node, sin librerías) + `icons/icon.svg`; `manifest.webmanifest`; `sw.js`.
4. Probar con Playwright (`tools/e2e.mjs`): crea obra con agentes, visita, texto, dos fotos con comentario, exporta Acta/Informe en PDF y DOCX, recarga y comprueba persistencia. Validar el PDF con `tools/check-pdf.py` y el DOCX con `unzip -t` + `xmllint`.
5. Generar la versión Artifact (`python3 tools/make-artifact.py` → `dist/artifact.html`, sin `<html>/<head>/<body>`) y publicarla con la capacidad `downloads`.
6. Commit y push a la rama indicada; instrucciones de GitHub Pages en el README.

## 6. Cómo ampliar

- Nuevo rol de agente fijo: añadirlo al array `ROLES`.
- Nuevo tipo de documento: añadir una entrada en `DOC_TIPOS` (título, colores, si lleva firmas, texto legal) y una opción en la hoja «Emitir documento».
- Cambiar la paleta: solo los tokens de `:root` (y los hex/rgb de `DOC_TIPOS` para los documentos).
