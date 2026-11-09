# Ventas y pedidos — carrito, checkout, pagos y panel admin

Documentación de cómo funciona la compra en las tiendas **Maderin** y **Corazón de Madera (CDM)**, de punta a punta: del carrito del cliente a la gestión del pedido en `/admin`. AC Mueblería (la página principal) no vende en línea: cotiza por WhatsApp.

## 1. Vista general

```
Tienda (maderin.html / cdm.html)         checkout.html                    pedido.html?c=CÓDIGO&t=TOKEN
  Carrito (localStorage)  ───────────▶  Datos + entrega + pago  ───────▶  Seguimiento + instrucciones de pago
  assets/main.js                         assets/checkout.js                assets/pedido.js
                                              │ POST /api/orders                │ GET /api/orders?c=&t=
                                              ▼                                  ▼
                                   api/orders.js  +  api/_orders.js  ──▶  Vercel Blob  pedidos/<CÓDIGO>-<token>.json
                                                                                  ▲
                                                          /admin → Pedidos  ──────┘  (api/admin.js)
```

Principios de diseño:

- **El servidor manda sobre los precios.** El navegador solo envía qué producto, color, texto y cantidad quiere el cliente. Precios, descuentos, cupón, envío y recargo se recalculan en `buildOrder()` ([api/_orders.js](../api/_orders.js)) contra el catálogo publicado.
- **Cada pedido es un archivo JSON propio** en Vercel Blob (`pedidos/<CÓDIGO>-<token>.json`). El `token` es aleatorio (128 bits): solo quien tiene el enlace puede ver el pedido. El listado completo solo lo hace el admin.
- **Sin pasarela obligatoria.** Se paga por Yape, transferencia BCP o tarjeta vía link de pago que se pide por WhatsApp. Mercado Pago automático existe pero está apagado por defecto (ver §6).

## 2. Archivos

| Archivo | Rol |
|---|---|
| [assets/main.js](../assets/main.js) (`setupCart`) | Carrito: estado, panel lateral, aviso «✓ Agregado al carrito». Compartido por Maderin y CDM. |
| [checkout.html](../checkout.html) + [assets/checkout.js](../assets/checkout.js) | Página «Finalizar compra». |
| [pedido.html](../pedido.html) + [assets/pedido.js](../assets/pedido.js) | Página del pedido del cliente. |
| [assets/catalog.js](../assets/catalog.js) | Utilidades compartidas: `formatPEN`, texturas, distritos/envíos. |
| [api/orders.js](../api/orders.js) | API pública de pedidos. |
| [api/_orders.js](../api/_orders.js) | Lógica: validación, precios, cupones, plazo, Mercado Pago, correo, WhatsApp. |
| [api/mp-webhook.js](../api/mp-webhook.js) | Aviso de Mercado Pago cuando se paga con tarjeta. |
| [api/admin.js](../api/admin.js) | Operaciones del panel (incluye pedidos). |
| [admin.html](../admin.html), [assets/admin.js](../assets/admin.js) | Panel admin. |
| [server.js](../server.js) | Servidor Express local (`npm run dev`); en Vercel cada archivo de `api/` es una función. Los que empiezan con `_` no son rutas. |

Los **medios de pago** (Yape, transferencia, tarjeta y su recargo) se configuran desde el admin → **Pagos** (§8). Siguen fijos en el código la dirección de la tienda (`STORE`) y el WhatsApp (`WHATSAPP`, en [api/_orders.js](../api/_orders.js) y repetidos en `checkout.js` / `pedido.js`).

## 3. Carrito (en la tienda)

- **Estado**: `localStorage`, una clave por tienda: `maderinCart` / `cdmCart`. Cada línea: `{ id, color, qty, text }`.
- **Reglas**: máximo **10 unidades por línea**. Al cargar se descartan líneas de productos que ya no existen, están agotados o sin precio.
- **Personalización (solo CDM)**: si el producto tiene campo personalizado (configurable en el editor de producto: etiqueta, máximo de caracteres, obligatorio), el cliente escribe el texto y viaja con la línea.
- **Color / textura**: el cliente elige la textura de la biblioteca compartida; se guarda el nombre.
- **Panel del carrito**: lista de productos (con precio regular tachado si hay descuento), cantidades, y un pie fijo con **Subtotal**, el texto «Medios de pago: Yape, Transferencia bancaria o link de pago.» y los botones **Finalizar compra** y **Seguir comprando**.
- **Aviso al agregar**: «✓ Agregado al carrito» (compacto en celular).
- **Formato de precios**: `S/1,250` (sin espacio, coma de miles; céntimos solo si los hay) con `ACCatalog.formatPEN`, igual en carrito, checkout, correo y admin.

## 4. Checkout (`checkout.html`)

Se abre con `?tienda=maderin|cdm` y toma el tema, logo y favicon de la tienda sin parpadeo. Si el carrito está vacío muestra «Tu carrito está vacío».

**Paso 1 — Tus datos**: nombre y apellido, celular (9 dígitos), email (opcional), y casilla **«Quiero boleta»** que pide **DNI de 8 dígitos**.

**Paso 2 — Entrega**
- **Envío a domicilio** (marcado por defecto): dirección + distrito. El costo sale de la tabla de envíos por distrito de la tienda (§7). Los distritos sin envío o sin costo no se pueden elegir; hay un enlace a WhatsApp para consultar otros.
- **Recojo en tienda**: Ca. Argentina #201 – Comas, costo S/0, con botón «Ver ubicación» que despliega el mapa (clic abre Google Maps).
- Se muestra el **plazo estimado**: cada producto tiene un «tiempo de entrega» («4 a 6 días hábiles»); con varios productos se **suman** (`estimateEta`).

**Paso 3 — Forma de pago**: Yape, Transferencia bancaria (BCP) o Tarjeta (recargo configurable).

**Nota adicional** (opcional, hasta 300 caracteres).

**Resumen lateral**: productos con cantidad editable, cupón, y el desglose: *Precio regular → Descuentos del producto → Subtotal → Cupón → Envío → Recargo tarjeta → Total*, más el aviso «¡Ahorras S/… en esta compra!» y el plazo estimado.

**Experiencia de formulario**
- Los errores aparecen al salir de cada campo (no mientras se escribe) y al intentar confirmar se lleva el foco al primer campo con error.
- Cada tarjeta muestra su número de paso, que pasa a ✓ «Listo» al completarse.
- Los datos del cliente se recuerdan (`<tienda>CartFields`) para la próxima compra.
- Si el cliente vuelve atrás desde la página del pedido, el **carrito se conserva** y aparece un aviso con enlace al pedido recién creado (`<tienda>LastOrder`). El carrito solo se vacía cuando el pedido avanza (§5).
- Campo trampa `website` (honeypot) contra bots.

### Cupones

El cliente escribe el código en el resumen y se valida con `POST /api/orders?op=coupon` (con una pausa de 0.5 s ante error para frenar la búsqueda de códigos). Reglas (`evaluateCoupon`):
- debe existir y estar **activo**;
- aplica a la tienda indicada (Ambas / Maderin / CDM);
- no estar vencido (vence al final del día indicado, hora de Lima);
- cumplir la **compra mínima** (sobre el subtotal de productos);
- el descuento (**% o S/**) se aplica solo al **subtotal de productos**, no al envío, y nunca supera el subtotal.

Los cupones **no son públicos**: `GET /api/catalog` los elimina. Se crean en el admin → **Cupones** (§8).

### Cálculo del total

```
subtotal   = Σ precio_actual × cantidad          (precio del catálogo, nunca del navegador)
descuento  = cupón (si aplica)
envío      = costo del distrito (0 si recojo)
recargo    = (subtotal − descuento + envío) × 3.5%   solo si paga con tarjeta
TOTAL      = subtotal − descuento + envío + recargo
```
`productDiscount` (diferencia entre precio regular y precio actual) se guarda y se muestra, pero **ya está incluido** en el subtotal.

## 5. Página del pedido (`pedido.html?c=CÓDIGO&t=TOKEN`)

Al confirmar, el cliente es llevado aquí. El código tiene la forma `MAD-XXXXXX` / `CDM-XXXXXX` (6 caracteres sin letras ambiguas). El tema (colores/logo) se decide por el prefijo del código antes de pintar.

Contenido: resumen (productos, precio regular tachado, desglose, entrega, plazo), instrucciones de pago según el método, y un **seguimiento con nodos** que marca cada estado alcanzado con su fecha:

`Esperando pago → Comprobante en revisión (solo Yape/transferencia) → Pago confirmado → En preparación → Listo para recoger / para el envío → Entregado` (y `Cancelado` si corresponde).

Las fechas se deducen del historial del pedido (`statusTimes`).

## 6. Medios de pago

Todo esto es **configurable en el admin → Pagos**: cada medio se puede activar o desactivar, y se editan sus datos. Si no se ha configurado nada, rigen los valores de siempre (Yape, BCP y tarjeta 3.5 %).

| Medio | Recargo | Cómo funciona |
|---|---|---|
| **Yape** | 0 | Se muestra el QR, el número y el titular configurados (por defecto el QR de `public/pagos/yape-qr.jpg` y el `924 486 717`). El cliente paga y **sube el comprobante** en la página del pedido. |
| **Transferencia BCP** | 0 | Se muestran cuenta en soles, CCI y titular (con botón copiar). Igual: **sube el comprobante**. |
| **Tarjeta** | **configurable** (3.5 % por defecto; con 0 no hay recargo) | No hay pasarela en el sitio. Se abre **WhatsApp** (`wa.me/51943613883`) con un mensaje armado: pedido, productos, subtotal, cupón, envío, recargo y **TOTAL A PAGAR**. El dueño responde con un link de pago. |

Un medio **desactivado** no aparece en el checkout ni en el carrito, y el servidor también lo rechaza. Si Yape o la transferencia están activos pero **sin datos**, la página del pedido ofrece «Pedir los datos por WhatsApp». El recargo aplicado se guarda en cada pedido (`feeRate`), así que cambiar el porcentaje después no altera pedidos ya creados.

**Comprobante**: `POST /api/orders?op=proof` con la imagen (JPG/PNG/WebP, máx. 1.5 MB). Se guarda en Blob, el pedido pasa a `review` («Comprobante en revisión»), queda en el historial y se avisa por correo. Solo se admite en estados `pending`/`review` y no para pedidos con tarjeta.

**Mercado Pago automático (opcional, apagado)**: el código para crear el link de pago por el monto exacto y marcar el pedido como pagado vía webhook (`/api/mp-webhook`, que **verifica el pago consultando a Mercado Pago**, no confía en lo recibido) sigue en el proyecto, pero solo se activa si están definidas `MP_ACCESS_TOKEN` **y** `MP_AUTO_LINK=1`. Mientras tanto la tarjeta se maneja por WhatsApp.

## 7. Envíos por distrito

- Lista fija de **50 distritos** de Lima y Callao (`DISTRICTS` en [api/_lib.js](../api/_lib.js)).
- **Cada tienda tiene su propia tabla**: por distrito, «¿Se envía? Sí/No», costo y observación.
- Se edita en el admin → **Envíos**, o se **importa el Excel** (`costos-envio-distritos.xlsx`, hojas «Maderin» y «CDM», columnas Distrito, ¿Se envía?, Costo de envío, Observación). El lector de Excel (SheetJS) se carga solo al importar.
- Un distrito con «No» o sin costo **no se puede elegir** en el checkout y el servidor también lo rechaza.

## 8. Panel admin (`/admin`)

Acceso con clave (`ADMIN_PASSWORD`); la sesión dura 12 horas (cookie firmada `ac_admin`). Pestañas de la barra superior: **Maderin · Corazón de Madera · Pedidos | Campañas · Cupones · Envíos · Pagos**. Los cambios del catálogo se aplican con **Publicar cambios** (barra inferior); los **pedidos se guardan al instante**.

### Pedidos

- Lista de pedidos más recientes primero. Cada fila: código, cliente, tienda, medio de pago, fecha, total y estado.
- La pestaña muestra un **contador rojo** con los pedidos esperando confirmación de pago.
- **Filtros**: Por atender · Por confirmar pago · Pagados · Entregados · Cancelados · Todos.
- Al abrir un pedido: cliente y contacto, entrega, productos (color, texto personalizado), desglose, plazo, boleta con DNI, nota del cliente, **comprobante** (enlace a la imagen) e historial.
- **Acciones**:
  - **Cambiar estado**: se elige en la lista y se aplica con **«Guardar estado»** (no al elegir).
  - **Confirmar pago**: atajo para pasar `pending/review` a `paid`, con confirmación.
  - **Cancelar**: abre una ventana propia con el resumen, aviso si el pedido **ya estaba pagado** («recuerda devolver su dinero») y **motivo opcional** que queda en el historial.
  - **WhatsApp al cliente** y **Ver página del cliente**.
- **Estados**: `pending` Esperando pago · `review` Comprobante por revisar · `paid` Pagado · `preparing` En preparación · `ready` Listo · `delivered` Entregado · `cancelled` Cancelado.
- **Cancelados**: se muestran **30 días** desde la cancelación (`cancelledAt`); después dejan de listarse pero el archivo sigue guardado. Si un pedido vuelve a otro estado, se borra `cancelledAt`.
- Cada cambio queda en el **historial** del pedido con fecha («Estado cambiado a «…» desde el admin»).

### Pagos

Página con tres tarjetas: **Yape / Plin** (activar, número, titular, imagen del QR por URL o subiendo archivo), **Transferencia bancaria** (activar, banco, titular, número de cuenta, CCI) y **Tarjeta** (activar y recargo en %, de 0 a 15). Se aplica al **Publicar cambios**. Los datos viajan al cliente solo dentro de su propio pedido; el catálogo público solo expone qué medios hay y el recargo.

### Cupones

Tabla editable: código (mayúsculas, A-Z 0-9 _ -), tipo (% o S/), valor, tiendas, compra mínima, fecha de vencimiento (desde 2025-01-01 hasta el 31 dic del año actual; vacía = no vence) y activo. Las filas vacías se descartan al salir o publicar.

### Envíos

Descrito en §7.

### Campañas (hero)

Fuera del alcance de la venta, pero vive en el mismo panel: portadas de temporada para AC, Maderin y CDM con vista previa fiel, plantillas (Navidad, Día de la Madre/Padre/Niño, Fiestas Patrias, Cyber, Black Friday) y fechas de inicio/fin en hora de Lima.

## 9. API

### Pública — `/api/orders`

| Método | Parámetros | Función |
|---|---|---|
| `POST` | `{ shop, name, phone, email?, items:[{id,color,text,qty}], deliveryMode, district?, address?, method, coupon?, boleta?, dni?, notes? }` | Crea el pedido. Devuelve `{ code, token, payUrl?, whatsappUrl? }`. |
| `GET` | `?c=CÓDIGO&t=TOKEN` | Estado del pedido (`publicOrder`: sin teléfono, email ni DNI). |
| `POST` | `?op=coupon` `{ shop, code, subtotal }` | Vista previa del descuento. |
| `POST` | `?op=proof` `{ c, t, img }` | Sube el comprobante. |

Validaciones del servidor: producto existente, visible, con precio y no agotado; cantidad 1–10; color válido; texto obligatorio si el producto lo exige; distrito con envío; DNI de 8 dígitos si hay boleta; honeypot; límite de tamaño del cuerpo.

### Admin — `/api/admin` (requiere sesión)

`session` · `login` · `logout` · `catalog` · `save` (catálogo, texturas, envíos, cupones, campañas, medios de pago) · `orders` · `order-update { code, status?, note? }` · `upload` (fotos de producto, texturas, imágenes de campaña, QR de Yape).

## 10. Almacenamiento

| Dato | Dónde |
|---|---|
| Catálogo, texturas, envíos, cupones, campañas, medios de pago | `catalog.json` en Vercel Blob |
| Pedidos | `pedidos/<CÓDIGO>-<token>.json` en Vercel Blob |
| Comprobantes y fotos | Vercel Blob (públicos, nombre con código) |
| Carrito y datos recordados | `localStorage` del cliente |

**Modo local** (`npm run dev`, sin variables de Blob): todo se guarda en la carpeta `.data/` y el admin muestra el aviso «Modo de prueba local». No toca lo publicado.

## 11. Variables de entorno (Vercel)

| Variable | Para qué | Obligatoria |
|---|---|---|
| `BLOB_READ_WRITE_TOKEN` | Almacenamiento (Vercel Blob) | Sí |
| `ADMIN_PASSWORD` | Clave del panel `/admin` | Sí |
| `ADMIN_SECRET` | Firma de la sesión (si falta, se usa la clave) | No |
| `RESEND_API_KEY` | Avisos por correo de pedidos | No (sin ella no se envían correos) |
| `ORDERS_NOTIFY_EMAIL` | Quién recibe los avisos (por defecto `ac.muebles.21@gmail.com`) | No |
| `ORDERS_FROM_EMAIL` | Remitente (por defecto el de pruebas de Resend, que solo llega al correo de la cuenta Resend) | No |
| `SITE_URL` | URL pública para enlaces de Mercado Pago | No |
| `MP_ACCESS_TOKEN` + `MP_AUTO_LINK=1` | Activar el link de pago automático de Mercado Pago | No |

## 12. Avisos por correo

Si hay `RESEND_API_KEY`, se avisa al dueño en: **nuevo pedido**, **comprobante recibido** y **pago confirmado**. El correo trae cliente, productos, desglose, entrega, plazo, boleta, nota y enlace al comprobante. Un fallo de envío no bloquea el pedido.

## 13. Seguridad y privacidad

- Precios y totales **siempre** los calcula el servidor.
- El enlace del pedido incluye un token de 128 bits; el listado completo solo lo ve el admin.
- La vista pública del pedido (`publicOrder`) **no incluye** teléfono, email ni DNI.
- Los cupones y las campañas programadas no se exponen en `/api/catalog`.
- Contenido de clientes se escapa antes de mostrarse (panel y correos).
- Ruta `/admin` con `noindex` y sin caché.
- **Pendiente de decisión**: el DNI de la boleta se guarda en el pedido; no hay purga automática de pedidos cancelados antiguos.

## 14. Puesta en marcha / mantenimiento

1. Definir las variables de §11 en Vercel y desplegar.
2. En `/admin`: **Envíos** → importar el Excel por tienda; **Cupones** → crear los códigos; **Publicar cambios**.
3. Hacer una **compra de prueba** por cada medio de pago y revisarla en **Pedidos**.
4. Para cambiar datos de pago (Yape, cuenta, recargo): admin → **Pagos** → Publicar. Solo la dirección de la tienda y el WhatsApp siguen en el código (`STORE` / `WHATSAPP` en [api/_orders.js](../api/_orders.js) y las constantes de [assets/checkout.js](../assets/checkout.js) y [assets/pedido.js](../assets/pedido.js)).
5. Para probar sin afectar lo publicado: `npm run dev` (modo local, carpeta `.data/`).
