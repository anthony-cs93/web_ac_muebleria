// Utilidades compartidas de la API (el prefijo "_" evita que Vercel lo publique como ruta).
//
// Almacenamiento:
//   - En Vercel: Vercel Blob (BLOB_READ_WRITE_TOKEN o, en stores nuevos, BLOB_STORE_ID con autenticación OIDC; ambos los crea Vercel al conectar un Blob store público).
//   - En local (sin token): carpeta .data/ del proyecto, para poder probar el admin sin Vercel.
//
// Variables de entorno:
//   ADMIN_PASSWORD  clave para entrar a /admin (obligatoria)
//   ADMIN_SECRET    secreto para firmar la sesión (opcional; si falta se deriva de ADMIN_PASSWORD)

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOCAL_DIR = path.join(ROOT, '.data');
const CATALOG_PATH = 'catalog.json';
const SESSION_HOURS = 12;
export const COOKIE_NAME = 'ac_admin';

export const storageMode = () =>
  process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID ? 'blob' : process.env.VERCEL ? 'none' : 'local';

// ---------------------------------------------------------------- Respuestas
export function sendJson(res, status, body, headers = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end(JSON.stringify(body));
}

export async function readJsonBody(req, limitBytes = 4 * 1024 * 1024) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}');
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limitBytes) throw Object.assign(new Error('Cuerpo demasiado grande'), { status: 413 });
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  return text ? JSON.parse(text) : {};
}

// ---------------------------------------------------------------- Sesión
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest();
const secret = () => `ac-admin:${process.env.ADMIN_SECRET || process.env.ADMIN_PASSWORD || ''}`;
const b64 = (buf) => Buffer.from(buf).toString('base64url');

export const adminConfigured = () => !!process.env.ADMIN_PASSWORD;

export function passwordMatches(candidate) {
  if (!adminConfigured() || typeof candidate !== 'string') return false;
  return crypto.timingSafeEqual(sha(candidate), sha(process.env.ADMIN_PASSWORD));
}

export function createToken() {
  const payload = b64(JSON.stringify({ exp: Date.now() + SESSION_HOURS * 3600 * 1000 }));
  const sig = b64(crypto.createHmac('sha256', secret()).update(payload).digest());
  return `${payload}.${sig}`;
}

function verifyToken(token) {
  if (!adminConfigured() || typeof token !== 'string') return false;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return false;
  const expected = b64(crypto.createHmac('sha256', secret()).update(payload).digest());
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString()).exp > Date.now();
  } catch {
    return false;
  }
}

function parseCookies(header = '') {
  return Object.fromEntries(
    header.split(';').map((c) => c.trim()).filter(Boolean).map((c) => {
      const i = c.indexOf('=');
      return [c.slice(0, i), decodeURIComponent(c.slice(i + 1))];
    })
  );
}

export const isAuthed = (req) => verifyToken(parseCookies(req.headers.cookie)[COOKIE_NAME]);

export function sessionCookie(req, token, maxAge = SESSION_HOURS * 3600) {
  const secure = (req.headers['x-forwarded-proto'] || '').split(',')[0] === 'https' ? '; Secure' : '';
  return `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=${maxAge}${secure}`;
}

// ---------------------------------------------------------------- Almacenamiento
export async function readCatalog() {
  const mode = storageMode();
  if (mode === 'blob') {
    const { get } = await import('@vercel/blob');
    const result = await get(CATALOG_PATH, { access: 'public', useCache: false });
    if (!result || result.statusCode !== 200) return null;
    return JSON.parse(await new Response(result.stream).text());
  }
  if (mode === 'local') {
    try {
      return JSON.parse(await fs.readFile(path.join(LOCAL_DIR, CATALOG_PATH), 'utf8'));
    } catch {
      return null;
    }
  }
  return null;
}

export async function writeCatalog(data) {
  const mode = storageMode();
  const body = JSON.stringify(data);
  if (mode === 'blob') {
    const { put } = await import('@vercel/blob');
    await put(CATALOG_PATH, body, {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 60
    });
    return;
  }
  if (mode === 'local') {
    await fs.mkdir(LOCAL_DIR, { recursive: true });
    await fs.writeFile(path.join(LOCAL_DIR, CATALOG_PATH), body);
    return;
  }
  throw Object.assign(new Error('Falta conectar el Blob store de Vercel (BLOB_READ_WRITE_TOKEN).'), { status: 503 });
}

export async function storePhoto(name, buffer, contentType) {
  const mode = storageMode();
  if (mode === 'blob') {
    const { put } = await import('@vercel/blob');
    const blob = await put(`fotos/${name}`, buffer, { access: 'public', contentType, addRandomSuffix: true });
    return blob.url;
  }
  if (mode === 'local') {
    const dir = path.join(LOCAL_DIR, 'fotos');
    await fs.mkdir(dir, { recursive: true });
    const file = `${Date.now().toString(36)}-${name}`;
    await fs.writeFile(path.join(dir, file), buffer);
    return `/uploads/${file}`;
  }
  throw Object.assign(new Error('Falta conectar el Blob store de Vercel (BLOB_READ_WRITE_TOKEN).'), { status: 503 });
}

export const LOCAL_UPLOADS_DIR = path.join(LOCAL_DIR, 'fotos');

// ---------------------------------------------------------------- Validación del catálogo
const CATEGORIES = {
  maderin: ['camas', 'guardado', 'escritorio', 'accesorios'],
  cdm: ['decoracion', 'organizadores', 'recuerdos']
};
const STOCKS = ['order', 'ready', 'out'];
const MAX_PRODUCTS = 150;

const text = (v, max = 600) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const optText = (v, max) => text(v, max) || null;
const money = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n < 1e6 ? Math.round(n * 100) / 100 : null;
};
const safeUrl = (v) => (typeof v === 'string' && /^(https:\/\/[^\s"'<>]+|\/uploads\/[\w.\-]+)$/.test(v) ? v : undefined);
const safeSlug = (v) => (typeof v === 'string' && /^[a-z0-9][a-z0-9-]{0,80}$/.test(v) ? v : undefined);
const safeSvg = (v) =>
  typeof v === 'string' && v.length < 4000 && /^<svg[\s\S]*<\/svg>$/.test(v) && !/<script|<foreignObject|\son\w+\s*=|javascript:/i.test(v) ? v : undefined;

export function sanitizeProduct(raw, shop) {
  if (!raw || typeof raw !== 'object') return null;
  const id = safeSlug(raw.id);
  const name = text(raw.name, 120);
  if (!id || !name) return null;
  const p = {
    id,
    name,
    category: CATEGORIES[shop].includes(raw.category) ? raw.category : CATEGORIES[shop][0],
    desc: text(raw.desc, 1200),
    price: money(raw.price),
    oldPrice: money(raw.oldPrice),
    badge: optText(raw.badge, 30),
    stock: STOCKS.includes(raw.stock) ? raw.stock : 'order',
    deliveryTime: optText(raw.deliveryTime, 80),
    hidden: !!raw.hidden,
    photo: safeSlug(raw.photo),
    img480: safeUrl(raw.img480),
    img900: safeUrl(raw.img900),
    svg: safeSvg(raw.svg),
    rating: raw.rating === null || raw.rating === undefined || raw.rating === '' ? null : Math.min(5, Math.max(0, Number(raw.rating) || 0)),
    reviewsCount: Math.max(0, Math.round(Number(raw.reviewsCount) || 0))
  };
  if (shop === 'maderin') {
    Object.assign(p, {
      sku: optText(raw.sku, 30),
      subtitle: text(raw.subtitle, 120),
      cardDesc: text(raw.cardDesc, 300),
      dimensions: text(raw.dimensions, 120),
      material: text(raw.material, 120),
      ageRange: text(raw.ageRange, 60),
      finish: text(raw.finish, 160),
    });
  } else {
    Object.assign(p, {
      specs: (Array.isArray(raw.specs) ? raw.specs : []).slice(0, 4).map((s) => text(s, 60)).filter(Boolean),
      unit: text(raw.unit, 20) || 'unidad'
    });
  }
  p.colors = (Array.isArray(raw.colors) ? raw.colors : []).slice(0, 12).map((c) => ({
    name: text(c && c.name, 40),
    hex: /^#[0-9a-f]{3,8}$/i.test(c && c.hex) ? c.hex : '#E5DCCB',
    tex: safeSlug(c && c.tex)
  })).filter((c) => c.name).map((c) => { if (c.tex === undefined) delete c.tex; return c; });
  for (const k of Object.keys(p)) if (p[k] === undefined) delete p[k];
  return p;
}

// Biblioteca de texturas compartida por las dos tiendas (máx. 10)
export const MAX_TEXTURES = 10;
export function sanitizeTextures(list) {
  if (!Array.isArray(list)) throw Object.assign(new Error('Lista de texturas inválida'), { status: 400 });
  const seen = new Set();
  const out = [];
  for (const raw of list.slice(0, MAX_TEXTURES)) {
    const id = safeSlug(raw && raw.id);
    const name = text(raw && raw.name, 40);
    const img = safeUrl(raw && raw.img);
    if (!id || !name || !img || seen.has(id)) continue;
    seen.add(id);
    out.push({ id, name, img });
  }
  return out;
}

export function sanitizeShop(list, shop) {
  if (!Array.isArray(list) || list.length > MAX_PRODUCTS) throw Object.assign(new Error('Lista de productos inválida'), { status: 400 });
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const p = sanitizeProduct(raw, shop);
    if (!p || seen.has(p.id)) continue;
    seen.add(p.id);
    out.push(p);
  }
  return out;
}

export const slugify = (s) =>
  String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
