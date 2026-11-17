// /api/admin?op=...  — sesión y edición del catálogo (todo protegido con la clave de admin)
//   GET  op=session   estado de la sesión y del almacenamiento
//   POST op=login     { password }  -> cookie de sesión
//   POST op=logout
//   GET  op=catalog   catálogo guardado (sin caché)
//   POST op=save      { maderin?: [...], cdm?: [...], textures?: [...], shipping?: {...}, coupons?: [...], heroes?: [...], payments?: {...} }  -> publica los cambios
//   GET  op=orders    pedidos de los clientes (más recientes primero)
//   POST op=order-update { code, status?, note? }  -> cambia el estado de un pedido
//   POST op=order-edit   { code, name, phone, email, deliveryMode, district, address, shipping, discount, notes, dni?, items:[{qty,color,text}] }
//                        -> edita los datos del pedido y recalcula los totales (qty 0 quita el producto)
//   POST op=upload    { id, img480, img900 } (data URLs webp/jpeg/png)  -> URLs de las fotos
//   POST op=upload    { kind: 'texture', id, img, thumb }  -> { img, thumb } (textura de la biblioteca compartida)
import {
  adminConfigured, createToken, isAuthed, passwordMatches, readCatalog, readJsonBody, sanitizeCoupons, sanitizeHeroes, sanitizePayments, getPayments, sanitizeShipping, sanitizeShop, sanitizeTextures,
  sendJson, sessionCookie, slugify, storageMode, storePhoto, writeCatalog
} from './_lib.js';
import { STATUSES, addHistory, findOrderByCode, listOrders, mpSyncOrder, saveOrder, validCode } from './_orders.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function decodeImage(dataUrl) {
  const m = /^data:(image\/(?:webp|jpeg|png));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl || '');
  if (!m) throw Object.assign(new Error('Imagen inválida (usa JPG, PNG o WebP)'), { status: 400 });
  const buffer = Buffer.from(m[2], 'base64');
  if (buffer.length > 1.5 * 1024 * 1024) throw Object.assign(new Error('La imagen pesa demasiado'), { status: 413 });
  return { buffer, contentType: m[1], ext: m[1].split('/')[1] };
}

export default async function handler(req, res) {
  const op = new URL(req.url, 'http://localhost').searchParams.get('op');
  const noStore = { 'Cache-Control': 'no-store' };
  try {
    if (req.method === 'GET' && op === 'session') {
      return sendJson(res, 200, { authenticated: isAuthed(req), configured: adminConfigured(), storage: storageMode() }, noStore);
    }

    if (req.method === 'POST' && op === 'login') {
      if (!adminConfigured()) return sendJson(res, 503, { error: 'Falta definir ADMIN_PASSWORD en las variables de entorno.' }, noStore);
      const { password } = await readJsonBody(req, 10 * 1024);
      if (!passwordMatches(password)) {
        await wait(700); // frena intentos por fuerza bruta
        return sendJson(res, 401, { error: 'Clave incorrecta' }, noStore);
      }
      return sendJson(res, 200, { ok: true }, { ...noStore, 'Set-Cookie': sessionCookie(req, createToken()) });
    }

    if (req.method === 'POST' && op === 'logout') {
      return sendJson(res, 200, { ok: true }, { ...noStore, 'Set-Cookie': sessionCookie(req, '', 0) });
    }

    if (!isAuthed(req)) return sendJson(res, 401, { error: 'No autorizado' }, noStore);

    if (req.method === 'GET' && op === 'catalog') {
      const cat = (await readCatalog()) || {};
      return sendJson(res, 200, { ...cat, payments: getPayments(cat) }, noStore);
    }

    if (req.method === 'POST' && op === 'save') {
      const body = await readJsonBody(req);
      const current = (await readCatalog()) || {};
      const next = { ...current };
      for (const shop of ['maderin', 'cdm']) {
        if (body[shop] !== undefined) next[shop] = sanitizeShop(body[shop], shop);
      }
      if (body.textures !== undefined) next.textures = sanitizeTextures(body.textures);
      if (body.shipping !== undefined) next.shipping = sanitizeShipping(body.shipping);
      if (body.coupons !== undefined) next.coupons = sanitizeCoupons(body.coupons);
      if (body.heroes !== undefined) next.heroes = sanitizeHeroes(body.heroes);
      if (body.payments !== undefined) next.payments = sanitizePayments(body.payments);
      next.updatedAt = new Date().toISOString();
      await writeCatalog(next);
      return sendJson(res, 200, { ok: true, updatedAt: next.updatedAt, catalog: next }, noStore);
    }

    if (req.method === 'GET' && op === 'orders') {
      // Los pedidos cancelados se muestran durante 30 días desde la cancelación (siguen guardados)
      const cutoff = Date.now() - 30 * 24 * 3600 * 1000;
      const orders = (await listOrders()).filter((o) => o.status !== 'cancelled' || Date.parse(o.cancelledAt || o.updatedAt || o.createdAt) >= cutoff);
      // Pagos con tarjeta aún pendientes: se confirman con Mercado Pago (por si el aviso automático no llegó)
      const synced = await Promise.all(orders.map((o) => (o.payment.method === 'card' && o.status === 'pending' ? mpSyncOrder(o).catch(() => o) : o)));
      return sendJson(res, 200, { orders: synced }, noStore);
    }

    if (req.method === 'POST' && op === 'order-update') {
      const body = await readJsonBody(req, 20 * 1024);
      const order = validCode(body.code) ? await findOrderByCode(body.code) : null;
      if (!order) return sendJson(res, 404, { error: 'Pedido no encontrado' }, noStore);
      if (body.status !== undefined) {
        if (!STATUSES.includes(body.status)) return sendJson(res, 400, { error: 'Estado no válido' }, noStore);
        if (body.status !== order.status) {
          order.status = body.status;
          if (body.status === 'paid') order.payment.paidAt = new Date().toISOString();
          if (body.status === 'cancelled') order.cancelledAt = new Date().toISOString();
          else delete order.cancelledAt;
          addHistory(order, `Estado cambiado a «${body.status}» desde el admin`);
        }
      }
      if (typeof body.note === 'string' && body.note.trim()) addHistory(order, `Nota: ${body.note.trim().slice(0, 300)}`);
      await saveOrder(order);
      return sendJson(res, 200, { order }, noStore);
    }

    if (req.method === 'POST' && op === 'order-edit') {
      const body = await readJsonBody(req, 40 * 1024);
      const order = validCode(body.code) ? await findOrderByCode(body.code) : null;
      if (!order) return sendJson(res, 404, { error: 'Pedido no encontrado' }, noStore);
      const bad = (msg) => sendJson(res, 400, { error: msg }, noStore);
      const txt = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);
      const num = (v) => Math.round(Number(v) * 100) / 100;

      const name = txt(body.name, 80);
      const phone = txt(body.phone, 20).replace(/[^\d+ ]/g, '');
      const email = txt(body.email, 120);
      if (name.length < 2) return bad('Escribe el nombre del cliente.');
      if (phone.replace(/\D/g, '').length < 9) return bad('El celular debe tener 9 dígitos.');
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return bad('El email no es válido.');

      const mode = body.deliveryMode === 'pickup' ? 'pickup' : 'delivery';
      const address = txt(body.address, 160);
      if (mode === 'delivery' && address.length < 5) return bad('Escribe la dirección de entrega.');
      const shipping = num(body.shipping);
      const discount = num(body.discount || 0);
      if (!Number.isFinite(shipping) || shipping < 0 || !Number.isFinite(discount) || discount < 0) return bad('Envío y descuento deben ser montos válidos.');

      const edits = Array.isArray(body.items) ? body.items : [];
      if (edits.length !== order.items.length) return bad('La lista de productos cambió. Vuelve a abrir el pedido.');
      const items = [];
      for (let i = 0; i < edits.length; i++) {
        const qty = Math.round(Number(edits[i].qty));
        if (qty === 0) continue; // cantidad 0 = quitar el producto
        if (!Number.isInteger(qty) || qty < 0 || qty > 99) return bad(`Cantidad no válida en «${order.items[i].name}».`);
        const old = order.items[i];
        items.push({ ...old, qty, color: old.color ? txt(edits[i].color, 40) : '', text: old.textLabel ? txt(edits[i].text, 120) : old.text, lineTotal: num(old.unitPrice * qty) });
      }
      if (!items.length) return bad('El pedido necesita al menos un producto. Para anularlo usa «Cancelar pedido».');

      const subtotal = num(items.reduce((n, i) => n + i.lineTotal, 0));
      if (discount > subtotal) return bad('El descuento no puede superar el subtotal.');
      const feeRate = order.feeRate || 0;
      const fee = num((subtotal - discount + shipping) * feeRate / 100);
      const total = num(subtotal - discount + shipping + fee);
      const before = order.total;

      order.customer = { name, phone, email };
      order.delivery = { ...order.delivery, mode, address: mode === 'pickup' ? order.delivery.address : address, district: txt(body.district, 60) || order.delivery.district, cost: shipping };
      order.items = items;
      order.subtotal = subtotal;
      order.productDiscount = num(items.reduce((n, i) => n + (i.listPrice ? (i.listPrice - i.unitPrice) * i.qty : 0), 0));
      order.discount = discount;
      if (!discount) order.coupon = null;
      order.shipping = shipping;
      order.fee = fee;
      order.total = total;
      order.notes = txt(body.notes, 300);
      if (body.dni !== undefined) {
        const dni = txt(body.dni, 8);
        if (dni && !/^\d{8}$/.test(dni)) return bad('El DNI debe tener 8 dígitos.');
        order.invoice = dni ? { type: 'boleta', dni } : null;
      }
      addHistory(order, before !== total ? `Pedido editado desde el admin (total ${before} → ${total})` : 'Pedido editado desde el admin');
      await saveOrder(order);
      return sendJson(res, 200, { order }, noStore);
    }

    if (req.method === 'POST' && op === 'upload') {
      const body = await readJsonBody(req);
      const base = slugify(body.id || 'producto') || 'producto';
      if (body.kind === 'hero') {
        const { buffer, contentType, ext } = decodeImage(body.img);
        return sendJson(res, 200, { img: await storePhoto(`hero-${base}.${ext}`, buffer, contentType) }, noStore);
      }
      if (body.kind === 'payment-qr') {
        const { buffer, contentType, ext } = decodeImage(body.img);
        return sendJson(res, 200, { img: await storePhoto(`yape-qr.${ext}`, buffer, contentType) }, noStore);
      }
      if (body.kind === 'texture') {
        const big = decodeImage(body.img);
        const out = { img: await storePhoto(`textura-${base}.${big.ext}`, big.buffer, big.contentType) };
        if (body.thumb) {
          const small = decodeImage(body.thumb);
          out.thumb = await storePhoto(`textura-${base}-mini.${small.ext}`, small.buffer, small.contentType);
        }
        return sendJson(res, 200, out, noStore);
      }
      const out = {};
      for (const [key, w] of [['img480', 480], ['img900', 900]]) {
        if (!body[key]) continue;
        const { buffer, contentType, ext } = decodeImage(body[key]);
        out[key] = await storePhoto(`${base}-${w}.${ext}`, buffer, contentType);
      }
      if (!out.img480 && !out.img900) return sendJson(res, 400, { error: 'No llegó ninguna imagen' }, noStore);
      return sendJson(res, 200, out, noStore);
    }

    return sendJson(res, 404, { error: 'Operación no encontrada' }, noStore);
  } catch (err) {
    console.error('admin api error', err);
    return sendJson(res, err.status || 500, { error: err.status ? err.message : 'Error interno del servidor' }, noStore);
  }
}
