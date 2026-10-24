---
description: Cómo subir o editar un producto de Maderin / CDM (ahora se hace desde el panel /admin)
argument-hint: <nombre, categoría, precio, ruta de la foto, descripción...>
---

Los productos de Maderin y Corazón de Madera ya no se agregan editando `maderin.html` ni `assets/main.js`: se administran desde el panel `/admin` (producto nuevo, precio, textos, plazo, disponibilidad, etiqueta, foto y orden). El catálogo publicado vive en Vercel Blob (`/api/catalog`); `assets/catalog.js` solo guarda los valores originales de respaldo.

Datos recibidos: $ARGUMENTS

Qué hacer:

1. Explica al usuario en 2–3 líneas que debe entrar a `/admin` → pestaña de la tienda → **+ Nuevo producto**, y resume los datos que dio (nombre, categoría, precio, descripción) para que los copie.
2. No edites `maderin.html`, `cdm.html` ni el array de `assets/catalog.js` para agregar productos: si el admin ya publicó algo, esos cambios no se verían (el catálogo del admin tiene prioridad).
3. Solo si el usuario pide cambiar los valores originales de respaldo (por ejemplo para resetear la tienda), edita `DEFAULTS` en `assets/catalog.js` y corre `node --check assets/catalog.js`.
