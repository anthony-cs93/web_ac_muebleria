// ============================================================
// Agrega un producto a la tienda de Maderin
// Uso:   npm run producto -- --name "Cama Nido" --category camas --price 450 --photo "C:/fotos/cama.jpg"
//        npm run producto            (modo interactivo: te pregunta cada dato)
// Qué hace:
//   1. Genera public/maderin/productos/<id>-480.webp y -900.webp con sharp
//   2. Inserta la tarjeta en maderin.html (grilla #maderinProductGrid)
//   3. Inserta el objeto en el array maderinProducts de assets/main.js
// Sin --price el producto queda "por confirmar": se consulta por WhatsApp y no entra al carrito.
// Con --dry-run solo muestra lo que haría, sin escribir nada.
// ============================================================

import fs from 'fs';
import path from 'path';
import readline from 'readline/promises';
import sharp from 'sharp';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HTML_PATH = path.join(ROOT, 'maderin.html');
const JS_PATH = path.join(ROOT, 'assets/main.js');
const PHOTO_DIR = path.join(ROOT, 'public/maderin/productos');

const CATEGORIES = {
  camas: { label: 'Camas Montessori', code: 'CAM', svg: '<path d="M6 34V20l18-12 18 12v14"/><path d="M6 34h36M12 34v6M36 34v6"/><path d="M12 24h24"/>' },
  guardado: { label: 'Guardado & Orden', code: 'GUA', svg: '<rect x="8" y="8" width="32" height="32" rx="2"/><line x1="8" y1="24" x2="40" y2="24"/>' },
  escritorio: { label: 'Escritorios & Mesas', code: 'ESC', svg: '<rect x="6" y="14" width="36" height="5" rx="1"/><path d="M10 19v19M38 19v19"/>' },
  accesorios: { label: 'Accesorios & Estimulación', code: 'ACC', svg: '<path d="M16 42L24 6l8 36"/><line x1="19" y1="22" x2="29" y2="22"/><line x1="14" y1="36" x2="34" y2="36"/>' },
};
const STOCKS = ['order', 'ready', 'out'];

const WA_ICON = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5.1-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.4-.7-1.7-.8-.2-.1-.4-.1-.6.1-.2.2-.6.8-.8 1-.1.2-.3.2-.5.1-.7-.3-1.4-.7-2-1.3-.5-.5-1-1.1-1.4-1.8-.1-.2 0-.4.1-.5l.4-.5c.1-.2.2-.3.2-.5.1-.2 0-.4 0-.5-.1-.1-.6-1.5-.9-2-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.7.7-1 1.6-1 2.6.1 1.2.6 2.4 1.4 3.4 1.5 2 3.4 3.5 5.7 4.2.7.2 1.3.2 1.9.1.6-.1 1.4-.6 1.6-1.2.2-.5.2-1 .1-1.1-.1-.2-.3-.2-.5-.3Z"/></svg>';
const CART_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2 3h3l2.7 11.2a1.6 1.6 0 0 0 1.6 1.2h8.4a1.6 1.6 0 0 0 1.6-1.2L21 7H6"/></svg>';
const SEARCH_ICON = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/><path d="M11 8v6M8 11h6"/></svg>';

const fail = (msg) => { console.error(`\n✗ ${msg}`); process.exit(1); };
const escHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const jsStr = (s) => JSON.stringify(s);
const slugify = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// ---------- Argumentos ----------
function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const key = argv[i].slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) out[key] = true;
    else { out[key] = next; i++; }
  }
  return out;
}

async function askMissing(args) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = async (key, question, { required = false, fallback = '' } = {}) => {
    if (args[key] !== undefined) return;
    const suffix = fallback ? ` [${fallback}]` : required ? '' : ' (Enter para omitir)';
    const ans = (await rl.question(`${question}${suffix}: `)).trim();
    if (ans) args[key] = ans;
    else if (fallback) args[key] = fallback;
    else if (required) { rl.close(); fail(`"${key}" es obligatorio.`); }
  };
  console.log('Nuevo producto Maderin — responde cada dato:\n');
  await ask('name', 'Nombre', { required: true });
  await ask('category', `Categoría (${Object.keys(CATEGORIES).join('/')})`, { required: true });
  await ask('photo', 'Ruta de la foto (jpg/png/webp)', { required: true });
  await ask('desc', 'Descripción corta (1 frase)', { required: true });
  await ask('price', 'Precio en S/ (vacío = por confirmar)');
  await ask('old-price', 'Precio anterior en S/ (para mostrar descuento)');
  await ask('subtitle', 'Subtítulo (ficha)');
  await ask('badge', 'Badge de la tarjeta', { fallback: 'Nuevo' });
  await ask('stock', `Disponibilidad (${STOCKS.join('/')})`, { fallback: 'order' });
  await ask('delivery', 'Tiempo de entrega (ej. 5 a 7 días hábiles)');
  await ask('dimensions', 'Medidas (ej. 90 × 190 × 145 cm)');
  await ask('material', 'Material');
  await ask('age', 'Edad recomendada (ej. 2 a 10 años)');
  rl.close();
}

// ---------- Siguiente SKU ----------
function nextSku(js, code) {
  const nums = [...js.matchAll(new RegExp(`MAD-${code}-(\\d+)`, 'g'))].map((m) => Number(m[1]));
  return `MAD-${code}-${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(2, '0')}`;
}

// ---------- Generadores ----------
function buildCard(p, eol) {
  const priced = p.price != null;
  const discount = priced && p.oldPrice && p.oldPrice > p.price;
  const priceBlock = priced
    ? `              <div class="p-price-row">
                <span class="p-current-price">S/ ${p.price}</span>${discount ? `
                <span class="p-old-price">S/ ${p.oldPrice}</span>` : ''}
              </div>${discount ? `
              <span class="p-discount-tag">Ahorra S/ ${p.oldPrice - p.price}</span>` : ''}`
    : `              <div class="p-price-row">
                <span class="p-current-price p-price-pending">Precio por confirmar</span>
              </div>`;
  const action = priced
    ? `<button type="button" class="btn btn-buy btn-add-cart" data-add-id="${p.id}" aria-label="Agregar al carrito">${CART_ICON}<span>Agregar</span></button>`
    : `<button type="button" class="btn btn-buy btn-consult" data-consult-id="${p.id}" aria-label="Consultar precio por WhatsApp">${WA_ICON}<span>Consultar</span></button>`;
  const html = `
      <!-- Nuevo: ${escHtml(p.name)} -->
      <article class="product-card compact-card reveal" data-id="${p.id}" data-category="${p.category}"${priced ? ` data-price="${p.price}"` : ''} data-name="${escHtml(p.name)}" role="button" tabindex="0" aria-label="Ver detalles de ${escHtml(p.name)}">
        <div class="product-thumb compact-thumb">
          <span class="sample-badge">${escHtml(p.badge)}</span>
          <div class="thumb-icon-wrap">
            <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5">${CATEGORIES[p.category].svg}</svg>
          </div>
          <div class="thumb-quick-hint">
            <span class="quick-hint-pill">
              ${SEARCH_ICON}
              Ficha rápida
            </span>
          </div>
        </div>
        <div class="product-body compact-body">
          <div class="p-card-header">
            <span class="p-card-cat">${escHtml(CATEGORIES[p.category].label)}</span>
          </div>
          <h3 class="p-card-name">${escHtml(p.name)}</h3>
          <p class="desc">${escHtml(p.desc)}</p>
          <div class="product-footer-row">
            <div class="p-pricing">
${priceBlock}
            </div>
            <div class="p-actions-group">
              <button class="btn btn-outline-maderin btn-open-modal" aria-label="Ver ficha completa">Ver detalle</button>
              ${action}
            </div>
          </div>
        </div>
      </article>
`;
  return html.replace(/\n/g, eol);
}

function buildJsObject(p, eol) {
  const priced = p.price != null;
  const pending = (v, fallback = 'Por confirmar') => jsStr(v || fallback);
  const js = `,
      {
        id: ${jsStr(p.id)},
        photo: ${jsStr(p.id)},
        category: ${jsStr(p.category)},
        categoryLabel: ${jsStr(CATEGORIES[p.category].label)},
        sku: ${jsStr(p.sku)},
        name: ${jsStr(p.name)},
        subtitle: ${jsStr(p.subtitle || p.name)},
        desc: ${jsStr(p.desc)},
        price: ${priced ? p.price : 'null'},${priced ? '' : '               // por confirmar: mientras sea null, el producto se consulta por WhatsApp y no entra al carrito'}
        oldPrice: ${priced && p.oldPrice > p.price ? p.oldPrice : 'null'},
        discount: ${priced && p.oldPrice > p.price ? jsStr(`Ahorra S/ ${p.oldPrice - p.price}`) : 'null'},
        badge: ${jsStr(p.badge)},
        stock: ${jsStr(p.stock)},
        rating: null,              // sin reseñas todavía
        reviewsCount: 0,
        dimensions: ${pending(p.dimensions)},
        material: ${pending(p.material)},
        ageRange: ${pending(p.age)},
        deliveryTime: ${p.delivery ? jsStr(p.delivery) : 'null'},
        finish: ${pending(p.finish)},
        colors: [
          { name: "Por definir", hex: "#E5DCCB" }
        ],
        svg: \`<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5">${CATEGORIES[p.category].svg}</svg>\`
      }`;
  return js.replace(/\n/g, eol);
}

// ---------- Principal ----------
const args = parseArgs(process.argv.slice(2));
const dryRun = !!args['dry-run'];
if (!args.name || !args.category || !args.photo || !args.desc) await askMissing(args);

const category = String(args.category || '').toLowerCase();
if (!CATEGORIES[category]) fail(`Categoría inválida "${args.category}". Opciones: ${Object.keys(CATEGORIES).join(', ')}`);
const stock = args.stock || 'order';
if (!STOCKS.includes(stock)) fail(`Disponibilidad inválida "${stock}". Opciones: ${STOCKS.join(', ')}`);

const toNum = (v, label) => {
  if (v === undefined || v === true || v === '') return null;
  const n = Number(String(v).replace(/^S\/\s*/i, ''));
  if (!Number.isFinite(n) || n <= 0) fail(`${label} inválido: "${v}"`);
  return n;
};

const photoSrc = path.resolve(String(args.photo).replace(/^"|"$/g, ''));
if (!fs.existsSync(photoSrc)) fail(`No existe la foto: ${photoSrc}`);

const html = fs.readFileSync(HTML_PATH, 'utf8');
const js = fs.readFileSync(JS_PATH, 'utf8');
const id = args.id ? slugify(String(args.id)) : slugify(String(args.name));
if (!id) fail('No pude generar un id a partir del nombre.');
if (html.includes(`data-id="${id}"`) || js.includes(`id: "${id}"`)) fail(`Ya existe un producto con id "${id}". Usa --id para otro.`);

const product = {
  id,
  category,
  sku: nextSku(js, CATEGORIES[category].code),
  name: String(args.name).trim(),
  subtitle: args.subtitle && args.subtitle !== true ? String(args.subtitle).trim() : '',
  desc: String(args.desc).trim(),
  price: toNum(args.price, 'Precio'),
  oldPrice: toNum(args['old-price'], 'Precio anterior'),
  badge: args.badge && args.badge !== true ? String(args.badge) : 'Nuevo',
  stock,
  delivery: args.delivery && args.delivery !== true ? String(args.delivery) : '',
  dimensions: args.dimensions && args.dimensions !== true ? String(args.dimensions) : '',
  material: args.material && args.material !== true ? String(args.material) : '',
  age: args.age && args.age !== true ? String(args.age) : '',
  finish: args.finish && args.finish !== true ? String(args.finish) : '',
};

// Anclas de inserción
const eolHtml = html.includes('\r\n') ? '\r\n' : '\n';
const eolJs = js.includes('\r\n') ? '\r\n' : '\n';

const gridStart = html.indexOf('id="maderinProductGrid"');
if (gridStart === -1) fail('No encontré #maderinProductGrid en maderin.html.');
const gridEndRe = /<\/article>(\r?\n)\s*<\/div>(\r?\n)\s*<\/div>(\r?\n)<\/section>/g;
gridEndRe.lastIndex = gridStart;
const gridEnd = gridEndRe.exec(html);
if (!gridEnd) fail('No encontré el cierre de la grilla en maderin.html.');
const htmlInsertAt = gridEnd.index + '</article>'.length;

const arrayEndRe = /(\r?\n)\s*\}(\r?\n)\s*\];(\r?\n)(\r?\n)\s*\/\/ Elementos del Modal/;
const arrayEnd = arrayEndRe.exec(js);
if (!arrayEnd) fail('No encontré el final del array maderinProducts en assets/main.js.');
const jsInsertAt = arrayEnd.index + arrayEnd[0].indexOf('}') + 1;

console.log(`\nProducto: ${product.name}  (id: ${id}, SKU: ${product.sku})`);
console.log(`Categoría: ${CATEGORIES[category].label} · Disponibilidad: ${stock}`);
console.log(product.price != null ? `Precio: S/ ${product.price}${product.oldPrice > product.price ? ` (antes S/ ${product.oldPrice})` : ''}` : 'Precio: por confirmar (se consulta por WhatsApp)');

if (dryRun) { console.log('\n--dry-run: no se escribió nada.'); process.exit(0); }

// 1. Imágenes
fs.mkdirSync(PHOTO_DIR, { recursive: true });
for (const width of [480, 900]) {
  const dest = path.join(PHOTO_DIR, `${id}-${width}.webp`);
  await sharp(photoSrc).rotate().resize({ width, withoutEnlargement: true }).webp({ quality: 80, effort: 5 }).toFile(dest);
  console.log(`  ✓ ${path.relative(ROOT, dest)} (${Math.round(fs.statSync(dest).size / 1024)} KB)`);
}

// 2. HTML y JS (se insertan de atrás hacia adelante dentro de cada archivo; una sola inserción por archivo)
fs.writeFileSync(HTML_PATH, html.slice(0, htmlInsertAt) + eolHtml + buildCard(product, eolHtml).replace(/\s+$/, '') + html.slice(htmlInsertAt));
fs.writeFileSync(JS_PATH, js.slice(0, jsInsertAt) + buildJsObject(product, eolJs) + js.slice(jsInsertAt));
console.log('  ✓ maderin.html (tarjeta)');
console.log('  ✓ assets/main.js (ficha del modal)');

console.log(`\nListo. Revisa en local con "npm run dev" y luego haz commit.`);
if (product.price == null) console.log('Nota: sin precio, completa price/dimensions/material en assets/main.js cuando los tengas.');
