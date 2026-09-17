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
obra = { id, nombre, direccion, tipo, estado: 'activa'|'cerrada', avance: 0..100,
         capitulos: [{ id, nombre, peso: 0..100, avance: 0..100 }],
         agentes: [{ rol, nombre, telefono, email, custom?: true }],
         visitas: [{ id, numero, fecha: 'AAAA-MM-DD', avance: 0..100, capitulos: [...], createdAt,
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

## 6. Distribución: quién puede usarla y descargar

Dos formas de repartirla, y no valen lo mismo:

| | Artifact de claude.ai | GitHub Pages |
|---|---|---|
| Instalable en el móvil | No | Sí (PWA, icono propio) |
| Funciona sin cobertura | No | Sí (service worker) |
| Descargar PDF/Word | Solo el propietario del artefacto | Cualquiera |

Dentro del artefacto la única vía de guardado es la capacidad `downloads` de claude.ai, y esa
capacidad la resuelve el propietario: a quien abre el enlace compartido le sale un aviso de permisos.
Por eso, **para pasársela a otra persona que tenga que emitir documentos, se usa GitHub Pages**.

Receta para dejarlo listo:

1. En GitHub: **Settings → Pages → Source: Deploy from a branch →** rama que contenga `index.html`,
   carpeta `/ (root)` **→ Save**. La app queda en `https://<usuario>.github.io/<repositorio>/`.
2. Poner esa dirección en `APP_URL` (en `index.html`): la usan la hoja «Instalar en el móvil»
   y el aviso que sale cuando la descarga está bloqueada dentro del artefacto.
3. En el móvil: abrir la URL → Chrome: menú ⋮ → *Instalar aplicación*; Safari: Compartir →
   *Añadir a pantalla de inicio*. La app captura `beforeinstallprompt` y ofrece el botón
   **Instalar aplicación** desde el menú ☰ cuando el navegador lo permite.

Detalles que hacen que el «sin conexión» funcione de verdad:

- `sw.js` sirve el esqueleto **desde la caché primero** (no red primero): así arranca sin cobertura
  y refresca en segundo plano. Las navegaciones responden siempre con `index.html` cacheado.
- Se cachean también las tipografías de `fonts.googleapis.com`/`fonts.gstatic.com` la primera vez
  que se cargan con conexión.
- Al subir versión hay que **subir `CACHE`** (`visitas-obra-vN`); la app manda `skipWaiting` para
  que la versión nueva entre sin esperar a cerrar todas las pestañas.
- El service worker **no** se registra dentro del artefacto (`enArtefacto()`), donde no aplica.
- Los datos ya viven en IndexedDB del dispositivo, así que sin conexión no se pierde nada.

Prueba de que funciona (Playwright): cargar la app, esperar a `navigator.serviceWorker.ready`,
crear una obra, `ctx.setOffline(true)` **y cerrar el servidor**, recargar y comprobar que sigue
apareciendo la obra. Y simular el artefacto con `addInitScript` inyectando un `window.claude`
cuyo `downloads.save` lanza un error de permisos, para ver que sale el aviso en vez de fallar mudo.

## 7. Cómo ampliar

- Nuevo rol de agente fijo: añadirlo al array `ROLES`.
- Nuevo tipo de documento: añadir una entrada en `DOC_TIPOS` (título, colores, si lleva firmas, texto legal) y una opción en la hoja «Emitir documento».
- Cambiar la paleta: solo los tokens de `:root` (y los hex/rgb de `DOC_TIPOS` para los documentos).
- Selector en la cabecera de una pantalla: pasar `titleAct` a `topbar()` y abrir una hoja desde ese `data-act`.
- **Al publicar una versión nueva**: subir el número de `CACHE` en `sw.js` y la versión visible del menú lateral. El
  service worker sirve las navegaciones con **la red por delante** (espera 4 s y, si no hay respuesta, tira de la
  copia guardada), porque con caché primero un móvil con la app instalada seguía viendo la versión anterior aunque
  hubiera cobertura — el fallo que más tiempo costó en las pruebas con el cliente. Cuando la versión nueva toma el
  mando (`controllerchange`), la pantalla se recarga sola tras guardar la visita abierta, y el menú tiene *Buscar
  actualización* para forzarlo. `tools/e2e-update.mjs` lo comprueba: instala, publica una versión distinta, reabre y
  exige ver la nueva, y luego que sin cobertura siga arrancando.

## 7. Avance de obra (porcentaje ejecutado)

Añadido después de la primera entrega, a petición del cliente: «en el estado de obras, ver el porcentaje de obra avanzada».

- **Dato**: `obra.avance` (0-100) es el valor vigente; cada visita guarda su propia foto fija en `visita.avance`
  (se inicializa con el avance de la obra al crearla). Así el documento de una visita antigua sigue diciendo el
  porcentaje que había ese día, y la obra muestra siempre el último. Las obras guardadas antes de esta versión no
  tienen el campo: `pct()` las normaliza a 0 sin migración.
- **Helpers** (junto a `findObra`): `pct(n)` acota y redondea a 0-100, `avanceDe(o, vis)` elige el valor de la visita
  o, si no lo hay, el de la obra, y `progBar(n, etiqueta)` pinta la barra (degradado azul→verde-azulado, verde al 100 %).
- **Dónde se ve**: tarjeta de *Mis obras*, tarjeta de la obra, cabecera de la visita, hoja de datos de obra (icono ⓘ)
  y la tabla de datos de los documentos PDF y Word, con barra dibujada bajo la tabla.
- **Dónde se edita**: deslizador en *Ajustes de obra* (`#f-avance`, con atajos 0/25/50/75/100 %) y hoja *Actualizar
  avance* (`avanceSheet`) desde la obra o desde una visita; al guardar desde una visita se actualizan las dos.
- **En los documentos**: fila `AVANCE DE OBRA · 45% ejecutado`. En el PDF la barra son dos `rect` (fondo `T.light`,
  relleno `T.accent2` proporcional). En el DOCX, una tabla anidada de dos celdas sombreadas con anchos proporcionales
  (`hexBg` es el tono claro, `hex2` el relleno), porque OOXML no tiene barra de progreso.
- **Prueba**: `tools/e2e.mjs` fija el 30 % al crear la obra, activa los capítulos habituales, puntúa los tres primeros
  desde la visita y comprueba que el 22 % calculado aparece en la obra y en la lista tras recargar; el PDF se valida
  con `tools/check-pdf.py`.

## 8. Capítulos de ejecución (medir el avance por partidas)

Segunda petición sobre lo anterior: «que salgan los capítulos de ejecución de obra para medir el porcentaje avanzado».

- **Dato**: `obra.capitulos = [{ id, nombre, peso, avance }]`, y cada visita guarda su copia en `visita.capitulos`
  (igual que el avance: el acta de una fecha refleja los capítulos de esa fecha).
- **Cálculo**: `avanceCaps()` es la media ponderada `Σ(peso·avance)/Σpeso`, así que **los pesos no tienen que sumar
  100**: se reparten en proporción. `avanceDe(o, vis)` usa los capítulos si existen y, si no, el valor manual; el
  deslizador global sigue ahí para quien no quiera desglosar.
- **Plantilla**: `CAPITULOS_DEF` con los diez capítulos habituales de edificación y sus pesos orientativos
  (estructura 18, revestimientos y acabados 20, instalaciones 16…), que suman 100. Son editables y se pueden borrar.
- **Dónde se edita**: *Ajustes de obra* → *Capítulos de ejecución*, donde cada capítulo tiene **nombre, peso y
  ejecutado** (las dos cifras juntas, más lo que aporta al total), y la hoja *Actualizar avance*, con un deslizador
  por capítulo para el día a día en obra (el total y el botón de guardar quedan fijos con `position:sticky` porque la
  lista es larga). En cuanto la obra tiene capítulos, el campo *Avance de obra* deja de ser un deslizador y pasa a ser
  la barra calculada (`pintaCapitulos()` la refresca al teclear); el deslizador manual solo aparece sin capítulos.
- **Dónde se ve**: desplegable «Capítulos de ejecución (n)» en la obra y en la visita, y sección **AVANCE POR
  CAPÍTULOS DE EJECUCIÓN** en el PDF y el Word, con columnas capítulo / peso / ejecutado / barra y fila de total.
  El peso se imprime normalizado (`peso·100/Σpeso`) para que se lea como porcentaje aunque no sumen 100.
- **Aportación al total** (`aportaCap`): además de lo ejecutado en cada capítulo, la columna *Del total* dice cuánto
  aporta a la obra completa (`peso normalizado · ejecutado / 100`): Estructura, con peso 18 % y al 60 %, aporta
  10,8 %. La columna suma exactamente el total, lo que hace comprobable el porcentaje de la obra. Se muestra con un
  decimal y coma decimal (`num1`), bajo cada deslizador de la hoja de avance y en el desglose de la obra y la visita.

## 9. Saltar entre visitas desde la propia visita

Pedido igual que la fecha, que ya se cambiaba tocándola: «cuando toques la visita, que salgan las demás para ir
cambiando y verlas todas».

- `topbar()` acepta `titleAct`: envuelve el `<h1>` en un botón con un galón, y la vista de visita pasa
  `titleAct: 'pickVisita'`.
- `visitasSheet(obraId, actualId)` lista todas las visitas de la obra (número en círculo, fecha y el mismo resumen
  que la tarjeta), marca la actual y ofrece *Nueva visita* al pie. Respeta el orden elegido en la obra (`S.sortDesc`).
- Navegar entre visitas usa `go(..., true)` cuando ya se está en una visita, igual que al crear una nueva desde la
  hoja: así el botón atrás del móvil vuelve a la obra y no recorre todas las visitas visitadas.
