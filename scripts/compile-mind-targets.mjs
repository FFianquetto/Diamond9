/**
 * Compila targets MindAR (.mind) desde public/assets/data/mind-targets.json
 * Uso: node scripts/compile-mind-targets.mjs [modo]
 * Ejemplo: node scripts/compile-mind-targets.mjs logo
 */
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadImage } from 'canvas';
import { OfflineCompiler } from '../node_modules/mind-ar/src/image-target/offline-compiler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const publicDir = path.join(root, 'public');
const configPath = path.join(publicDir, 'assets/data/mind-targets.json');
const outDir = path.join(publicDir, 'assets/mind');
const onlyMode = process.argv[2] || null;

async function compileMode(modeKey, mode) {
  const images = [];
  for (const t of mode.targets) {
    const filePath = path.join(publicDir, t.image);
    const img = await loadImage(filePath);
    images.push(img);
    console.log(`  + ${t.id} ← ${t.image} (${img.width}x${img.height})`);
  }

  const compiler = new OfflineCompiler();
  await compiler.compileImageTargets(images, (p) => {
    process.stdout.write(`\r  Compilando ${modeKey}: ${p.toFixed(1)}%   `);
  });
  process.stdout.write('\n');

  const buffer = compiler.exportData();
  const outName = path.basename(mode.mindFile);
  const outPath = path.join(outDir, outName);
  await writeFile(outPath, Buffer.from(buffer));
  console.log(`  ✓ ${outPath} (${(buffer.byteLength / 1024).toFixed(1)} KB)`);
}

async function main() {
  // mind-ar trae un canvas anidado roto; usar el del proyecto
  try {
    await unlink(
      path.join(root, 'node_modules/mind-ar/node_modules/canvas/package.json'),
    ).catch(() => {});
  } catch {
    /* ignore */
  }

  const raw = await readFile(configPath, 'utf8');
  const config = JSON.parse(raw);
  await mkdir(outDir, { recursive: true });

  for (const [modeKey, mode] of Object.entries(config.modes)) {
    if (onlyMode && modeKey !== onlyMode) continue;
    console.log(`\n=== Modo ${modeKey} (${mode.targets.length} targets) ===`);
    await compileMode(modeKey, mode);
  }

  console.log('\nListo. Archivos en public/assets/mind/');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
