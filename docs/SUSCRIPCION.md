# Suscripción mensual: cómo montarla sobre «Visitas de Obra»

Propuesta de trabajo (todavía **no implementada**) para pasar de app gratuita a producto con cuota mensual.
Se ordena de lo más barato y rápido a lo más completo, para poder cobrar pronto y crecer después.

## 1. El punto de partida y lo que obliga a cambiar

Hoy la app no tiene servidor: todo vive en el móvil (IndexedDB) y no hay cuentas de usuario. Para cobrar hacen falta
tres piezas nuevas, y solo tres:

1. **Identidad**: saber quién es el usuario (correo + enlace mágico o contraseña).
2. **Cobro recurrente**: Stripe (o Paddle) con suscripción mensual y portal de cliente para bajas y facturas.
3. **Estado del plan**: un sitio donde consultar «este usuario está al corriente de pago» y unos límites en la app.

Lo que **no** hay que cambiar: la app sigue funcionando sin conexión y guardando en el dispositivo. La nube se añade
como servicio de pago, no como requisito para trabajar en obra.

## 2. Qué se vende (gratis vs. Pro)

El avance de obra, las fotos y el acta en PDF deben seguir siendo gratis: son el gancho. Lo de pago es lo que ahorra
tiempo a un estudio con varias obras y lo que un cliente no puede reproducir a mano.

| | **Gratis** | **Pro · 9,99 €/mes** (o 99,99 €/año) |
|---|---|---|
| Obras | 1 obra activa | Ilimitadas |
| Visitas, fotos, voz, avance | Sí | Sí |
| PDF / Word | Sí, con pie «Generado con Visitas de Obra» | Sin pie, con el logotipo y los datos del estudio |
| Copia de seguridad | Manual (archivo `.json`) | **Nube automática y varios dispositivos** (móvil + oficina) |
| Compartir | Descargar y enviar a mano | **Envío del acta por correo al promotor** desde la propia app, con acuse |
| Firmas | Bloque de firmas en papel | **Firma en pantalla** del constructor y la D.F. en la visita |
| Avance | Barra por obra y visita | **Gráfico de evolución** y plazos previstos vs. reales; aviso si la obra se estanca |
| Documentos | Acta e Informe | Plantillas propias del estudio (portada, membrete, texto legal a medida) |
| Equipo | 1 persona | **Varios usuarios** por estudio con las mismas obras |

Extras que justifican precio más alto más adelante: libro de órdenes y asistencias, listas de comprobación de
seguridad, control de certificaciones y comparación de avance con la planificación.

## 3. Arquitectura recomendada

**Supabase + Stripe** es la combinación con menos trabajo para una app que ya es HTML plano:

```
index.html (PWA, offline)
   │  supabase-js  → Auth (enlace mágico por correo)
   │               → Postgres (obras, visitas, perfiles) con Row Level Security
   │               → Storage (fotos originales)
   └─ fetch → Edge Function /crear-sesion-pago   → Stripe Checkout
              Edge Function /webhook-stripe      → escribe suscripciones(estado, fin_periodo)
              Edge Function /portal-cliente      → Stripe Customer Portal (bajas y facturas)
```

- **Por qué Supabase**: cuentas, base de datos y almacenamiento en un solo servicio, plan gratuito para empezar,
  y RLS evita escribir un backend propio: cada usuario solo ve sus filas.
- **Por qué Stripe**: suscripciones, periodo de prueba, IVA con Stripe Tax, facturas y portal de bajas ya hechos.
  El webhook es el único punto que debe ser fiable: es quien marca `activa`, `impagada` o `cancelada`.
- **Alternativa aún más barata**: Cloudflare Workers + D1 + Stripe. Menos trabajo de servidor que gestionar, pero hay
  que escribir la sincronización a mano; con Supabase viene hecha.
- **Regla de oro**: el plan se comprueba **en el servidor**, no en el móvil. En la app el plan solo decide qué se
  enseña; que un usuario toque el `localStorage` no debe darle nube ni envío de correos.

## 4. Cambios en la app

Pequeños y acotados, siguiendo el estilo actual del `index.html`:

- `S.cuenta = { email, plan: 'free'|'pro', hasta: fecha }`, guardado en el store `kv` y refrescado al abrir con conexión.
  Sin conexión se respeta el último plan conocido durante unos días (una obra no puede quedarse bloqueada en un sótano).
- `const esPro = () => S.cuenta.plan === 'pro' && Date.now() < S.cuenta.hasta;` y un único sitio donde se decide cada
  límite: `limite('obras')`, `limite('sinMarca')`, `limite('nube')`.
- Pantalla **Mi cuenta** en el menú lateral: plan actual, botón *Hazte Pro* (abre Stripe Checkout), *Gestionar
  suscripción* (portal de Stripe) y estado de la última sincronización.
- Muro suave: al crear la segunda obra o al exportar sin pie, una hoja que explica el plan; nunca se bloquea el acceso
  a los datos ya creados, ni siquiera si la suscripción caduca (se vuelve a modo gratuito, los datos siguen ahí).
- Sincronización: cola de cambios pendientes (`updatedAt` por obra) y resolución «gana el más reciente»; las fotos
  suben a Storage y en el dispositivo queda la miniatura.

## 5. Fases

| Fase | Trabajo | Resultado |
|---|---|---|
| 1 · Cobrar ya (1-2 días) | Stripe Payment Link + claves de licencia manuales, pantalla *Mi cuenta*, marca en el PDF gratuito | Se puede facturar a los primeros estudios sin backend |
| 2 · Cuentas y plan (1 semana) | Supabase Auth + tabla `suscripciones` + webhook de Stripe + portal de cliente | Altas, bajas y renovaciones automáticas |
| 3 · Nube (2-3 semanas) | Tablas de obras/visitas con RLS, Storage de fotos, sincronización y multi-dispositivo | La razón principal para pagar |
| 4 · Servicios Pro (continuo) | Firma en pantalla, envío por correo, gráfico de avance, plantillas, equipo | Sube el precio y baja la fuga de clientes |

## 6. Lo legal y lo administrativo (España)

- Alta de actividad y facturación de la cuota; **IVA del 21 %** — con Stripe Tax se calcula y se declara solo.
- Condiciones del servicio y política de privacidad enlazadas desde *Mi cuenta*, y derecho de desistimiento.
- **RGPD**: con la nube activada el estudio pasa a tratar datos de terceros (agentes, fotos de obra). Hace falta
  contrato de encargado de tratamiento, borrado de cuenta y exportación de datos (la copia `.json` ya sirve de base).
- Pensar la prueba: 14 días de Pro sin tarjeta convierte mejor que una demo, y en obra se prueba en una semana real.

## 7. Precio

**9,99 €/mes** o **99,99 €/año** por usuario (el anual sale a 8,33 €/mes: dos meses gratis, y cobra por adelantado
doce meses de tesorería). Un aparejador factura una visita de obra muy por encima de 10 €, así que la cuota se paga
con ahorrar un rato de oficina al mes; por debajo de esa cifra el precio deja de leerse como herramienta profesional.

En Stripe se crea un solo producto *Visitas de Obra Pro* con dos precios (mensual y anual) y el cambio entre ambos lo
gestiona el portal de cliente. Cuando exista el trabajo en equipo, plan **Estudio** de 39,99 €/mes hasta 5 usuarios.
Subir precio a medida que entren las funciones de la fase 4, respetando siempre el precio a quien ya estaba suscrito
(en Stripe, dejando activo el precio antiguo en vez de editarlo).
