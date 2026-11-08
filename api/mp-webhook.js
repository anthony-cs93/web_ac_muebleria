// /api/mp-webhook — aviso de Mercado Pago cuando se paga un pedido con tarjeta.
// No se confía en lo que llega: se consulta el pago directamente a Mercado Pago con nuestro token.
import { readJsonBody, sendJson } from './_lib.js';
import { findOrderByCode, markPaid, mpConfigured, mpPayment } from './_orders.js';

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, 'http://localhost');
    let body = {};
    try { body = await readJsonBody(req, 50 * 1024); } catch { /* sin cuerpo */ }
    const type = url.searchParams.get('type') || url.searchParams.get('topic') || body.type || body.topic;
    const id = url.searchParams.get('data.id') || url.searchParams.get('id') || (body.data && body.data.id) || body.id;
    if (!mpConfigured() || !id || (type && type !== 'payment')) return sendJson(res, 200, { ok: true });
    const payment = await mpPayment(id);
    if (payment.status === 'approved' && payment.external_reference) {
      const order = await findOrderByCode(String(payment.external_reference));
      if (order && order.payment.method === 'card' && Math.abs(Number(payment.transaction_amount) - order.total) < 0.01) {
        await markPaid(order, `Pago con tarjeta aprobado en Mercado Pago (operación ${payment.id})`, { mpPaymentId: String(payment.id) });
      }
    }
    return sendJson(res, 200, { ok: true });
  } catch (err) {
    console.error('mp webhook error', err);
    return sendJson(res, 500, { error: 'error' }); // Mercado Pago reintenta
  }
}
