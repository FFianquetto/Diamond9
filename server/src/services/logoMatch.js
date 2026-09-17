import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Jimp } from 'jimp';
import { listCatalog } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOGOS_DIR = path.resolve(
  __dirname,
  '../../../public/assets/galeria/imagenes/equipos',
);

/** Rutas de logo por team.id (archivos en galería). */
const LOGO_FILES = {
  yankees: 'yankees.jpg',
  redsox: 'redsox.jpg',
  // dodgers.webp: Jimp no decodifica webp; color/OCR siguen activos
  cubs: 'cubs.png',
  giants: 'gigants.jpg',
  'bucaneros-cabos': 'bucaneros-cabos.jpg',
  'marineros-ensenada': 'marineros-ensenada.png',
  'barbanegras-tijuana': 'barbanegras-tijuana.jpg',
  'algodoneros-slrc': 'algodoneros-slrc.jpg',
  'tiburones-penasco': 'tiburones-penasco.jpg',
  'cerveceros-tecate': 'cerveceros-tecate.jpg',
};

const logoCache = new Map();

function hexToRgb(hex) {
  const h = String(hex || '').replace('#', '');
  if (h.length < 6) return null;
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function colorDist(a, b) {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function luminance(c) {
  return c.r * 0.299 + c.g * 0.587 + c.b * 0.114;
}

function isNeutral(c) {
  const lum = luminance(c);
  if (lum > 235 || lum < 18) return true;
  const max = Math.max(c.r, c.g, c.b);
  const min = Math.min(c.r, c.g, c.b);
  return max - min < 28 && lum > 90 && lum < 200;
}

function normalize(s = '') {
  return String(s)
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cropLogoZone(image) {
  const w = image.width;
  const h = image.height;
  const cx0 = Math.floor(w * 0.18);
  const cy0 = Math.floor(h * 0.12);
  const cw = Math.floor(w * 0.64);
  const ch = Math.floor(h * 0.62);
  return image.clone().crop({ x: cx0, y: cy0, w: cw, h: ch });
}

/**
 * Extrae colores dominantes del centro (zona típica del logo en gorra).
 */
export async function extractDominantColors(imageBase64, limit = 10) {
  const clean = String(imageBase64 || '').replace(/^data:image\/\w+;base64,/, '');
  const image = await Jimp.fromBuffer(Buffer.from(clean, 'base64'));
  const cropped = cropLogoZone(image);
  cropped.resize({ w: 112, h: 112 });

  const buckets = new Map();
  cropped.scan(0, 0, cropped.width, cropped.height, function (x, y, idx) {
    const r = this.bitmap.data[idx];
    const g = this.bitmap.data[idx + 1];
    const b = this.bitmap.data[idx + 2];
    const a = this.bitmap.data[idx + 3];
    if (a < 180) return;
    const lum = r * 0.299 + g * 0.587 + b * 0.114;
    if (lum > 252 || lum < 6) return;
    const qr = Math.round(r / 20) * 20;
    const qg = Math.round(g / 20) * 20;
    const qb = Math.round(b / 20) * 20;
    const key = `${qr},${qg},${qb}`;
    const prev = buckets.get(key);
    if (prev) prev.count += 1;
    else buckets.set(key, { rgb: { r: qr, g: qg, b: qb }, count: 1 });
  });

  return [...buckets.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((b) => b.rgb);
}

/**
 * Histograma RGB 4 bits por canal → fingerprint compacto.
 */
function colorHistogram(image, size = 64) {
  const clone = image.clone().resize({ w: size, h: size });
  const bins = new Float32Array(512);
  let n = 0;
  clone.scan(0, 0, clone.width, clone.height, function (x, y, idx) {
    const r = this.bitmap.data[idx];
    const g = this.bitmap.data[idx + 1];
    const b = this.bitmap.data[idx + 2];
    const a = this.bitmap.data[idx + 3];
    if (a < 180) return;
    const bi = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5);
    bins[bi] += 1;
    n += 1;
  });
  if (n > 0) {
    for (let i = 0; i < bins.length; i++) bins[i] /= n;
  }
  return bins;
}

function histCorrelation(a, b) {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const den = Math.sqrt(na) * Math.sqrt(nb);
  return den > 0 ? dot / den : 0;
}

async function loadLogoHistogram(teamId) {
  if (logoCache.has(teamId)) return logoCache.get(teamId);
  const file = LOGO_FILES[teamId];
  if (!file) {
    logoCache.set(teamId, null);
    return null;
  }
  const full = path.join(LOGOS_DIR, file);
  if (!fs.existsSync(full)) {
    logoCache.set(teamId, null);
    return null;
  }
  try {
    const img = await Jimp.read(full);
    const hist = colorHistogram(cropLogoZone(img));
    logoCache.set(teamId, hist);
    return hist;
  } catch (err) {
    console.warn('[logoMatch] logo load failed', teamId, err.message);
    logoCache.set(teamId, null);
    return null;
  }
}

async function scoreTemplate(frameImage, teamId) {
  const logoHist = await loadLogoHistogram(teamId);
  if (!logoHist) return 0;
  const frameHist = colorHistogram(cropLogoZone(frameImage));
  const corr = histCorrelation(frameHist, logoHist);
  // corr típico ~0.3–0.95; mapear a 0–1 útil
  return Math.max(0, Math.min(1, (corr - 0.35) / 0.55));
}

/**
 * Score de paleta: prioriza colores de firma (no blanco/gris).
 */
function scorePalette(frameColors, paletteHex) {
  const palette = (paletteHex || []).map(hexToRgb).filter(Boolean);
  if (!palette.length || !frameColors.length) return 0;

  const signatures = palette.filter((c) => !isNeutral(c));
  const targets = signatures.length ? signatures : palette;

  let matched = 0;
  for (const target of targets) {
    const closest = Math.min(...frameColors.map((f) => colorDist(f, target)));
    if (closest < 55) matched += 1;
    else if (closest < 78) matched += 0.65;
    else if (closest < 100) matched += 0.3;
  }
  return matched / targets.length;
}

function scoreText(ocrText, team) {
  const text = normalize(ocrText);
  if (!text) return 0;
  const aliases = [team.nombre, ...(team.aliases || []), ...(team.keywords || [])]
    .map(normalize)
    .filter(Boolean);

  let best = 0;
  for (const alias of aliases) {
    if (alias.length <= 2) {
      const re = new RegExp(`(?:^|\\s)${alias}(?:\\s|$)`);
      if (re.test(text)) best = Math.max(best, 0.98);
      continue;
    }
    if (text.includes(alias)) {
      best = Math.max(best, Math.min(1, 0.55 + alias.length / 20));
    }
  }
  return best;
}

/**
 * Matching inteligente de logo/gorra:
 * plantilla de logo + paleta de firma + OCR (bonus).
 * Pensado para logos como NY de Yankees que el OCR casi nunca lee.
 */
export async function matchTeamLogo(imageBase64, ocrText = '') {
  const { teams } = await listCatalog();
  let colors = [];
  let frameImage = null;

  try {
    const clean = String(imageBase64 || '').replace(/^data:image\/\w+;base64,/, '');
    frameImage = await Jimp.fromBuffer(Buffer.from(clean, 'base64'));
    colors = await extractDominantColors(imageBase64);
  } catch (err) {
    console.warn('[logoMatch] frame read failed:', err.message);
  }

  const ranked = [];
  for (const team of teams) {
    const palette = team.palette?.length
      ? team.palette
      : [team.color].filter(Boolean);
    const colorScore = scorePalette(colors, palette);
    const textScore = scoreText(ocrText, team);
    let templateScore = 0;
    if (frameImage) {
      try {
        templateScore = await scoreTemplate(frameImage, team.id);
      } catch {
        templateScore = 0;
      }
    }

    // Gorras: plantilla + color pesan; OCR solo suma
    const combined =
      templateScore * 0.42 + colorScore * 0.38 + textScore * 0.2;

    const boosted =
      textScore >= 0.9
        ? Math.max(combined, 0.84)
        : templateScore >= 0.72 && colorScore >= 0.55
          ? Math.max(combined, 0.78)
          : colorScore >= 0.85 && templateScore >= 0.45
            ? Math.max(combined, 0.72)
            : combined;

    ranked.push({
      team,
      colorScore,
      textScore,
      templateScore,
      combined: boosted,
    });
  }

  ranked.sort((a, b) => b.combined - a.combined);
  const best = ranked[0];
  const second = ranked[1];

  if (!best) return null;

  // Aceptar solo color fuerte (Yankees navy) aunque OCR falle
  const strongColorOnly =
    best.colorScore >= 0.82 &&
    best.combined >= 0.5 &&
    (!second || best.colorScore - second.colorScore >= 0.12);

  const strongTemplate =
    best.templateScore >= 0.55 && best.combined >= 0.48;

  const minCombined =
    best.textScore >= 0.85
      ? 0.45
      : strongColorOnly || strongTemplate
        ? 0.48
        : 0.58;

  if (best.combined < minCombined) return null;

  if (
    second &&
    best.combined - second.combined < 0.05 &&
    best.textScore < 0.8 &&
    !strongColorOnly
  ) {
    if (best.templateScore < 0.5 && best.colorScore < 0.75) return null;
  }

  return {
    team: best.team,
    colorScore: best.colorScore,
    textScore: best.textScore,
    templateScore: best.templateScore,
    combined: best.combined,
    colors,
  };
}
