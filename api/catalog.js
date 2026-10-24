// GET /api/catalog — catálogo publicado (lo que se edita en /admin). Es público: solo lectura.
// Si todavía no se guardó nada responde {} y la tienda usa los valores originales de assets/catalog.js.
import { readCatalog, sendJson } from './_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return sendJson(res, 405, { error: 'Método no permitido' });
  try {
    const data = (await readCatalog()) || {};
    return sendJson(res, 200, data, { 'Cache-Control': 'public, max-age=0, s-maxage=10, stale-while-revalidate=60' });
  } catch (err) {
    console.error('catalog read failed', err);
    return sendJson(res, 200, {}, { 'Cache-Control': 'no-store' });
  }
}
