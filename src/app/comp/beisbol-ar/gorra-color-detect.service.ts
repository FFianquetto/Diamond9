import { Injectable } from '@angular/core';

/**
 * Detector de gorras por color (región del guía).
 * Exige el par de colores; sin gorra en cuadro → null ya.
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
  /** 2 frames ≈ 400 ms para confirmar; evita falsos al pasar la mano. */
  private readonly needHits = 2;

  reset(): void {
    this.stableId = null;
    this.stableHits = 0;
  }

  sample(video: HTMLVideoElement | null): GorraColorGuess | null {
    if (!video || video.readyState < 2 || video.videoWidth < 16) return null;

    this.canvas ??= document.createElement('canvas');
    // Misma región que .detect-guide-box (left 18%, top 12%, w 64%, h 62%)
    const w = 96;
    const h = 96;
    this.canvas.width = w;
    this.canvas.height = h;
    const ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    ctx.drawImage(
      video,
      vw * 0.18,
      vh * 0.12,
      vw * 0.64,
      vh * 0.62,
      0,
      0,
      w,
      h,
    );

    const { data } = ctx.getImageData(0, 0, w, h);
    let dark = 0;
    let gold = 0;
    let purple = 0;
    let cream = 0;
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

      // Dorado (no demasiado laxo: evita paredes cálidas)
      if (
        hue >= 22 &&
        hue <= 58 &&
        sat >= 0.18 &&
        val >= 0.32 &&
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

      // Púrpura (sat mínima para no cazar azules del fondo)
      if (
        hue >= 230 &&
        hue <= 320 &&
        sat >= 0.1 &&
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

      if (val < 0.38 && sat < 0.22) dark++;
    }

    if (total < 80) return this.fail();

    const pd = dark / total;
    const pg = gold / total;
    const pp = purple / total;
    const pc = cream / total;

    // Sin objeto: mucha oscuridad / poca señal de par → no hay gorra
    if (pd > 0.75 && pg < 0.008) return this.fail();
    if (pg < 0.003 && pp < 0.008 && pc < 0.06) return this.fail();

    // Exige el PAR (no un solo color ambiental)
    const yankeesOk = pd >= 0.16 && gold >= 8 && pg >= 0.008;
    const soxOk = pc >= 0.07 && purple >= 12 && pp >= 0.012;

    const yankeesScore = pd * 1.2 + pg * 4;
    const soxScore = pc * 1.8 + pp * 3.5;

    let guess: GorraColorGuess | null = null;

    if (yankeesOk && soxOk) {
      if (pp >= 0.02 || (pc >= 0.12 && purple >= 30)) {
        guess = {
          id: 'gorra-redsox',
          score: soxScore,
          label: 'White Sox (crema + púrpura)',
        };
      } else {
        guess = {
          id: 'gorra-yankees',
          score: yankeesScore,
          label: 'Yankees (negro + dorado)',
        };
      }
    } else if (soxOk) {
      guess = {
        id: 'gorra-redsox',
        score: soxScore,
        label: 'White Sox (crema + púrpura)',
      };
    } else if (yankeesOk) {
      guess = {
        id: 'gorra-yankees',
        score: yankeesScore,
        label: 'Yankees (negro + dorado)',
      };
    }

    if (!guess) return this.fail();

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

  /** Sin match → limpia estado ya (no se “pega” al quitar la gorra). */
  private fail(): null {
    this.stableId = null;
    this.stableHits = 0;
    return null;
  }
}
