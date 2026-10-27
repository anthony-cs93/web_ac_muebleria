// Genera los íconos de pestaña (public/favicon/) y las tarjetas Open Graph (public/og/)
// de AC Mueblería, Maderin y Corazón de Madera. Uso: npm run build:brand
// Los íconos salen de los logos existentes; las tarjetas OG se renderizan desde scripts/og/*.html con Edge/Chrome headless.
import sharp from 'sharp';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const at = (...p) => path.join(root, ...p);
mkdirSync(at('public/favicon'), { recursive: true });
mkdirSync(at('public/og'), { recursive: true });

// Símbolo recortado de cada logo + color de fondo de su ícono
const BRANDS = {
  ac:      { src: 'public/ac_muebleria/logo-h.png',  crop: { left: 55, top: 47, width: 184, height: 147 },   bg: '#151515', fill: 0.60 },
  maderin: { src: 'public/maderin/logo-maderin.png', crop: { left: 87, top: 137, width: 390, height: 273 },  bg: '#FDF8F4', fill: 0.70 },
  cdm:     { src: 'public/cdm/logo.png',             crop: { left: 59, top: 193, width: 939, height: 1020 }, bg: '#3F4021', fill: 0.56 },
};

// Ícono cuadrado: fondo de marca + símbolo centrado. rounded=true para pestañas; false para apple-touch (iOS redondea solo)
async function icon(b, size, rounded) {
  const markSize = Math.round(size * b.fill);
  const mark = await sharp(at(b.src)).extract(b.crop)
    .resize(markSize, markSize, { fit: 'inside', kernel: 'lanczos3' }).png().toBuffer();
  const r = rounded ? Math.round(size * 0.22) : 0;
  const bg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${r}" fill="${b.bg}"/></svg>`);
  return sharp(bg).composite([{ input: mark, gravity: 'center' }]).png().toBuffer();
}

// .ico con PNGs incrustados
function ico(pngs) {
  const head = Buffer.alloc(6); head.writeUInt16LE(1, 2); head.writeUInt16LE(pngs.length, 4);
  let offset = 6 + pngs.length * 16;
  const dir = pngs.map(({ size, buf }) => {
    const e = Buffer.alloc(16);
    e[0] = size; e[1] = size; e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6);
    e.writeUInt32LE(buf.length, 8); e.writeUInt32LE(offset, 12); offset += buf.length;
    return e;
  });
  return Buffer.concat([head, ...dir, ...pngs.map(p => p.buf)]);
}

for (const [name, b] of Object.entries(BRANDS)) {
  writeFileSync(at(`public/favicon/${name}-32.png`), await icon(b, 32, true));
  writeFileSync(at(`public/favicon/${name}-192.png`), await icon(b, 192, true));
  writeFileSync(at(`public/favicon/${name}-apple-touch.png`), await icon(b, 180, false));
  const sizes = await Promise.all([16, 32, 48].map(async size => ({ size, buf: await icon(b, size, true) })));
  writeFileSync(at(`public/favicon/${name}.ico`), ico(sizes));
}

// Tarjetas OG 1200×630 con el navegador headless
const browser = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
].find(existsSync);
if (!browser) throw new Error('No se encontró Edge ni Chrome para renderizar las tarjetas OG');

for (const name of Object.keys(BRANDS)) {
  execFileSync(browser, [
    '--headless', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
    '--window-size=1200,630', '--virtual-time-budget=15000',
    `--screenshot=${at(`public/og/${name}.png`)}`, pathToFileURL(at(`scripts/og/${name}.html`)).href,
  ], { stdio: 'ignore' });
  // JPG liviano: WhatsApp y otras apps descartan previews de más de ~300 KB
  await sharp(at(`public/og/${name}.png`)).jpeg({ quality: 86, mozjpeg: true }).toFile(at(`public/og/${name}.jpg`));
  unlinkSync(at(`public/og/${name}.png`));
}
console.log('Íconos y tarjetas OG generados en public/favicon y public/og');
