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

/** Logos de referencia para match geométrico (puede ser lista).
 *  Gorra MLB: NY interlocking vs B (no el escudo circular de calcetines). */
const LOGO_FILES = {
  yankees: ['yankees-ny-clean.jpg', 'yankees-ny.jpg', 'yankees-cap-ref.jpg', 'yankees.jpg'],
  redsox: ['redsox-b.jpg', 'redsox-b-embroidered.jpg', 'redsox.jpg'],
  cubs: ['cubs.png'],
  giants: ['gigants.jpg'],
  'bucaneros-cabos': ['bucaneros-cabos.jpg'],
  'marineros-ensenada': ['marineros-ensenada.png'],
  'barbanegras-tijuana': ['barbanegras-tijuana.jpg'],
  'algodoneros-slrc': ['algodoneros-slrc.jpg'],
  'tiburones-penasco': ['tiburones-penasco.jpg'],
  'cerveceros-tecate': ['cerveceros-tecate.jpg'],
};

const SHAPE_SIZE = 96;
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

/** Zona frontal de gorra (logo). */
function cropLogoZone(image) {
  const w = image.width;
  const h = image.height;
  const cx0 = Math.floor(w * 0.22);
  const cy0 = Math.floor(h * 0.08);
  const cw = Math.floor(w * 0.56);
  const ch = Math.floor(h * 0.55);
  return image.clone().crop({ x: cx0, y: cy0, w: Math.max(8, cw), h: Math.max(8, ch) });
}

function imageToGray(image) {
  const w = image.width;
  const h = image.height;
  const gray = new Float32Array(w * h);
  const d = image.bitmap.data;
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    gray[p] = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
  }
  return { gray, w, h };
}

/** Máscara de bordes (Sobel) normalizada 0..1 — geometría del logo. */
function sobelEdges(gray, w, h) {
  const out = new Float32Array(w * h);
  let max = 1e-6;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx =
        -gray[i - w - 1] +
        gray[i - w + 1] -
        2 * gray[i - 1] +
        2 * gray[i + 1] -
        gray[i + w - 1] +
        gray[i + w + 1];
      const gy =
        -gray[i - w - 1] -
        2 * gray[i - w] -
        gray[i - w + 1] +
        gray[i + w - 1] +
        2 * gray[i + w] +
        gray[i + w + 1];
      const mag = Math.hypot(gx, gy);
      out[i] = mag;
      if (mag > max) max = mag;
    }
  }
  for (let i = 0; i < out.length; i++) out[i] /= max;
  return out;
}

/**
 * Silueta del logo por contraste local (bordado claro sobre tela oscura, o al revés).
 */
function logoSilhouette(image) {
  const resized = image.clone().resize({ w: SHAPE_SIZE, h: SHAPE_SIZE });
  const { gray, w, h } = imageToGray(resized);
  const mask = new Float32Array(w * h);
  const rad = 4;
  let ink = 0;

  for (let y = rad; y < h - rad; y++) {
    for (let x = rad; x < w - rad; x++) {
      let sum = 0;
      let c = 0;
      for (let dy = -rad; dy <= rad; dy++) {
        for (let dx = -rad; dx <= rad; dx++) {
          sum += gray[(y + dy) * w + (x + dx)];
          c += 1;
        }
      }
      const mean = sum / c;
      const lum = gray[y * w + x];
      // Bordado más claro que el vecindario oscuro (NY dorado/beige/blanco)
      const brightOnDark = mean < 125 && lum > mean + 10;
      // Logo oscuro sobre fondo claro (gráficos)
      const darkOnLight = mean > 150 && lum < mean - 16;
      const v = brightOnDark || darkOnLight ? 1 : 0;
      mask[y * w + x] = v;
      ink += v;
    }
  }

  const edges = sobelEdges(gray, w, h);
  if (ink < w * h * 0.03) {
    for (let i = 0; i < mask.length; i++) mask[i] = edges[i] > 0.25 ? 1 : 0;
  }

  // Dilatar un poco la máscara para unir trazos del bordado
  const dil = new Float32Array(mask.length);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      let m = mask[i];
      if (!m) {
        for (let dy = -1; dy <= 1 && !m; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (mask[(y + dy) * w + (x + dx)]) {
              m = 1;
              break;
            }
          }
        }
      }
      dil[i] = m;
    }
  }

  return { mask: dil, edges, w, h };
}

function frameShapeMaps(image) {
  // Varias ventanas: centro-arriba (logo gorra) y centro completo
  const crops = [
    [0.28, 0.05, 0.44, 0.5],
    [0.22, 0.08, 0.56, 0.55],
    [0.3, 0.1, 0.4, 0.45],
  ];
  let best = null;
  let bestInk = -1;
  for (const [a, b, c, d] of crops) {
    const x = Math.floor(image.width * a);
    const y = Math.floor(image.height * b);
    const w = Math.max(16, Math.floor(image.width * c));
    const h = Math.max(16, Math.floor(image.height * d));
    if (x + w > image.width || y + h > image.height) continue;
    const maps = logoSilhouette(image.clone().crop({ x, y, w, h }));
    const ink = maps.mask.reduce((s, v) => s + v, 0);
    if (ink > bestInk) {
      bestInk = ink;
      best = maps;
    }
  }
  return best || logoSilhouette(cropLogoZone(image));
}

/**
 * ¿El objeto está lo bastante cerca?
 * Mide mancha oscura (gorra) + tinta de logo + energía de bordes en el centro.
 * Lejos → darkRatio/ink bajos → close=false.
 */
export async function estimateProximity(imageBase64) {
  const clean = String(imageBase64 || '').replace(/^data:image\/\w+;base64,/, '');
  const image = await Jimp.fromBuffer(Buffer.from(clean, 'base64'));
  const zone = cropLogoZone(image).resize({ w: 120, h: 120 });
  const { gray, w, h } = imageToGray(zone);
  const edges = sobelEdges(gray, w, h);
  const n = gray.length;

  let dark = 0;
  let midBright = 0;
  let edgeSum = 0;
  for (let i = 0; i < n; i++) {
    const lum = gray[i];
    if (lum < 75) dark += 1;
    if (lum > 90 && lum < 210) midBright += 1;
    edgeSum += edges[i];
  }

  const maps = logoSilhouette(zone);
  const ink = maps.mask.reduce((s, v) => s + v, 0);
  const darkRatio = dark / n;
  const inkRatio = ink / n;
  const edgeEnergy = edgeSum / n;

  // Cerca: bastante tela oscura + algo de bordado/bordes en el centro
  const close =
    darkRatio >= 0.18 &&
    (inkRatio >= 0.035 || edgeEnergy >= 0.08) &&
    midBright >= n * 0.08;

  const score = Math.min(
    1,
    darkRatio * 1.4 + inkRatio * 4 + edgeEnergy * 2.2,
  );

  return {
    close,
    darkRatio: Number(darkRatio.toFixed(3)),
    inkRatio: Number(inkRatio.toFixed(3)),
    edgeEnergy: Number(edgeEnergy.toFixed(3)),
    score: Number(score.toFixed(3)),
    hint: close
      ? 'Objeto cerca · logo visible'
      : 'Acerca más la gorra y centra el logo',
  };
}

/** Correlación normalizada (NCC) entre dos mapas. */
function ncc(a, b) {
  if (a.length !== b.length) return 0;
  let meanA = 0;
  let meanB = 0;
  const n = a.length;
  for (let i = 0; i < n; i++) {
    meanA += a[i];
    meanB += b[i];
  }
  meanA /= n;
  meanB /= n;
  let num = 0;
  let denA = 0;
  let denB = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    num += da * db;
    denA += da * da;
    denB += db * db;
  }
  const den = Math.sqrt(denA * denB);
  return den > 1e-9 ? num / den : 0;
}

/** Jaccard de siluetas binarias. */
function jaccard(a, b) {
  let inter = 0;
  let uni = 0;
  for (let i = 0; i < a.length; i++) {
    const av = a[i] > 0.5 ? 1 : 0;
    const bv = b[i] > 0.5 ? 1 : 0;
    inter += av & bv;
    uni += av | bv;
  }
  return uni > 0 ? inter / uni : 0;
}

/** Momentos de la silueta: densidades y asimetría (NY vs B). */
function maskMoments(mask, w, h) {
  let ink = 0;
  let sumX = 0;
  let sumY = 0;
  let left = 0;
  let right = 0;
  let top = 0;
  let bottom = 0;
  let center = 0;
  const cx0 = Math.floor(w * 0.35);
  const cx1 = Math.floor(w * 0.65);
  const cy0 = Math.floor(h * 0.3);
  const cy1 = Math.floor(h * 0.7);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (mask[y * w + x] <= 0.5) continue;
      ink += 1;
      sumX += x;
      sumY += y;
      if (x < w * 0.5) left += 1;
      else right += 1;
      if (y < h * 0.5) top += 1;
      else bottom += 1;
      if (x >= cx0 && x < cx1 && y >= cy0 && y < cy1) center += 1;
    }
  }
  if (ink < 8) {
    return {
      density: 0,
      cx: 0.5,
      cy: 0.5,
      lr: 0,
      tb: 0,
      centerRatio: 0,
    };
  }
  return {
    density: ink / (w * h),
    cx: sumX / ink / w,
    cy: sumY / ink / h,
    // >0 → más tinta a la izquierda (B suele tener asta vertical izq.)
    lr: (left - right) / ink,
    tb: (top - bottom) / ink,
    // NY interlocking concentra más tinta en el centro
    centerRatio: center / ink,
  };
}

/** Afinidad estructural entre frame y plantilla (0..1). */
function structureAffinity(frameMaps, logoMaps) {
  const a = maskMoments(frameMaps.mask, frameMaps.w, frameMaps.h);
  const b = maskMoments(logoMaps.mask, logoMaps.w, logoMaps.h);
  if (a.density < 0.02 || b.density < 0.02) return 0;
  const dDens = 1 - Math.min(1, Math.abs(a.density - b.density) / 0.25);
  const dCx = 1 - Math.min(1, Math.abs(a.cx - b.cx) / 0.35);
  const dCy = 1 - Math.min(1, Math.abs(a.cy - b.cy) / 0.35);
  const dLr = 1 - Math.min(1, Math.abs(a.lr - b.lr) / 0.8);
  const dTb = 1 - Math.min(1, Math.abs(a.tb - b.tb) / 0.8);
  const dCtr = 1 - Math.min(1, Math.abs(a.centerRatio - b.centerRatio) / 0.45);
  return dDens * 0.15 + dCx * 0.2 + dCy * 0.15 + dLr * 0.25 + dTb * 0.1 + dCtr * 0.15;
}

/**
 * Match geométrico multi-escala: desplaza la plantilla sobre el frame
 * y toma el mejor NCC de bordes + Jaccard de silueta.
 * @param {{ fine?: boolean }} opts — fine=true para duelo Yankees/Red Sox
 */
function geometricScore(frameMaps, logoMaps, opts = {}) {
  const { edges: fE, mask: fM, w, h } = frameMaps;
  const { edges: lE, mask: lM } = logoMaps;
  const fine = opts.fine === true;

  // Duelo MLB: más escalas y paso más fino (NY interlocking vs B)
  const scales = fine
    ? [0.55, 0.7, 0.85, 1.0, 1.15, 1.3]
    : [0.7, 0.85, 1.0, 1.15];
  let best = 0;

  for (const scale of scales) {
    const tw = Math.max(24, Math.round(SHAPE_SIZE * scale));
    const th = Math.max(24, Math.round(SHAPE_SIZE * scale));
    // Plantilla escalada (nearest)
    const tE = new Float32Array(tw * th);
    const tM = new Float32Array(tw * th);
    for (let y = 0; y < th; y++) {
      for (let x = 0; x < tw; x++) {
        const sx = Math.min(SHAPE_SIZE - 1, Math.floor((x / tw) * SHAPE_SIZE));
        const sy = Math.min(SHAPE_SIZE - 1, Math.floor((y / th) * SHAPE_SIZE));
        const si = sy * SHAPE_SIZE + sx;
        tE[y * tw + x] = lE[si];
        tM[y * tw + x] = lM[si];
      }
    }

    const step = fine
      ? Math.max(2, Math.floor(Math.min(tw, th) / 12))
      : Math.max(4, Math.floor(Math.min(tw, th) / 8));
    for (let oy = 0; oy <= h - th; oy += step) {
      for (let ox = 0; ox <= w - tw; ox += step) {
        const patchE = new Float32Array(tw * th);
        const patchM = new Float32Array(tw * th);
        for (let y = 0; y < th; y++) {
          for (let x = 0; x < tw; x++) {
            const fi = (oy + y) * w + (ox + x);
            patchE[y * tw + x] = fE[fi];
            patchM[y * tw + x] = fM[fi];
          }
        }
        const edgeNcc = Math.max(0, ncc(patchE, tE));
        const jac = jaccard(patchM, tM);
        // En fine, Jaccard (silueta) pesa más: B vs NY se distinguen por forma
        const score = fine
          ? edgeNcc * 0.55 + jac * 0.45
          : edgeNcc * 0.65 + jac * 0.35;
        if (score > best) best = score;
      }
    }
  }

  // También comparación alineada 1:1 (rápida)
  const aligned = Math.max(0, ncc(fE, lE)) * 0.65 + jaccard(fM, lM) * 0.35;
  let score = Math.max(best, aligned);
  if (fine) {
    const struct = structureAffinity(frameMaps, logoMaps);
    score = score * 0.82 + struct * 0.18;
  }
  return score;
}

/** Mejor score geométrico entre varias plantillas del mismo equipo. */
async function bestShapeForTeam(teamId, frameMaps, fine = false) {
  const logoMapsList = await loadLogoShapes(teamId);
  let best = 0;
  let bestStruct = 0;
  for (const logoMaps of logoMapsList) {
    try {
      best = Math.max(best, geometricScore(frameMaps, logoMaps, { fine }));
      bestStruct = Math.max(bestStruct, structureAffinity(frameMaps, logoMaps));
    } catch (err) {
      console.warn('[logoMatch] geo failed', teamId, err.message);
    }
  }
  return { shape: best, struct: bestStruct };
}

async function loadLogoShapes(teamId) {
  if (logoCache.has(teamId)) return logoCache.get(teamId);
  const files = LOGO_FILES[teamId];
  const list = Array.isArray(files) ? files : files ? [files] : [];
  if (!list.length) {
    logoCache.set(teamId, []);
    return [];
  }
  const maps = [];
  for (const file of list) {
    const full = path.join(LOGOS_DIR, file);
    if (!fs.existsSync(full)) continue;
    try {
      const img = await Jimp.read(full);
      maps.push(logoSilhouette(img));
    } catch (err) {
      console.warn('[logoMatch] shape load failed', teamId, file, err.message);
    }
  }
  logoCache.set(teamId, maps);
  return maps;
}

export async function extractDominantColors(imageBase64, limit = 12) {
  const clean = String(imageBase64 || '').replace(/^data:image\/\w+;base64,/, '');
  const image = await Jimp.fromBuffer(Buffer.from(clean, 'base64'));
  const cropped = cropLogoZone(image).resize({ w: 120, h: 120 });

  const buckets = new Map();
  cropped.scan(0, 0, cropped.width, cropped.height, function (_x, _y, idx) {
    const r = this.bitmap.data[idx];
    const g = this.bitmap.data[idx + 1];
    const b = this.bitmap.data[idx + 2];
    const a = this.bitmap.data[idx + 3];
    if (a < 180) return;
    const lum = r * 0.299 + g * 0.587 + b * 0.114;
    if (lum > 250 || lum < 8) return;
    const qr = Math.min(240, Math.round(r / 20) * 20);
    const qg = Math.min(240, Math.round(g / 20) * 20);
    const qb = Math.min(240, Math.round(b / 20) * 20);
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

function scorePalette(frameColors, paletteHex) {
  const palette = (paletteHex || []).map(hexToRgb).filter(Boolean);
  if (!palette.length || !frameColors.length) return 0;
  const signatures = palette.filter((c) => !isNeutral(c));
  const targets = signatures.length ? signatures : palette;
  let matched = 0;
  for (const target of targets) {
    const closest = Math.min(...frameColors.map((f) => colorDist(f, target)));
    if (closest < 48) matched += 1;
    else if (closest < 72) matched += 0.55;
    else if (closest < 95) matched += 0.2;
  }
  return matched / targets.length;
}

function accentRatios(frameColors) {
  if (!frameColors.length) {
    return { red: 0, orange: 0, navy: 0, cyan: 0, gold: 0, white: 0 };
  }
  const n = frameColors.length;
  let red = 0;
  let orange = 0;
  let navy = 0;
  let cyan = 0;
  let gold = 0;
  let white = 0;
  for (const c of frameColors) {
    const lum = luminance(c);
    const isRed =
      (c.r > 130 && c.g < 95 && c.b < 110 && c.r - c.g > 45) ||
      (c.r > 110 && c.g < 70 && c.b < 80 && c.r > c.g + 35);
    const isOrange =
      !isRed &&
      c.r > 170 &&
      c.g >= 45 &&
      c.g < 170 &&
      c.b < 90 &&
      c.r > c.g + 30;
    const isGold =
      !isRed &&
      ((c.r > 130 && c.g > 95 && c.b < 150 && c.r >= c.g - 20 && c.g - c.b > 6) ||
        (c.r > 110 &&
          c.g > 100 &&
          c.b > 80 &&
          c.b < 170 &&
          Math.abs(c.r - c.g) < 30 &&
          c.r > c.b + 4));
    const isWhite =
      lum > 175 && Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b) < 40;
    if (isRed) red += 1;
    else if (isOrange) orange += 1;
    else if (isGold) gold += 1;
    else if (isWhite) white += 1;
    else if (c.b > c.r + 15 && c.b > c.g + 8 && c.b > 40 && lum < 100) navy += 1;
    else if (c.g > 140 && c.b > 140 && c.r < 100) cyan += 1;
  }
  return {
    red: red / n,
    orange: orange / n,
    navy: navy / n,
    cyan: cyan / n,
    gold: gold / n,
    white: white / n,
  };
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
 * Yankees (NY interlocking) vs Red Sox (B):
 * 1) Acentos de color claros (rojo B / dorado-blanco NY)
 * 2) Geometría en bruto (NCC+Jaccard fine + estructura)
 * 3) Score combinado solo como desempate
 */
function decideYankeesVsRedSox(accents, yank, sox) {
  const yankGeo = yank?.rawShape ?? yank?.shapeScore ?? 0;
  const soxGeo = sox?.rawShape ?? sox?.shapeScore ?? 0;
  const yankStruct = yank?.structScore ?? 0;
  const soxStruct = sox?.structScore ?? 0;
  const yankGeoBlend = yankGeo * 0.75 + yankStruct * 0.25;
  const soxGeoBlend = soxGeo * 0.75 + soxStruct * 0.25;
  const yankComb = yank?.combined ?? 0;
  const soxComb = sox?.combined ?? 0;
  const geoMargin = yankGeoBlend - soxGeoBlend;

  // Rojo del bordado B: decisivo salvo que la forma diga NY con claridad
  if (accents.red >= 0.05 && accents.red > accents.gold + 0.01) {
    if (geoMargin >= 0.08) {
      return { id: 'yankees', reason: 'geo_NY_sobre_rojo' };
    }
    return { id: 'redsox', reason: 'rojo_B' };
  }
  // Dorado / beige del NY
  if (accents.gold >= 0.05 && accents.red < 0.04) {
    if (geoMargin <= -0.08) {
      return { id: 'redsox', reason: 'geo_B_sobre_dorado' };
    }
    return { id: 'yankees', reason: 'dorado_NY' };
  }
  // Blanco del interlocking sin rojo
  if (accents.white >= 0.08 && accents.red < 0.035) {
    if (geoMargin <= -0.1) {
      return { id: 'redsox', reason: 'geo_B_sobre_blanco' };
    }
    return { id: 'yankees', reason: 'blanco_NY' };
  }

  // Sin acento claro → geometría decide (umbral bajo: 3 puntos)
  if (geoMargin >= 0.03) return { id: 'yankees', reason: 'geo_NY' };
  if (geoMargin <= -0.03) return { id: 'redsox', reason: 'geo_B' };

  if (Math.abs(yankComb - soxComb) >= 0.04) {
    return { id: yankComb > soxComb ? 'yankees' : 'redsox', reason: 'score' };
  }

  // Tiebreak: más rojo → Sox; si no, NY (más frecuente en demo)
  return {
    id: accents.red > accents.gold + 0.005 ? 'redsox' : 'yankees',
    reason: 'tiebreak',
  };
}

function applyTeamBias(teamId, colorScore, shapeScore, accents, textScore) {
  let c = colorScore;
  let s = shapeScore;

  if (teamId === 'yankees') {
    if (accents.navy >= 0.1 || accents.gold >= 0.05 || accents.white >= 0.08) {
      c = Math.min(1, c + 0.18);
    }
    if (accents.gold >= 0.06) {
      c = Math.min(1, c + 0.22);
      s = Math.min(1, s + 0.12);
    }
    if (accents.white >= 0.1 && accents.red < 0.04) s = Math.min(1, s + 0.08);
    if (accents.orange >= 0.1) c = Math.max(0, c - 0.45);
    if (accents.red >= 0.05) {
      c = Math.max(0, c - 0.5);
      s = Math.max(0, s - 0.22);
    }
  }

  if (teamId === 'giants') {
    if (accents.orange >= 0.1) c = Math.min(1, c + 0.25);
    if (accents.orange < 0.06 && (accents.navy >= 0.12 || accents.gold >= 0.1)) {
      c = Math.max(0, c - 0.55);
      s = Math.max(0, s - 0.25);
    }
  }

  if (teamId === 'redsox') {
    if (accents.red >= 0.04) {
      c = Math.min(1, c + 0.38);
      s = Math.min(1, s + 0.2);
    }
    if (accents.red < 0.03 && accents.gold >= 0.08) {
      c = Math.max(0, c - 0.4);
      s = Math.max(0, s - 0.18);
    }
    if (accents.red < 0.03 && textScore < 0.5) c = Math.max(0, c - 0.15);
  }

  return { colorScore: c, shapeScore: s };
}

/**
 * Matching inteligente:
 * 1) Geometría (bordes Sobel + silueta vs logos de galería)
 * 2) Colores de firma (incluye NY dorado)
 * 3) OCR como bonus
 */
export async function matchTeamLogo(imageBase64, ocrText = '') {
  const { teams } = await listCatalog();
  let colors = [];
  let frameImage = null;
  let frameMaps = null;
  let proximity = null;

  try {
    const clean = String(imageBase64 || '').replace(/^data:image\/\w+;base64,/, '');
    frameImage = await Jimp.fromBuffer(Buffer.from(clean, 'base64'));
    colors = await extractDominantColors(imageBase64);
    frameMaps = frameShapeMaps(frameImage);
    proximity = await estimateProximity(imageBase64);
  } catch (err) {
    console.warn('[logoMatch] frame read failed:', err.message);
  }

  // Sin proximidad (objeto lejos) no hay match — exige acercar la gorra
  if (proximity && !proximity.close) {
    return {
      team: null,
      rejected: 'too_far',
      proximity,
      colorScore: 0,
      textScore: 0,
      templateScore: 0,
      shapeScore: 0,
      combined: 0,
      colors,
    };
  }

  const accents = accentRatios(colors);
  const ranked = [];

  // Precalcular geometría fine solo para el dúo MLB (más preciso, un poco más lento)
  let yankFine = { shape: 0, struct: 0 };
  let soxFine = { shape: 0, struct: 0 };
  if (frameMaps) {
    yankFine = await bestShapeForTeam('yankees', frameMaps, true);
    soxFine = await bestShapeForTeam('redsox', frameMaps, true);
  }

  for (const team of teams) {
    const palette = team.palette?.length
      ? team.palette
      : [team.color].filter(Boolean);
    let colorScore = scorePalette(colors, palette);
    const textScore = scoreText(ocrText, team);
    let shapeScore = 0;
    let structScore = 0;
    let rawShape = 0;

    if (frameMaps) {
      if (team.id === 'yankees') {
        rawShape = yankFine.shape;
        structScore = yankFine.struct;
        shapeScore = rawShape;
      } else if (team.id === 'redsox') {
        rawShape = soxFine.shape;
        structScore = soxFine.struct;
        shapeScore = rawShape;
      } else {
        const logoMapsList = await loadLogoShapes(team.id);
        for (const logoMaps of logoMapsList) {
          try {
            shapeScore = Math.max(shapeScore, geometricScore(frameMaps, logoMaps));
            structScore = Math.max(
              structScore,
              structureAffinity(frameMaps, logoMaps),
            );
          } catch (err) {
            console.warn('[logoMatch] geo failed', team.id, err.message);
          }
        }
        rawShape = shapeScore;
      }
    }

    ({ colorScore, shapeScore } = applyTeamBias(
      team.id,
      colorScore,
      shapeScore,
      accents,
      textScore,
    ));

    // Geometría pesa más que color (forma del NY / B / etc.)
    const combined =
      shapeScore * 0.55 + colorScore * 0.3 + textScore * 0.15;

    const boosted =
      textScore >= 0.9
        ? Math.max(combined, 0.86)
        : shapeScore >= 0.42 && colorScore >= 0.35
          ? Math.max(combined, 0.72)
          : shapeScore >= 0.28 && colorScore >= 0.45
            ? Math.max(combined, 0.64)
          : shapeScore >= 0.55
            ? Math.max(combined, 0.7)
            : colorScore >= 0.85 && shapeScore >= 0.25
              ? Math.max(combined, 0.68)
              : combined;

    ranked.push({
      team,
      colorScore,
      textScore,
      shapeScore,
      rawShape,
      structScore,
      templateScore: shapeScore,
      combined: boosted,
    });
  }

  ranked.sort((a, b) => b.combined - a.combined);

  // Duelo MLB: Yankees vs Red Sox (geometría fine + rojo/dorado)
  const yank = ranked.find((r) => r.team.id === 'yankees');
  const sox = ranked.find((r) => r.team.id === 'redsox');
  const duo = decideYankeesVsRedSox(accents, yank, sox);
  const duoPick = ranked.find((r) => r.team.id === duo.id);
  const mlbClose =
    proximity?.close &&
    (yank || sox) &&
    Math.max(yank?.rawShape ?? 0, sox?.rawShape ?? 0, yank?.combined ?? 0, sox?.combined ?? 0) >=
      0.2;

  let best = mlbClose && duoPick ? duoPick : ranked[0];
  let second = ranked.find((r) => r.team.id !== best.team.id) || ranked[1];
  if (!best) return null;

  // Si el mejor global no es MLB duo pero hay gorra cerca, fuerza Yankees/Red Sox
  if (
    mlbClose &&
    duoPick &&
    best.team.id !== 'yankees' &&
    best.team.id !== 'redsox'
  ) {
    best = { ...duoPick, combined: Math.max(duoPick.combined, 0.62) };
    second = duo.id === 'yankees' ? sox : yank;
  } else if (mlbClose && duoPick && best.team.id === duo.id) {
    best = { ...best, combined: Math.max(best.combined, 0.62) };
  }

  const margin = second ? best.combined - second.combined : 1;
  const clearWinner =
    margin >= 0.05 ||
    best.textScore >= 0.85 ||
    best.shapeScore >= 0.4 ||
    mlbClose;

  const geoClear =
    best.shapeScore >= 0.22 &&
    margin >= 0.08 &&
    best.shapeScore - (second?.shapeScore || 0) >= 0.08;

  const minCombined =
    best.textScore >= 0.85
      ? 0.4
      : mlbClose
        ? 0.4
        : geoClear
          ? 0.42
          : best.shapeScore >= 0.38
            ? 0.45
            : best.shapeScore >= 0.28 && best.colorScore >= 0.4 && clearWinner
              ? 0.48
              : 0.58;

  if (best.combined < minCombined) return null;
  if (!clearWinner && !geoClear && !mlbClose && best.shapeScore < 0.28) {
    return null;
  }

  if (second && margin < 0.05 && best.textScore < 0.8 && !geoClear && !mlbClose) {
    if (best.shapeScore - (second.shapeScore || 0) < 0.08) return null;
  }

  return {
    team: best.team,
    colorScore: best.colorScore,
    textScore: best.textScore,
    templateScore: best.shapeScore,
    shapeScore: best.shapeScore,
    combined: best.combined,
    margin,
    accents,
    colors,
    proximity,
    duoReason: mlbClose ? duo.reason : null,
    duoGeo: mlbClose
      ? {
          yankees: Number((yank?.rawShape ?? 0).toFixed(3)),
          redsox: Number((sox?.rawShape ?? 0).toFixed(3)),
          yankStruct: Number((yank?.structScore ?? 0).toFixed(3)),
          soxStruct: Number((sox?.structScore ?? 0).toFixed(3)),
          reason: duo.reason,
        }
      : null,
    runnersUp: ranked.slice(0, 3).map((r) => ({
      id: r.team.id,
      combined: Number(r.combined.toFixed(3)),
      color: Number(r.colorScore.toFixed(3)),
      shape: Number(r.shapeScore.toFixed(3)),
      rawShape: Number((r.rawShape ?? r.shapeScore).toFixed(3)),
      template: Number(r.shapeScore.toFixed(3)),
    })),
  };
}
