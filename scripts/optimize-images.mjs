// ============================================================
// Optimización de imágenes de hero (WebP + AVIF responsive)
// Uso: npm run optimize:images
// ============================================================

import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// Anchos objetivo para srcset (se omiten los mayores al original)
const WIDTHS = [640, 1024, 1600, 2048];
const FORMATS = [
  { ext: 'avif', options: { quality: 50, effort: 4 } },
  { ext: 'webp', options: { quality: 78, effort: 5 } },
];

// Imágenes de hero a procesar (rutas relativas a la raíz del proyecto)
const SOURCES = [
  'public/ac_muebleria/hero-img.png',
  'public/maderin/hero.png',
  'public/cdm/hero.png',
];

// Recortes móviles: imagen panorámica -> vertical para el hero en móvil
const MOBILE_CROPS = [
  {
    source: 'public/maderin/hero.png',
    base: 'hero-mobile',
    // Zona derecha (niña + clóset): desde el 45% del ancho hasta el borde
    crop: { left: 0.45, width: 0.55, height: 1 },
    widths: [640, 1024, 1054],
  },
];

const kb = (bytes) => `${Math.round(bytes / 1024)} KB`;

async function optimize(sourceRel) {
  const sourceAbs = path.join(ROOT, sourceRel);
  if (!fs.existsSync(sourceAbs)) {
    console.warn(`  ! No existe: ${sourceRel}`);
    return;
  }

  const dir = path.dirname(sourceAbs);
  const base = path.basename(sourceAbs, path.extname(sourceAbs));
  const meta = await sharp(sourceAbs).metadata();
  const originalSize = fs.statSync(sourceAbs).size;

  console.log(`\n${sourceRel}  (${meta.width}x${meta.height}, ${kb(originalSize)})`);

  // Tiers estándar <= ancho original, más el ancho nativo como máxima calidad
  const targets = [...new Set([...WIDTHS.filter((w) => w <= meta.width), meta.width])]
    .sort((a, b) => a - b);

  for (const width of targets) {
    for (const format of FORMATS) {
      const outName = `${base}-${width}.${format.ext}`;
      const outAbs = path.join(dir, outName);
      await sharp(sourceAbs)
        .resize({ width, withoutEnlargement: true })
        .toFormat(format.ext, format.options)
        .toFile(outAbs);
      console.log(`  -> ${outName}  ${kb(fs.statSync(outAbs).size)}`);
    }
  }
}

async function optimizeMobileCrop(cfg) {
  const sourceAbs = path.join(ROOT, cfg.source);
  if (!fs.existsSync(sourceAbs)) {
    console.warn(`  ! No existe: ${cfg.source}`);
    return;
  }

  const dir = path.dirname(sourceAbs);
  const meta = await sharp(sourceAbs).metadata();
  const left = Math.round(meta.width * cfg.crop.left);
  const width = Math.round(meta.width * cfg.crop.width);
  const height = Math.round(meta.height * cfg.crop.height);

  console.log(`\n${cfg.source} -> ${cfg.base} (recorte ${width}x${height})`);

  for (const w of cfg.widths) {
    for (const format of FORMATS) {
      const outName = `${cfg.base}-${w}.${format.ext}`;
      const outAbs = path.join(dir, outName);
      await sharp(sourceAbs)
        .extract({ left, top: 0, width, height })
        .resize({ width: w, withoutEnlargement: true })
        .toFormat(format.ext, format.options)
        .toFile(outAbs);
      console.log(`  -> ${outName}  ${kb(fs.statSync(outAbs).size)}`);
    }
  }
}

async function main() {
  console.log('Optimizando imágenes de hero...');
  for (const source of SOURCES) {
    await optimize(source);
  }
  for (const cfg of MOBILE_CROPS) {
    await optimizeMobileCrop(cfg);
  }
  console.log('\nListo.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
