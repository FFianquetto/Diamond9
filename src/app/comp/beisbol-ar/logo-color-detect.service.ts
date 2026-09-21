import { Injectable } from '@angular/core';

/**
 * Lógica SOLO de Logos (modo Logo). Independiente de gorra/pelota.
 * Estricto: exige el par de colores y que el marcador llene el centro del guía.
 */
export type LogoColorId = 'logo-yankees' | 'logo-redsox' | 'logo-dodgers';

export interface LogoColorGuess {
  id: LogoColorId;
  score: number;
  label: string;
}

@Injectable({ providedIn: 'root' })
export class LogoColorDetectService {
  private canvas: HTMLCanvasElement | null = null;
  private stableId: LogoColorId | null = null;
  private stableHits = 0;
  /** Más hits = menos falsos al pasar la mano / fondo oscuro. */
  private readonly needHits = 4;

  reset(): void {
    this.stableId = null;
    this.stableHits = 0;
  }

  sample(video: HTMLVideoElement | null): LogoColorGuess | null {
    if (!video || video.readyState < 2 || video.videoWidth < 16) return null;

    this.canvas ??= document.createElement('canvas');
    const w = 80;
    const h = 80;
    this.canvas.width = w;
    this.canvas.height = h;
    const ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    // Centro del guía (más chico): hay que acercar el logo al cuadro
    const guideX = vw * 0.18;
    const guideY = vh * 0.12;
    const guideW = vw * 0.64;
    const guideH = vh * 0.62;
    const sx = guideX + guideW * 0.22;
    const sy = guideY + guideH * 0.2;
    const sw = guideW * 0.56;
    const sh = guideH * 0.6;
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, w, h);

    const { data } = ctx.getImageData(0, 0, w, h);
    let navy = 0;
    let white = 0;
    let red = 0;
    let blue = 0;
    let other = 0;
    let total = 0;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (r > 252 && g > 252 && b > 252) continue;
      total++;
      const { h: hue, s: sat, v: val } = this.hsv(r, g, b);

      // Blanco / crema clara (logo o tarjeta)
      if (val >= 0.78 && sat <= 0.18 && Math.min(r, g, b) > 185) {
        white++;
        continue;
      }

      // Navy real (no cualquier sombra): oscuro + tinte azul
      if (
        val >= 0.08 &&
        val <= 0.38 &&
        sat >= 0.12 &&
        hue >= 195 &&
        hue <= 255 &&
        b >= g &&
        b >= r - 5
      ) {
        navy++;
        continue;
      }

      // Rojo vivo (B / bordes)
      if (
        sat >= 0.4 &&
        val >= 0.3 &&
        ((hue <= 14 || hue >= 350) || (r > 150 && g < 80 && b < 80 && r - g > 50))
      ) {
        red++;
        continue;
      }

      // Azul Dodgers (más brillante/saturado que navy)
      if (
        hue >= 200 &&
        hue <= 230 &&
        sat >= 0.4 &&
        val >= 0.35 &&
        val <= 0.8 &&
        b > r + 30 &&
        b > g
      ) {
        blue++;
        continue;
      }

      other++;
    }

    if (total < 120) return this.fail();

    const pn = navy / total;
    const pw = white / total;
    const pr = red / total;
    const pb = blue / total;
    const po = other / total;

    // Fondo vacío / lejano: mucho “other” o un solo color dominante
    if (po > 0.55) return this.fail();
    if (pn > 0.85 && pw < 0.06) return this.fail(); // solo oscuridad
    if (pw > 0.9 && pn < 0.04) return this.fail(); // solo pared blanca

    // Exige pares claros y suficiente cobertura
    const yankeesOk =
      pn >= 0.28 &&
      pw >= 0.14 &&
      navy >= 80 &&
      white >= 40 &&
      pr < 0.06 &&
      pb < 0.1;
    const soxOk =
      pr >= 0.1 &&
      red >= 40 &&
      pn >= 0.18 &&
      navy >= 50 &&
      pw >= 0.08;
    const dodgersOk =
      pb >= 0.12 &&
      blue >= 45 &&
      (pw >= 0.08 || pn >= 0.1) &&
      pr < 0.08;

    const scores: LogoColorGuess[] = [];
    if (yankeesOk) {
      scores.push({
        id: 'logo-yankees',
        score: pn * 1.2 + pw * 2.2,
        label: 'Yankees (navy + blanco)',
      });
    }
    if (soxOk) {
      scores.push({
        id: 'logo-redsox',
        score: pr * 3.2 + pn * 1.1,
        label: 'Red Sox (rojo + navy)',
      });
    }
    if (dodgersOk) {
      scores.push({
        id: 'logo-dodgers',
        score: pb * 3 + pw * 0.8,
        label: 'Dodgers (azul)',
      });
    }

    if (!scores.length) return this.fail();
    scores.sort((a, b) => b.score - a.score);
    // Margen mínimo entre 1º y 2º para no adivinar
    if (scores.length > 1 && scores[0].score < scores[1].score * 1.15) {
      return this.fail();
    }

    const guess = scores[0];
    if (guess.id === this.stableId) this.stableHits++;
    else {
      this.stableId = guess.id;
      this.stableHits = 1;
    }
    if (this.stableHits < this.needHits) return null;
    return guess;
  }

  private hsv(
    r: number,
    g: number,
    b: number,
  ): { h: number; s: number; v: number } {
    const rr = r / 255;
    const gg = g / 255;
    const bb = b / 255;
    const max = Math.max(rr, gg, bb);
    const min = Math.min(rr, gg, bb);
    const d = max - min;
    const s = max === 0 ? 0 : d / max;
    const v = max;
    let h = 0;
    if (d > 1e-6) {
      if (max === rr) h = ((gg - bb) / d) % 6;
      else if (max === gg) h = (bb - rr) / d + 2;
      else h = (rr - gg) / d + 4;
      h *= 60;
      if (h < 0) h += 360;
    }
    return { h, s, v };
  }

  private fail(): null {
    this.stableHits = Math.max(0, this.stableHits - 1);
    if (this.stableHits === 0) this.stableId = null;
    return null;
  }
}
