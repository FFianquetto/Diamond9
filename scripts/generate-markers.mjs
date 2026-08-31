#!/usr/bin/env node
/**
 * Genera PNG de referencia para el escaneo por hash perceptual.
 * Ejecutar: node scripts/generate-markers.mjs
 * No sobrescribe referencias físicas (walter-silva, barbanegras-tijuana).
 */
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '../public/assets/markers');

try {
  const { createCanvas } = require('canvas');
  mkdirSync(outDir, { recursive: true });

  const skip = new Set(['walter-silva.png', 'barbanegras-tijuana.png']);

  const markers = [
    { file: 'andres-garza.png', title: 'ANDRÉS GARZA', sub: 'AVG .361 · CAB', bg: '#0d3d4a', accent: '#8beaf2' },
    { file: 'miguel-palos.png', title: 'MIGUEL PALOS', sub: 'AVG .346 · PCO', bg: '#0a2840', accent: '#0277bd' },
    { file: 'jose-cecena.png', title: 'JOSÉ CECEÑA', sub: 'AVG .345 · SLRC', bg: '#3d2f00', accent: '#f9a825' },
    { file: 'oliver-carrillo.png', title: 'OLIVER CARRILLO', sub: '35 RBI · CAB', bg: '#0d3d4a', accent: '#00c2d7' },
    { file: 'rigoberto-armenta.png', title: 'RIGOBERTO ARMENTA', sub: '9 HR · TIJ', bg: '#111', accent: '#424242' },
    { file: 'jorge-martinez.png', title: 'JORGE MARTÍNEZ', sub: '9 HR · TIJ', bg: '#1a1a1a', accent: '#757575' },
    { file: 'sergio-barthelemy.png', title: 'SERGIO BARTHELEMY', sub: '30 RBI · ENS', bg: '#0d2744', accent: '#1565c0' },
    { file: 'javier-macias.png', title: 'JAVIER MACÍAS', sub: '15 SB · SLRC', bg: '#3d2f00', accent: '#ffb300' },
    { file: 'victor-rodriguez.png', title: 'VÍCTOR RODRÍGUEZ', sub: '14 SB · ENS', bg: '#0d2744', accent: '#1976d2' },
    { file: 'alejandro-carrillo.png', title: 'ALEJANDRO CARRILLO', sub: '6 W · ENS', bg: '#1a2a3a', accent: '#0d47a1' },
    { file: 'sebastian-granados.png', title: 'SEBASTIÁN GRANADOS', sub: '6 W · TIJ', bg: '#111', accent: '#616161' },
    { file: 'josepth-silverio.png', title: 'JOSEPTH SILVERIO', sub: '4 W · CAB', bg: '#0a3540', accent: '#00838f' },
    { file: 'luke-krkovski.png', title: 'LUKE KRKOVSKI', sub: '73 K · TIJ', bg: '#111', accent: '#37474f' },
    { file: 'evan-massie.png', title: 'EVAN MASSIE', sub: '6 SV · PCO', bg: '#0a2840', accent: '#01579b' },
    { file: 'tyler-thornton.png', title: 'TYLER THORNTON', sub: 'ERA 0.43 · TIJ', bg: '#111', accent: '#263238' },
    { file: 'giovany-lucero.png', title: 'GIOVANY LUCERO', sub: 'ERA 0.00 · SLRC', bg: '#3d2f00', accent: '#f57f17' },
    { file: 'marineros-ensenada.png', title: 'MARINEROS', sub: 'ENS · 33-19', bg: '#0d2744', accent: '#1565c0' },
    { file: 'bucaneros-cabos.png', title: 'BUCANEROS', sub: 'CAB · CAMPEÓN', bg: '#0a3540', accent: '#00c2d7' },
    { file: 'algodoneros-slrc.png', title: 'ALGODONEROS', sub: 'SLRC · 26-27', bg: '#3d2f00', accent: '#f9a825' },
    { file: 'tiburones-penasco.png', title: 'TIBURONES', sub: 'PCO · 20-25', bg: '#0a2840', accent: '#0277bd' },
    { file: 'cerveceros-tecate.png', title: 'CERVECEROS', sub: 'TEC · 5-33', bg: '#3d2800', accent: '#ff8f00' },
    { file: 'liga-lnm.png', title: 'CARTEL LNM', sub: 'LIGA NORTE · 2026', bg: '#1a2a35', accent: '#3e688c' },
  ];

  for (const m of markers) {
    if (skip.has(m.file) && existsSync(join(outDir, m.file))) {
      console.log('SKIP', m.file, '(referencia física)');
      continue;
    }

    const w = 400;
    const h = 560;
    const canvas = createCanvas(w, h);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = m.bg;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = m.accent;
    ctx.lineWidth = 8;
    ctx.strokeRect(16, 16, w - 32, h - 32);

    ctx.fillStyle = m.accent;
    ctx.fillRect(16, 16, w - 32, 80);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('LNM 2026', w / 2, 68);

    ctx.fillStyle = m.accent;
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText(m.title, w / 2, h / 2 - 20);

    ctx.fillStyle = '#ccc';
    ctx.font = '20px sans-serif';
    ctx.fillText(m.sub, w / 2, h / 2 + 30);

    ctx.fillStyle = '#888';
    ctx.font = '16px sans-serif';
    ctx.fillText('DIAMANTE 9 · AR', w / 2, h - 40);

    writeFileSync(join(outDir, m.file), canvas.toBuffer('image/png'));
    console.log('OK', m.file);
  }
} catch (err) {
  console.log('canvas no instalado o error:', err?.message ?? err);
  process.exit(0);
}
