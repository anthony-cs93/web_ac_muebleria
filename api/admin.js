// /api/admin?op=...  — sesión y edición del catálogo (todo protegido con la clave de admin)
//   GET  op=session   estado de la sesión y del almacenamiento
//   POST op=login     { password }  -> cookie de sesión
//   POST op=logout
//   GET  op=catalog   catálogo guardado (sin caché)
//   POST op=save      { maderin?: [...], cdm?: [...], textures?: [...] }  -> publica los cambios
//   POST op=upload    { id, img480, img900 } (data URLs webp/jpeg/png)  -> URLs de las fotos
//   POST op=upload    { kind: 'texture', id, img, thumb }  -> { img, thumb } (textura de la biblioteca compartida)
import {
  adminConfigured, createToken, isAuthed, passwordMatches, readCatalog, readJsonBody, sanitizeShop, sanitizeTextures, sendJson,
  sessionCookie, slugify, storageMode, storePhoto, writeCatalog
} from './_lib.js';

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
      return sendJson(res, 200, (await readCatalog()) || {}, noStore);
    }

    if (req.method === 'POST' && op === 'save') {
      const body = await readJsonBody(req);
      const current = (await readCatalog()) || {};
      const next = { ...current };
      for (const shop of ['maderin', 'cdm']) {
        if (body[shop] !== undefined) next[shop] = sanitizeShop(body[shop], shop);
      }
      if (body.textures !== undefined) next.textures = sanitizeTextures(body.textures);
      next.updatedAt = new Date().toISOString();
      await writeCatalog(next);
      return sendJson(res, 200, { ok: true, updatedAt: next.updatedAt, catalog: next }, noStore);
    }

    if (req.method === 'POST' && op === 'upload') {
      const body = await readJsonBody(req);
      const base = slugify(body.id || 'producto') || 'producto';
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
