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

async function main() {
  console.log('Optimizando imágenes de hero...');
  for (const source of SOURCES) {
    await optimize(source);
  }
  console.log('\nListo.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
