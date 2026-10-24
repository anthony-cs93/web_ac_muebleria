---
description: Sube un producto nuevo a la tienda de Maderin (foto + tarjeta + ficha)
argument-hint: <nombre, categoría, precio, ruta de la foto, descripción...>
---

Sube un producto a la tienda de Maderin con los datos que dio el usuario: $ARGUMENTS

Pasos:

1. Extrae los datos del texto. Obligatorios: nombre, categoría (`camas`, `guardado`, `escritorio` o `accesorios`), ruta de la foto y descripción corta. Si falta alguno obligatorio, pregúntalo en una sola pregunta; no inventes nombre, foto ni categoría. Si falta la descripción, redáctala tú en 1 frase en el tono de las existentes y avísalo.
2. Opcionales: precio (sin precio el producto queda "por confirmar" y se consulta por WhatsApp), precio anterior, disponibilidad (`order` por defecto, `ready`, `out`), tiempo de entrega, medidas, material, edad, subtítulo, badge. No inventes valores: lo que no se dé, se omite.
3. Primero corre en seco para validar:
   `node scripts/add-product.mjs --dry-run --name "..." --category ... --photo "..." --desc "..." [--price N] [--old-price N] [--stock ...] [--delivery "..."] [--dimensions "..."] [--material "..."] [--age "..."]`
4. Si el dry-run sale bien, corre el mismo comando sin `--dry-run`.
5. Verifica: `node --check assets/main.js` y `git diff --stat`. Si hay servidor de preview disponible, comprueba que la tarjeta y el modal del producto se vean bien en `maderin.html#productos`.
6. Resume qué se agregó (id, SKU, precio, disponibilidad) y qué quedó "Por confirmar" en `assets/main.js` (colores, medidas, etc.). No hagas commit salvo que el usuario lo pida.

Si el script falla (id duplicado, foto inexistente), explica el motivo y propone la solución; no edites `maderin.html` ni `assets/main.js` a mano para esquivar el error.
