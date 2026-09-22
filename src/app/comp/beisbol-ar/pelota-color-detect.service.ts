import { Injectable } from '@angular/core';

/**
 * Detector de pelotas por color (modo Pelota). Independiente de gorra/logo.
 * Proximidad estricta: centro del guía (hay que acercar), rechazo de fondo
 * lejano y clear rápido al sacar la pelota.
 * - Ohtani/Dodgers: cuero blanco + texto azul
 * - Sultanes: cuero blanco dominante + logo negro (sin azul); no dispara con
 *   sombras / manos / fondos oscuros sueltos.
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
  /** 5 frames ≈ 1 s: Sultanes no debe pegarse a sombras. */
  private readonly needHits = 5;

  reset(): void {
    this.stableId = null;
    this.stableHits = 0;
  }

  sample(video: HTMLVideoElement | null): PelotaColorGuess | null {
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

  private analyze(video: HTMLVideoElement | null): PelotaColorGuess | null {
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
    // Centro del guía (más chico): hay que acercar la pelota al cuadro
    const guideX = vw * 0.18;
    const guideY = vh * 0.12;
    const guideW = vw * 0.64;
    const guideH = vh * 0.62;
    const sx = guideX + guideW * 0.2;
    const sy = guideY + guideH * 0.18;
    const sw = guideW * 0.6;
    const sh = guideH * 0.64;
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, w, h);

    const { data } = ctx.getImageData(0, 0, w, h);
    let white = 0;
    let blue = 0;
    let black = 0;
    let red = 0;
    let other = 0;
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

      // Tinta negra del logo (estricto: no sombras de mano / ropa)
      if (val <= 0.16 && sat <= 0.28 && Math.max(r, g, b) < 48) {
        black++;
        continue;
      }

      // Costura roja (refuerzo Ohtani)
      if (
        ((hue <= 18 || hue >= 345) && sat >= 0.35 && val >= 0.25) ||
        (r > 140 && g < 90 && b < 90 && r - g > 40)
      ) {
        red++;
        continue;
      }

      other++;
    }

    if (total < 140) return null;

    const pw = white / total;
    const pb = blue / total;
    const pk = black / total;
    const pr = red / total;
    const po = other / total;

    // Fondo vacío / lejano
    if (po > 0.5) return null;
    if (pw < 0.28) return null;
    // Mucha oscuridad = habitación / mano, no pelota blanca con logo
    if (pk > 0.2) return null;
    if (pb < 0.012 && pk < 0.04) return null;

    const ohtaniOk =
      pw >= 0.28 &&
      blue >= 30 &&
      pb >= 0.03 &&
      (pb > pk * 1.2 || pr >= 0.012);

    // Sultanes: cuero blanco dominante + mancha de tinta (no sombra suelta)
    const sultanesOk =
      pw >= 0.38 &&
      black >= 55 &&
      pk >= 0.055 &&
      pk <= 0.18 &&
      pw >= pk * 2.8 &&
      pb < 0.01 &&
      po < 0.42;

    const scores: PelotaColorGuess[] = [];
    if (ohtaniOk) {
      scores.push({
        id: 'pelota-othani',
        score: pw * 0.8 + pb * 4 + pr * 1.5,
        label: 'Ohtani (blanco + azul)',
      });
    }
    if (sultanesOk) {
      scores.push({
        id: 'pelota-sultanes',
        score: pw * 1.2 + pk * 2.8,
        label: 'Sultanes (blanco + negro)',
      });
    }

    if (!scores.length) return null;
    scores.sort((a, b) => b.score - a.score);
    if (scores.length > 1 && scores[0].score < scores[1].score * 1.2) {
      return null;
    }
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
    this.stableId = null;
    this.stableHits = 0;
    return null;
  }
}
