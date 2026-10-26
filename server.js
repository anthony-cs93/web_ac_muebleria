import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import catalogHandler from './api/catalog.js';
import adminHandler from './api/admin.js';
import { LOCAL_UPLOADS_DIR } from './api/_lib.js';

// Variables locales (ADMIN_PASSWORD, etc.) desde .env si existe; en Vercel se definen en el panel del proyecto
// .env.local es el que genera `vercel env pull` (BLOB_STORE_ID + VERCEL_OIDC_TOKEN para usar el Blob real); lo del .env tiene prioridad
for (const file of ['.env', '.env.local']) {
  try { process.loadEnvFile(file); } catch { /* sin ese archivo */ }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// API (en producción estas rutas las sirve Vercel desde /api; aquí se montan igual para probar en local)
app.get('/api/catalog', catalogHandler);
app.all('/api/admin', express.json({ limit: '5mb' }), adminHandler);
app.use('/uploads', express.static(LOCAL_UPLOADS_DIR)); // fotos subidas desde el admin en modo local

// Serve static assets from root directory
app.use(express.static(__dirname));

// Route for homepage
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Support clean URLs (e.g., /cdm -> /cdm.html, /maderin -> /maderin.html, /admin -> /admin.html)
app.get('/:page', (req, res, next) => {
  const pageFile = path.join(__dirname, `${req.params.page}.html`);
  res.sendFile(pageFile, (err) => {
    if (err) {
      next();
    }
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`AC Mueblería server running at http://0.0.0.0:${PORT}`);
});
