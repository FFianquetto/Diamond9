import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { initDb } from './services/db.js';
import { scanRouter } from './routes/scan.js';

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: '8mb' }));

app.get('/', (_req, res) => {
  res.json({
    name: 'Diamante 9 Scan API',
    endpoints: {
      health: 'GET /api/scan/health',
      catalog: 'GET /api/scan/catalog',
      scan: 'POST /api/scan  { image, mode? }',
    },
  });
});

app.use('/api/scan', scanRouter);

await initDb();

const server = app.listen(config.port, () => {
  console.log(`[scan-api] http://localhost:${config.port}`);
  console.log(`[scan-api] DB_MODE=${config.dbMode}`);
  console.log(
    `[scan-api] Roboflow=${config.roboflow.apiKey ? 'ON' : 'OFF (modo+OCR+DB)'}`,
  );
});

server.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    console.error(
      `[scan-api] El puerto ${config.port} ya está en uso.\n` +
        `  → La API probablemente YA está corriendo (no hace falta volver a arrancar).\n` +
        `  → O cierra la otra instancia y vuelve a intentar:\n` +
        `     Get-NetTCPConnection -LocalPort ${config.port} | % OwningProcess`,
    );
    process.exit(1);
  }
  throw err;
});
