import { Injectable } from '@angular/core';

/**
 * Detector de gorras por color (modo Gorra). Independiente de logo/pelota.
 * Proximidad moderada: centro del guía, sin ser tan estricto como logos.
 * - Yankees: negro + dorado
 * - Sox: crema + púrpura
 */
export type GorraColorId = 'gorra-yankees' | 'gorra-redsox';

export interface GorraColorGuess {
  id: GorraColorId;
  score: number;
  label: string;
}

@Injectable({ providedIn: 'root' })
export class GorraColorDetectService {
  private canvas: HTMLCanvasElement | null = null;
  private stableId: GorraColorId | null = null;
  private stableHits = 0;
  /** 3 frames ≈ 600 ms: estabiliza sin volverse sordo. */
  private readonly needHits = 3;

  reset(): void {
    this.stableId = null;
    this.stableHits = 0;
  }

  sample(video: HTMLVideoElement | null): GorraColorGuess | null {
    const guess = this.analyze(video);
    if (!guess) return this.fail();

    if (guess.id === this.stableId) this.stableHits++;
    else {
      this.stableId = guess.id;
      this.stableHits = 1;
    }
    if (this.stableHits < this.needHits) return null;
    return guess;
  }

  private analyze(video: HTMLVideoElement | null): GorraColorGuess | null {
    if (!video || video.readyState < 2 || video.videoWidth < 16) return null;

    this.canvas ??= document.createElement('canvas');
    const w = 96;
    const h = 96;
    this.canvas.width = w;
    this.canvas.height = h;
    const ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    // Guía completo con un poco de margen interno (no todo el cuadro = lejano)
    const guideX = vw * 0.18;
    const guideY = vh * 0.12;
    const guideW = vw * 0.64;
    const guideH = vh * 0.62;
    const sx = guideX + guideW * 0.1;
    const sy = guideY + guideH * 0.1;
    const sw = guideW * 0.8;
    const sh = guideH * 0.8;
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, w, h);

    const { data } = ctx.getImageData(0, 0, w, h);
    let dark = 0;
    let gold = 0;
    let purple = 0;
    let cream = 0;
    let other = 0;
    let total = 0;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (r > 252 && g > 252 && b > 252) continue;
      total++;
      const { h: hue, s: sat, v: val } = this.hsv(r, g, b);

      if (val < 0.28) {
        dark++;
        continue;
      }

      // Dorado
      if (
        hue >= 22 &&
        hue <= 58 &&
        sat >= 0.2 &&
        val >= 0.35 &&
        r > g - 5 &&
        r > b + 12
      ) {
        gold++;
        continue;
      }
      if (
        val >= 0.48 &&
        sat >= 0.2 &&
        r > 140 &&
        g > 95 &&
        b < 145 &&
        r - b > 25
      ) {
        gold++;
        continue;
      }

      // Púrpura
      if (
        hue >= 230 &&
        hue <= 320 &&
        sat >= 0.12 &&
        val >= 0.16 &&
        val <= 0.75 &&
        b >= g
      ) {
        purple++;
        continue;
      }
      if (
        sat >= 0.14 &&
        val > 0.18 &&
        b > 65 &&
        g < b * 0.95 &&
        b > r * 0.9 &&
        (hue >= 245 || (r > 45 && b > g && b > r))
      ) {
        purple++;
        continue;
      }

      // Crema / beige
      if (
        val >= 0.48 &&
        sat <= 0.35 &&
        r > 115 &&
        g > 105 &&
        Math.abs(r - g) < 55 &&
        b < r + 20 &&
        (hue <= 75 || hue >= 320)
      ) {
        cream++;
        continue;
      }

      if (val < 0.38 && sat < 0.22) {
        dark++;
        continue;
      }

      other++;
    }

    if (total < 90) return null;

    const pd = dark / total;
    const pg = gold / total;
    const pp = purple / total;
    const pc = cream / total;
    const po = other / total;

    // Solo rechaza fondos claramente vacíos / lejanos
    if (po > 0.72) return null;
    if (pd > 0.88 && pg < 0.005 && pp < 0.005) return null;

    const yankeesOk = pd >= 0.14 && gold >= 10 && pg >= 0.01;
    const soxOk = pc >= 0.08 && purple >= 14 && pp >= 0.014;

    const scores: GorraColorGuess[] = [];
    if (yankeesOk) {
      scores.push({
        id: 'gorra-yankees',
        score: pd * 1.2 + pg * 4,
        label: 'Yankees (negro + dorado)',
      });
    }
    if (soxOk) {
      scores.push({
        id: 'gorra-redsox',
        score: pc * 1.8 + pp * 3.5,
        label: 'White Sox (crema + púrpura)',
      });
    }

    if (!scores.length) return null;
    scores.sort((a, b) => b.score - a.score);
    return scores[0];
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
