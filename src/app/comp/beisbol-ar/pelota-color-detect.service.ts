import { Injectable } from '@angular/core';

/**
 * Detector de pelotas por color (región del guía).
 * - Ohtani/Dodgers: cuero blanco + texto azul
 * - Sultanes: cuero blanco + logo negro (sin azul)
 * Sin pelota en cuadro → null (no se pega).
 */
export type PelotaColorId = 'pelota-othani' | 'pelota-sultanes';

export interface PelotaColorGuess {
  id: PelotaColorId;
  score: number;
  label: string;
}

@Injectable({ providedIn: 'root' })
export class PelotaColorDetectService {
  private canvas: HTMLCanvasElement | null = null;
  private stableId: PelotaColorId | null = null;
  private stableHits = 0;
  private readonly needHits = 2;

  reset(): void {
    this.stableId = null;
    this.stableHits = 0;
  }

  sample(video: HTMLVideoElement | null): PelotaColorGuess | null {
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
    let white = 0;
    let blue = 0;
    let black = 0;
    let red = 0;
    let total = 0;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (r > 252 && g > 252 && b > 252) continue;
      total++;

      const { h: hue, s: sat, v: val } = this.hsv(r, g, b);

      // Cuero blanco / off-white
      if (val >= 0.55 && sat <= 0.22 && r > 140 && g > 135 && b > 125) {
        white++;
        continue;
      }

      // Azul Dodgers / Ohtani
      if (
        hue >= 195 &&
        hue <= 255 &&
        sat >= 0.22 &&
        val >= 0.18 &&
        val <= 0.85 &&
        b > r &&
        b >= g - 10
      ) {
        blue++;
        continue;
      }
      if (
        sat >= 0.28 &&
        val >= 0.2 &&
        b > 70 &&
        b > r + 15 &&
        b > g &&
        hue >= 190 &&
        hue <= 265
      ) {
        blue++;
        continue;
      }

      // Logo negro (Sultanes MT)
      if (val < 0.28 && sat < 0.35) {
        black++;
        continue;
      }
      if (val < 0.22) {
        black++;
        continue;
      }

      // Costura roja (refuerzo Ohtani)
      if (
        ((hue <= 18 || hue >= 345) && sat >= 0.35 && val >= 0.25) ||
        (r > 140 && g < 90 && b < 90 && r - g > 40)
      ) {
        red++;
      }
    }

    if (total < 80) return this.fail();

    const pw = white / total;
    const pb = blue / total;
    const pk = black / total;
    const pr = red / total;

    // Vacío / sin pelota blanca
    if (pw < 0.12) return this.fail();
    if (pb < 0.008 && pk < 0.02) return this.fail();

    const ohtaniOk =
      pw >= 0.15 && blue >= 20 && pb >= 0.02 && (pb > pk * 0.6 || pr >= 0.01);
    const sultanesOk =
      pw >= 0.15 && black >= 25 && pk >= 0.025 && pb < 0.015;

    const ohtaniScore = pw * 0.8 + pb * 4 + pr * 1.5;
    const sultanesScore = pw * 0.8 + pk * 3.5;

    let guess: PelotaColorGuess | null = null;

    if (ohtaniOk && sultanesOk) {
      guess =
        pb >= pk * 0.5
          ? {
              id: 'pelota-othani',
              score: ohtaniScore,
              label: 'Ohtani (blanco + azul)',
            }
          : {
              id: 'pelota-sultanes',
              score: sultanesScore,
              label: 'Sultanes (blanco + negro)',
            };
    } else if (ohtaniOk) {
      guess = {
        id: 'pelota-othani',
        score: ohtaniScore,
        label: 'Ohtani (blanco + azul)',
      };
    } else if (sultanesOk) {
      guess = {
        id: 'pelota-sultanes',
        score: sultanesScore,
        label: 'Sultanes (blanco + negro)',
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

  private fail(): null {
    this.stableId = null;
    this.stableHits = 0;
    return null;
  }
}
