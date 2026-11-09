// /api/orders — pedidos de los clientes (público; cada pedido se consulta con su código + token)
//   POST             { shop, name, phone, email?, items:[{id,color,text,qty}], deliveryMode, district?, address?, method, notes? }
//                    -> { code, token, payUrl? }   (method: yape | transfer | card)
//   GET  ?c=&t=      -> estado del pedido (para la página pedido.html); si es con tarjeta, consulta a Mercado Pago
//   POST ?op=coupon  { shop, code, subtotal } -> { amount, label }  (vista previa del descuento de un cupón)
//   POST ?op=proof   { c, t, img }   (data URL del comprobante de Yape o transferencia)
import {
  readJsonBody, sendJson, storePhoto, storageMode
} from './_lib.js';
import { getPayments, readCatalog } from './_lib.js';
import {
  addHistory, buildOrder, evaluateCoupon, mpConfigured, mpCreatePreference, mpSyncOrder, notifyOwner, orderEmailHtml, publicOrder,
  readOrder, saveOrder, siteUrl
} from './_orders.js';

const noStore = { 'Cache-Control': 'no-store' };
const pub = async (order) => publicOrder(order, getPayments(await readCatalog()));

function decodeImage(dataUrl) {
  const m = /^data:(image\/(?:webp|jpeg|png));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl || '');
  if (!m) throw Object.assign(new Error('Sube el comprobante como imagen (JPG, PNG o WebP).'), { status: 400 });
  const buffer = Buffer.from(m[2], 'base64');
  if (buffer.length > 1.5 * 1024 * 1024) throw Object.assign(new Error('La imagen pesa demasiado (máximo 1.5 MB).'), { status: 413 });
  return { buffer, contentType: m[1], ext: m[1].split('/')[1] };
}

export default async function handler(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const op = url.searchParams.get('op');
  try {
    if (storageMode() === 'none') throw Object.assign(new Error('Falta conectar el almacenamiento (Vercel Blob).'), { status: 503 });

    if (req.method === 'GET') {
      let order = await readOrder(url.searchParams.get('c'), url.searchParams.get('t'));
      if (!order) return sendJson(res, 404, { error: 'No encontramos ese pedido.' }, noStore);
      try { order = await mpSyncOrder(order); } catch (e) { console.error('mp sync', e); }
      return sendJson(res, 200, await pub(order), noStore);
    }

    if (req.method === 'POST' && op === 'coupon') {
      const body = await readJsonBody(req, 10 * 1024);
      const subtotal = Number(body.subtotal);
      if (!['maderin', 'cdm'].includes(body.shop) || !Number.isFinite(subtotal) || subtotal < 0) return sendJson(res, 400, { error: 'Datos no válidos.' }, noStore);
      const r = evaluateCoupon((await readCatalog()) || {}, body.shop, body.code, subtotal);
      if (!r.ok) {
        await new Promise((ok) => setTimeout(ok, 500)); // frena la búsqueda de códigos
        return sendJson(res, 400, { error: r.error }, noStore);
      }
      return sendJson(res, 200, { code: r.coupon.code, label: r.label, amount: r.amount }, noStore);
    }

    if (req.method === 'POST' && op === 'proof') {
      const body = await readJsonBody(req, 2.5 * 1024 * 1024);
      const order = await readOrder(body.c, body.t);
      if (!order) return sendJson(res, 404, { error: 'No encontramos ese pedido.' }, noStore);
      if (order.payment.method === 'card') return sendJson(res, 400, { error: 'Este pedido se paga con tarjeta.' }, noStore);
      if (!['pending', 'review'].includes(order.status)) return sendJson(res, 400, { error: 'Este pedido ya no admite comprobantes.' }, noStore);
      const { buffer, contentType, ext } = decodeImage(body.img);
      order.payment.proofUrl = await storePhoto(`comprobante-${order.code}.${ext}`, buffer, contentType);
      order.status = 'review';
      addHistory(order, 'El cliente subió su comprobante de pago');
      await saveOrder(order);
      await notifyOwner(`Comprobante recibido · ${order.code}`, orderEmailHtml(order, 'Comprobante recibido'));
      return sendJson(res, 200, await pub(order), noStore);
    }

    if (req.method === 'POST') {
      const body = await readJsonBody(req, 200 * 1024);
      const order = await buildOrder(body);
      let payUrl = null;
      if (order.payment.method === 'card' && mpConfigured() && process.env.MP_AUTO_LINK === '1') {
        const pref = await mpCreatePreference(order, siteUrl(req));
        order.payment.mpPreferenceId = pref.id;
        order.payment.payUrl = pref.url;
        payUrl = pref.url;
      }
      await saveOrder(order);
      await notifyOwner(`Nuevo pedido · ${order.code}`, orderEmailHtml(order, 'Nuevo pedido'));
      return sendJson(res, 200, { code: order.code, token: order.token, payUrl, whatsappUrl: order.payment.method === 'card' && !payUrl ? (await pub(order)).whatsappUrl : null }, noStore);
    }

    return sendJson(res, 405, { error: 'Método no permitido' }, noStore);
  } catch (err) {
    if (!err.status) console.error('orders api error', err);
    return sendJson(res, err.status || 500, { error: err.status ? err.message : 'Error interno del servidor' }, noStore);
  }
}
