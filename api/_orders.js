// Pedidos: almacenamiento, validación de precios, Mercado Pago y avisos por email.
// (El prefijo "_" evita que Vercel lo publique como ruta.)
//
// Variables de entorno (además de las del catálogo):
//   MP_ACCESS_TOKEN        token de acceso de producción de Mercado Pago (opción B, tarjeta)
//   RESEND_API_KEY         clave de Resend para los avisos por email (opcional)
//   ORDERS_NOTIFY_EMAIL    email que recibe los avisos de pedidos (por defecto ac.muebles.21@gmail.com)
//   ORDERS_FROM_EMAIL      remitente (por defecto el de pruebas de Resend: solo llega al email de tu cuenta Resend)
//   SITE_URL               https://tu-dominio (opcional; si falta se deduce de la petición)
//
// Cada pedido es un archivo JSON propio: pedidos/<CÓDIGO>-<token>.json. El token es aleatorio (128 bits):
// quien no lo conoce no puede adivinar el archivo, y el listado solo lo hace el admin.

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { DISTRICTS, LOCAL_DATA_DIR, readCatalog, storageMode } from './_lib.js';

export const CARD_FEE = 0.035; // recargo por pago con tarjeta (opción B)
export const STORE = { address: 'Ca. Argentina #201 - Comas', map: 'https://maps.app.goo.gl/jKDX4kuzcDRxq7tb6' };
export const SHOP_INFO = {
  maderin: { name: 'Maderin', prefix: 'MAD' },
  cdm: { name: 'Corazón de Madera', prefix: 'CDM' }
};
// Datos para pagar por Yape o transferencia (opción A); son los mismos para las dos tiendas
export const PAY_INFO = {
  yape: { number: '924486717', holder: 'Anthony Renzo Calderon Salazar', qr: '/public/pagos/yape-qr.jpg' },
  bank: { name: 'BCP', account: '1919214821098', cci: '00219100921482109859', holder: 'Anthony Renzo Calderon Salazar', currency: 'Soles' }
};
export const WHATSAPP = '51943613883';
export const STATUSES = ['pending', 'review', 'paid', 'preparing', 'ready', 'delivered', 'cancelled'];
const PREFIX = 'pedidos/';
const money = (n) => Math.round(n * 100) / 100;
const err = (status, message) => Object.assign(new Error(message), { status });

// ---------------------------------------------------------------- Almacenamiento
const fileOf = (code, token) => `${PREFIX}${code}-${token}.json`;
const CODE_RE = /^[A-Z]{3}-[A-Z0-9]{6}$/;
const TOKEN_RE = /^[a-f0-9]{32}$/;
export const validCode = (c) => typeof c === 'string' && CODE_RE.test(c);
export const validToken = (t) => typeof t === 'string' && TOKEN_RE.test(t);

export async function saveOrder(order) {
  order.updatedAt = new Date().toISOString();
  const body = JSON.stringify(order);
  const mode = storageMode();
  if (mode === 'blob') {
    const { put } = await import('@vercel/blob');
    await put(fileOf(order.code, order.token), body, {
      access: 'public', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true, cacheControlMaxAge: 60
    });
    return order;
  }
  if (mode === 'local') {
    const file = path.join(LOCAL_DATA_DIR, fileOf(order.code, order.token));
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, body);
    return order;
  }
  throw err(503, 'Falta conectar el almacenamiento (Vercel Blob).');
}

async function readByPath(pathname) {
  const mode = storageMode();
  if (mode === 'blob') {
    const { get } = await import('@vercel/blob');
    const r = await get(pathname, { access: 'public', useCache: false });
    if (!r || r.statusCode !== 200) return null;
    return JSON.parse(await new Response(r.stream).text());
  }
  if (mode === 'local') {
    try { return JSON.parse(await fs.readFile(path.join(LOCAL_DATA_DIR, pathname), 'utf8')); } catch { return null; }
  }
  return null;
}

export async function readOrder(code, token) {
  if (!validCode(code) || !validToken(token)) return null;
  try { return await readByPath(fileOf(code, token)); } catch { return null; }
}

async function listPaths(prefix) {
  const mode = storageMode();
  if (mode === 'blob') {
    const { list } = await import('@vercel/blob');
    const out = [];
    let cursor;
    do {
      const r = await list({ prefix, limit: 1000, cursor });
      out.push(...r.blobs.map((b) => ({ pathname: b.pathname, at: new Date(b.uploadedAt).getTime() })));
      cursor = r.hasMore ? r.cursor : undefined;
    } while (cursor && out.length < 3000);
    return out;
  }
  if (mode === 'local') {
    try {
      const dir = path.join(LOCAL_DATA_DIR, PREFIX);
      const names = (await fs.readdir(dir)).filter((n) => n.startsWith(prefix.slice(PREFIX.length)) && n.endsWith('.json'));
      return Promise.all(names.map(async (n) => ({ pathname: PREFIX + n, at: (await fs.stat(path.join(dir, n))).mtimeMs })));
    } catch { return []; }
  }
  return [];
}

export async function findOrderByCode(code) {
  if (!validCode(code)) return null;
  const [first] = await listPaths(`${PREFIX}${code}-`);
  return first ? readByPath(first.pathname) : null;
}

export async function listOrders(limit = 150) {
  const paths = (await listPaths(PREFIX)).sort((a, b) => b.at - a.at).slice(0, limit);
  const orders = [];
  for (let i = 0; i < paths.length; i += 10) {
    const batch = await Promise.all(paths.slice(i, i + 10).map((p) => readByPath(p.pathname).catch(() => null)));
    orders.push(...batch.filter(Boolean));
  }
  return orders.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

// ---------------------------------------------------------------- Creación y validación
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function newCode(shop) {
  let s = '';
  for (let i = 0; i < 6; i++) s += ALPHABET[crypto.randomInt(ALPHABET.length)];
  return `${SHOP_INFO[shop].prefix}-${s}`;
}
const clean = (v, max) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max) : '');

/** Formato de precios: S/1,250 (sin espacio, coma de miles; céntimos solo si los hay). */
export const formatPEN = (n) => {
  const v = Number(n) || 0;
  const abs = Math.abs(v);
  const [int, dec] = (Number.isInteger(abs) ? String(abs) : abs.toFixed(2)).split('.');
  return `${v < 0 ? '-' : ''}S/${int.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}${dec ? `.${dec}` : ''}`;
};
const couponLabel = (c) => (c.type === 'percent' ? `${c.value}% de descuento` : `${formatPEN(c.value)} de descuento`);

/** Comprueba un cupón contra el catálogo y devuelve el descuento sobre el subtotal de productos. */
export function evaluateCoupon(catalog, shop, rawCode, subtotal) {
  const code = String(rawCode || '').trim().toUpperCase();
  const c = (catalog.coupons || []).find((x) => x.code === code);
  if (!c || !c.active) return { ok: false, error: 'Ese cupón no es válido.' };
  if (c.shops && !c.shops.includes(shop)) return { ok: false, error: 'Ese cupón no aplica a esta tienda.' };
  if (c.expires && Date.now() > new Date(`${c.expires}T23:59:59-05:00`).getTime()) return { ok: false, error: 'Ese cupón ya venció.' };
  if (c.minSubtotal && subtotal < c.minSubtotal) return { ok: false, error: `Ese cupón aplica desde una compra de ${formatPEN(c.minSubtotal)}.` };
  const amount = money(Math.min(subtotal, c.type === 'percent' ? (subtotal * c.value) / 100 : c.value));
  return { ok: true, coupon: c, amount, label: couponLabel(c) };
}

/** Plazo estimado de entrega: por producto («4 a 6 días hábiles»); con varios productos se suman. */
function parseDays(text) {
  if (typeof text !== 'string') return null;
  const m = /(\d+)\s*(?:a|-|–|al)\s*(\d+)/i.exec(text) || /(\d+)/.exec(text);
  if (!m) return null;
  const k = /semana/i.test(text) ? 5 : 1;
  const min = Number(m[1]) * k;
  const max = Number(m[2] || m[1]) * k;
  return { min: Math.min(min, max), max: Math.max(min, max), business: /h[aá]bil/i.test(text) || k === 5 };
}
export function estimateEta(products, ids) {
  let min = 0, max = 0, found = 0, business = true;
  for (const id of new Set(ids)) {
    const d = parseDays((products.find((p) => p.id === id) || {}).deliveryTime);
    if (!d) continue;
    min += d.min; max += d.max; found++;
    business = business && d.business;
  }
  if (!found) return null;
  const unit = business ? 'días hábiles' : 'días';
  return { min, max, text: min === max ? `${max} ${unit}` : `${min} a ${max} ${unit}`, products: found };
}

/** Valida el pedido contra el catálogo publicado (los precios los pone el servidor, nunca el navegador). */
export async function buildOrder(body) {
  const shop = body.shop;
  if (!SHOP_INFO[shop]) throw err(400, 'Tienda no válida.');
  if (body.website) throw err(400, 'No se pudo procesar el pedido.'); // trampa para bots
  const catalog = (await readCatalog()) || {};
  const products = Array.isArray(catalog[shop]) ? catalog[shop] : [];
  if (!products.length) throw err(503, 'El catálogo no está disponible. Escríbenos por WhatsApp para tu pedido.');

  const customer = { name: clean(body.name, 80), phone: clean(body.phone, 20).replace(/[^\d+ ]/g, ''), email: clean(body.email, 120) };
  if (customer.name.length < 2) throw err(400, 'Escribe tu nombre.');
  if (customer.phone.replace(/\D/g, '').length < 9) throw err(400, 'Escribe tu celular (9 dígitos).');
  if (customer.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) throw err(400, 'El email no es válido.');

  const rawItems = Array.isArray(body.items) ? body.items.slice(0, 40) : [];
  if (!rawItems.length) throw err(400, 'Tu carrito está vacío.');
  const items = [];
  for (const it of rawItems) {
    const p = products.find((x) => x.id === it.id);
    if (!p || p.hidden || p.price == null || p.stock === 'out') throw err(400, `Un producto del carrito ya no está disponible (${clean(String(it.id), 40)}). Revisa tu carrito.`);
    const qty = Math.round(Number(it.qty));
    if (!Number.isInteger(qty) || qty < 1 || qty > 10) throw err(400, `Cantidad no válida para "${p.name}".`);
    const names = (p.colors || []).filter((c) => c && c.name && c.name !== 'Por definir').map((c) => c.name);
    let color = clean(it.color, 40);
    if (names.length && !names.includes(color)) color = names[0];
    if (!names.length) color = '';
    let text = '';
    let textLabel = '';
    if (shop === 'cdm' && p.custom) {
      text = clean(it.text, p.custom.max || 60);
      textLabel = p.custom.label || 'Personalización';
      if (p.custom.required && !text) throw err(400, `Falta "${textLabel}" en "${p.name}".`);
    }
    const unitPrice = money(Number(p.price));
    const listPrice = p.oldPrice != null && Number(p.oldPrice) > unitPrice ? money(Number(p.oldPrice)) : null;
    items.push({ id: p.id, name: p.name, color, text, textLabel, qty, unitPrice, listPrice, lineTotal: money(unitPrice * qty) });
  }
  const subtotal = money(items.reduce((n, i) => n + i.lineTotal, 0));
  const productDiscount = money(items.reduce((n, i) => n + (i.listPrice ? (i.listPrice - i.unitPrice) * i.qty : 0), 0));
  let coupon = null;
  let discount = 0;
  const couponCode = clean(body.coupon, 30).toUpperCase();
  if (couponCode) {
    const r = evaluateCoupon(catalog, shop, couponCode, subtotal);
    if (!r.ok) throw err(400, r.error);
    coupon = { code: r.coupon.code, label: r.label };
    discount = r.amount;
  }

  let delivery;
  if (body.deliveryMode === 'pickup') {
    delivery = { mode: 'pickup', address: STORE.address, district: 'Comas', cost: 0 };
  } else if (body.deliveryMode === 'delivery') {
    const district = clean(body.district, 60);
    const rule = (catalog.shipping && catalog.shipping[shop] && catalog.shipping[shop][district]) || null;
    if (!DISTRICTS.includes(district) || !rule || !rule.ok) throw err(400, 'No realizamos envíos a ese distrito. Elige otro o recoge en tienda.');
    const address = clean(body.address, 160);
    if (address.length < 5) throw err(400, 'Escribe la dirección de entrega.');
    delivery = { mode: 'delivery', address, district, cost: money(rule.cost) };
  } else {
    throw err(400, 'Elige recojo en tienda o envío a domicilio.');
  }

  const method = body.method;
  if (!['yape', 'transfer', 'card'].includes(method)) throw err(400, 'Elige cómo vas a pagar.');
  const fee = method === 'card' ? money((subtotal - discount + delivery.cost) * CARD_FEE) : 0;
  const total = money(subtotal - discount + delivery.cost + fee);

  let invoice = null;
  if (body.boleta) {
    const dni = clean(String(body.dni || ''), 8);
    if (!/^\d{8}$/.test(dni)) throw err(400, 'Para la boleta escribe tu DNI (8 dígitos).');
    invoice = { type: 'boleta', dni };
  }
  const now = new Date().toISOString();
  return {
    code: newCode(shop),
    token: crypto.randomBytes(16).toString('hex'),
    shop,
    createdAt: now,
    status: 'pending',
    customer,
    delivery,
    items,
    subtotal,
    productDiscount,
    coupon,
    discount,
    shipping: delivery.cost,
    fee,
    total,
    eta: estimateEta(products, items.map((i) => i.id)),
    invoice,
    notes: clean(body.notes, 300),
    payment: { method },
    history: [{ at: now, text: 'Pedido creado' }]
  };
}

/** Lo que ve el cliente en la página del pedido. */
/** Fecha en que el pedido llegó a cada estado (deducida del historial), para mostrarla en el seguimiento. */
function statusTimes(o) {
  const times = { pending: o.createdAt };
  for (const h of o.history || []) {
    const m = /«(\w+)»/.exec(h.text || '');
    if (m && STATUSES.includes(m[1])) times[m[1]] = times[m[1]] || h.at;
    else if (/comprobante/i.test(h.text || '')) times.review = times.review || h.at;
    else if (/Pago con tarjeta aprobado/i.test(h.text || '')) times.paid = times.paid || h.at;
  }
  if (o.status === 'cancelled' && o.cancelledAt) times.cancelled = o.cancelledAt;
  return times;
}

export function publicOrder(o) {
  return {
    code: o.code, shop: o.shop, status: o.status, createdAt: o.createdAt, customer: { name: o.customer.name },
    delivery: o.delivery, items: o.items, subtotal: o.subtotal, productDiscount: o.productDiscount || 0, coupon: o.coupon || null, discount: o.discount || 0,
    shipping: o.shipping, fee: o.fee, total: o.total, notes: o.notes, eta: o.eta || null, boleta: !!o.invoice,
    payment: { method: o.payment.method, proofUrl: o.payment.proofUrl || null, payUrl: o.status === 'pending' ? o.payment.payUrl || null : null },
    payInfo: o.payment.method === 'card' ? null : PAY_INFO,
    whatsappUrl: o.payment.method === 'card' ? cardWhatsAppUrl(o) : null,
    times: statusTimes(o),
    store: STORE, shopName: SHOP_INFO[o.shop].name
  };
}

/** Mensaje de WhatsApp para solicitar el link de pago con tarjeta (resumen del pedido + monto a pagar). */
export function cardWhatsAppUrl(o) {
  const money2 = formatPEN;
  const lines = o.items.map((i) => `• ${i.qty} × ${i.name}${i.color ? ` (${i.color})` : ''}${i.text ? ` — ${i.textLabel}: "${i.text}"` : ''} — ${money2(i.lineTotal)}`);
  const d = o.delivery;
  const msg = [
    `Hola ${SHOP_INFO[o.shop].name}, quiero pagar con tarjeta. ¿Me envían el link de pago?`,
    '',
    `Pedido ${o.code}`,
    ...lines,
    '',
    `Subtotal: ${money2(o.subtotal)}`,
    ...(o.discount ? [`Cupón ${o.coupon ? o.coupon.code : ''}: -${money2(o.discount)}`] : []),
    d.mode === 'pickup' ? 'Entrega: Recojo en tienda' : `Envío (${d.district}): ${money2(o.shipping)}`,
    `Recargo por tarjeta (3.5%): ${money2(o.fee)}`,
    `TOTAL A PAGAR: ${money2(o.total)}`,
    '',
    `Nombre: ${o.customer.name} · Cel: ${o.customer.phone}`,
    ...(d.mode === 'delivery' ? [`Dirección: ${d.address}, ${d.district}`] : []),
    ...(o.eta ? [`Plazo estimado: ${o.eta.text}`] : []),
    ...(o.invoice ? ['Solicita boleta (DNI en el pedido)'] : []),
    ...(o.notes ? [`Nota: ${o.notes}`] : [])
  ].join('\n');
  return `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(msg)}`;
}

export function addHistory(order, text) {
  (order.history = order.history || []).push({ at: new Date().toISOString(), text });
}

// ---------------------------------------------------------------- Mercado Pago (opción B)
export const mpConfigured = () => !!process.env.MP_ACCESS_TOKEN;
const mpFetch = async (url, opts = {}) => {
  const res = await fetch(url, {
    ...opts,
    headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`, 'Content-Type': 'application/json', ...(opts.headers || {}) }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw err(502, `Mercado Pago: ${data.message || res.status}`);
  return data;
};

export function siteUrl(req) {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, '');
  const proto = (req.headers['x-forwarded-proto'] || 'http').split(',')[0];
  return `${proto}://${req.headers['x-forwarded-host'] || req.headers.host}`;
}

/** Crea el link de pago por el monto exacto del pedido. */
export async function mpCreatePreference(order, base) {
  const https = base.startsWith('https://');
  const back = (state) => `${base}/pedido.html?c=${order.code}&t=${order.token}&mp=${state}`;
  const body = {
    items: [{ id: order.code, title: `Pedido ${order.code} · ${SHOP_INFO[order.shop].name}`, quantity: 1, currency_id: 'PEN', unit_price: order.total }],
    payer: { name: order.customer.name, ...(order.customer.email ? { email: order.customer.email } : {}) },
    external_reference: order.code,
    statement_descriptor: 'AC MUEBLERIA',
    back_urls: { success: back('ok'), failure: back('fail'), pending: back('pending') },
    ...(https ? { auto_return: 'approved', notification_url: `${base}/api/mp-webhook` } : {})
  };
  const pref = await mpFetch('https://api.mercadopago.com/checkout/preferences', { method: 'POST', body: JSON.stringify(body) });
  return { id: pref.id, url: pref.init_point };
}

/** Marca el pedido como pagado si Mercado Pago tiene un pago aprobado por el monto del pedido. */
export async function mpSyncOrder(order) {
  if (!mpConfigured() || order.payment.method !== 'card' || order.status !== 'pending') return order;
  const r = await mpFetch(`https://api.mercadopago.com/v1/payments/search?external_reference=${encodeURIComponent(order.code)}&sort=date_created&criteria=desc`);
  const ok = (r.results || []).find((p) => p.status === 'approved' && Math.abs(Number(p.transaction_amount) - order.total) < 0.01);
  if (!ok) return order;
  return markPaid(order, `Pago con tarjeta aprobado en Mercado Pago (operación ${ok.id})`, { mpPaymentId: String(ok.id) });
}

export async function mpPayment(id) {
  return mpFetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(id)}`);
}

export async function markPaid(order, note, extra = {}) {
  if (['paid', 'preparing', 'ready', 'delivered', 'cancelled'].includes(order.status)) return order;
  order.status = 'paid';
  order.payment = { ...order.payment, ...extra, paidAt: new Date().toISOString() };
  addHistory(order, note);
  await saveOrder(order);
  await notifyOwner(`Pago confirmado · ${order.code}`, orderEmailHtml(order, 'Pago confirmado'));
  return order;
}

// ---------------------------------------------------------------- Aviso por email (Resend)
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const PAY_LABEL = { yape: 'Yape', transfer: 'Transferencia bancaria', card: 'Tarjeta (Mercado Pago)' };

export function orderEmailHtml(o, headline) {
  const rows = o.items.map((i) =>
    `<tr><td>${i.qty} × ${esc(i.name)}${i.color ? ` (${esc(i.color)})` : ''}${i.text ? `<br><small>${esc(i.textLabel)}: “${esc(i.text)}”</small>` : ''}</td><td align="right">${formatPEN(i.lineTotal)}</td></tr>`).join('');
  const d = o.delivery;
  return `<div style="font-family:Arial,sans-serif;max-width:560px">
    <h2>${esc(headline)} · ${esc(o.code)}</h2>
    <p><b>${esc(SHOP_INFO[o.shop].name)}</b> — ${esc(o.customer.name)} · ${esc(o.customer.phone)}${o.customer.email ? ` · ${esc(o.customer.email)}` : ''}</p>
    <table width="100%" cellpadding="4" style="border-collapse:collapse;border-top:1px solid #ddd">${rows}
      <tr><td>Envío</td><td align="right">${formatPEN(o.shipping)}</td></tr>
      ${o.discount ? `<tr><td>Cupón ${esc(o.coupon ? o.coupon.code : '')}</td><td align="right">- ${formatPEN(o.discount)}</td></tr>` : ''}
      ${o.fee ? `<tr><td>Recargo tarjeta</td><td align="right">${formatPEN(o.fee)}</td></tr>` : ''}
      <tr><td><b>Total</b></td><td align="right"><b>${formatPEN(o.total)}</b></td></tr></table>
    <p><b>Pago:</b> ${esc(PAY_LABEL[o.payment.method])}<br>
    <b>Entrega:</b> ${d.mode === 'pickup' ? 'Recojo en tienda' : `Envío a domicilio — ${esc(d.address)}, ${esc(d.district)}`}</p>
    ${o.eta ? `<p><b>Plazo estimado:</b> ${esc(o.eta.text)}</p>` : ''}
    ${o.invoice ? `<p><b>Boleta:</b> DNI ${esc(o.invoice.dni)}</p>` : ''}
    ${o.notes ? `<p><b>Nota:</b> ${esc(o.notes)}</p>` : ''}
    ${o.payment.proofUrl ? `<p><a href="${esc(o.payment.proofUrl)}">Ver comprobante de pago</a></p>` : ''}
    <p style="color:#666;font-size:12px">Gestiona el pedido en el panel /admin → Pedidos.</p></div>`;
}

export async function notifyOwner(subject, html) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.ORDERS_FROM_EMAIL || 'AC Mueblería <onboarding@resend.dev>',
        to: [process.env.ORDERS_NOTIFY_EMAIL || 'ac.muebles.21@gmail.com'],
        subject,
        html
      })
    });
    if (!res.ok) console.error('email no enviado', res.status, await res.text().catch(() => ''));
    return res.ok;
  } catch (e) {
    console.error('email no enviado', e);
    return false;
  }
}
