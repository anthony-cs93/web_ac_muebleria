// GET /api/catalog — catálogo publicado (lo que se edita en /admin). Es público: solo lectura.
// Si todavía no se guardó nada responde {} y la tienda usa los valores originales de assets/catalog.js.
import { getPayments, pickActiveHeroes, publicPayments, readCatalog, sendJson } from './_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return sendJson(res, 405, { error: 'Método no permitido' });
  try {
    const full = (await readCatalog()) || {};
    // ?part=heroes: solo la campaña de hero vigente hoy en cada tienda (liviano, para cualquier página)
    if (new URL(req.url, 'http://localhost').searchParams.get('part') === 'heroes') {
      return sendJson(res, 200, { heroes: pickActiveHeroes(full.heroes) }, { 'Cache-Control': 'public, max-age=0, s-maxage=30' });
    }
    const { coupons, heroes, ...data } = full; // los cupones y las campañas programadas no son públicos
    data.payments = publicPayments(getPayments(full));
    return sendJson(res, 200, data, { 'Cache-Control': 'public, max-age=0, s-maxage=10, stale-while-revalidate=60' });
  } catch (err) {
    console.error('catalog read failed', err);
    return sendJson(res, 200, {}, { 'Cache-Control': 'no-store' });
  }
}
