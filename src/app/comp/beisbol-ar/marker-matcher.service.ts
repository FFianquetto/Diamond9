import { Injectable } from '@angular/core';
import { ScanModo, ScanProfile } from './lnm-catalog.types';

interface Rgb {
  r: number;
  g: number;
  b: number;
}

interface LoadedProfile extends ScanProfile {
  rgbColors: Rgb[];
  signatureColors: Rgb[];
}

/**
 * Escaneo por colores + OCR, filtrado por modo (tarjeta / gorra / pelota).
 */
@Injectable({ providedIn: 'root' })
export class MarkerMatcherService {
  private allProfiles: LoadedProfile[] = [];
  private profiles: LoadedProfile[] = [];
  private activeMode: ScanModo = 'tarjeta';
  private canvas = document.createElement('canvas');
  private ctx = this.canvas.getContext('2d', { willReadFrequently: true })!;
  private pendingId: string | null = null;
  private pendingHits = 0;
  private ocrWorker: Awaited<ReturnType<typeof this.createOcrWorker>> | null = null;
  private ocrBusy = false;
  private lastOcrText = '';
  private lastOcrAt = 0;
  /** Frames recientes con OCR sin match (para “no reconocido”). */
  private unmatchedFrames = 0;

  async loadProfiles(profiles: ScanProfile[]): Promise<void> {
    this.allProfiles = profiles.map((p) => {
      const rgbColors = p.colors.map((c) => this.hexToRgb(c));
      return {
        ...p,
        modo: p.modo ?? 'tarjeta',
        rgbColors,
        signatureColors: rgbColors.filter((c) => !this.isNeutralColor(c)),
      };
    });
    this.applyModeFilter();
    this.resetPending();
    void this.getOcrWorker().catch(() => {});
  }

  setMode(mode: ScanModo): void {
    if (this.activeMode === mode) return;
    this.activeMode = mode;
    this.applyModeFilter();
    this.resetPending();
    this.unmatchedFrames = 0;
    this.lastOcrText = '';
  }

  getMode(): ScanModo {
    return this.activeMode;
  }

  get lastOcrSnippet(): string {
    return this.lastOcrText.slice(0, 80);
  }

  get unmatchedStreak(): number {
    return this.unmatchedFrames;
  }

  async warmOcr(video: HTMLVideoElement): Promise<void> {
    this.lastOcrAt = 0;
    this.lastOcrText = '';
    await this.refreshOcr(video, true);
  }

  matchVideoFrame(video: HTMLVideoElement): string | null {
    if (!this.profiles.length || video.readyState < 2 || video.videoWidth < 16) {
      return null;
    }

    void this.refreshOcr(video);

    const frameColors = this.extractDominantColors(video);
    const ocrText = this.lastOcrText;
    const scored = this.scoreProfiles(frameColors, ocrText);

    if (!scored) {
      this.resetPending();
      if (this.activeMode === 'pelota' || ocrText.trim().length >= 3) {
        this.unmatchedFrames++;
      }
      return null;
    }

    this.unmatchedFrames = 0;

    if (scored.id === this.pendingId) {
      this.pendingHits++;
    } else {
      this.pendingId = scored.id;
      this.pendingHits = 1;
    }

    const needHits =
      this.activeMode === 'pelota'
        ? scored.combined >= 0.75
          ? 2
          : 3
        : scored.combined >= 0.85
          ? 2
          : 3;
    if (this.pendingHits < needHits) return null;

    const id = scored.id;
    this.resetPending();
    return id;
  }

  resetPending(): void {
    this.pendingId = null;
    this.pendingHits = 0;
  }

  clearUnmatched(): void {
    this.unmatchedFrames = 0;
  }

  get isReady(): boolean {
    return this.profiles.length > 0;
  }

  private applyModeFilter(): void {
    this.profiles = this.allProfiles.filter((p) => p.modo === this.activeMode);
  }

  private extractDominantColors(video: HTMLVideoElement): Rgb[] {
    const size = 120;
    this.canvas.width = size;
    this.canvas.height = size;

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const cw = vw * 0.72;
    const ch = vh * 0.72;
    const cx = (vw - cw) / 2;
    const cy = (vh - ch) / 2;
    this.ctx.drawImage(video, cx, cy, cw, ch, 0, 0, size, size);

    const data = this.ctx.getImageData(0, 0, size, size).data;
    const buckets = new Map<string, { rgb: Rgb; count: number }>();

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const lum = r * 0.299 + g * 0.587 + b * 0.114;
      if (lum > 248 || lum < 12) continue;

      const qr = Math.round(r / 20) * 20;
      const qg = Math.round(g / 20) * 20;
      const qb = Math.round(b / 20) * 20;
      const key = `${qr},${qg},${qb}`;
      const prev = buckets.get(key);
      if (prev) prev.count++;
      else buckets.set(key, { rgb: { r: qr, g: qg, b: qb }, count: 1 });
    }

    return [...buckets.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map((b) => b.rgb);
  }

  private scoreProfiles(
    frameColors: Rgb[],
    ocrText: string,
  ): { id: string; combined: number } | null {
    if (!frameColors.length) return null;

    const normalizedOcr = this.normalizeText(ocrText);
    const results: {
      id: string;
      colorScore: number;
      textScore: number;
      combined: number;
    }[] = [];

    for (const profile of this.profiles) {
      const colorScore = this.scoreColors(frameColors, profile);
      const textScore = this.scoreKeywords(normalizedOcr, profile.keywords);
      const combined =
        this.activeMode === 'pelota'
          ? colorScore * 0.72 + textScore * 0.28
          : colorScore * 0.5 + textScore * 0.5;
      results.push({ id: profile.id, colorScore, textScore, combined });
    }

    results.sort((a, b) => b.combined - a.combined);
    const best = results[0];
    const second = results[1];

    if (this.activeMode === 'pelota') {
      return this.acceptPelota(best, second, normalizedOcr);
    }

    const minColor = this.activeMode === 'gorra' ? 0.48 : 0.55;
    const minText = this.activeMode === 'gorra' ? 0.28 : 0.34;
    const minCombined = this.activeMode === 'gorra' ? 0.55 : 0.62;
    const minMargin = this.activeMode === 'gorra' ? 0.08 : 0.12;

    if (
      !best ||
      best.colorScore < minColor ||
      best.textScore < minText ||
      best.combined < minCombined ||
      !this.hasPrimaryKeyword(normalizedOcr, best.id)
    ) {
      return null;
    }

    if (second && best.combined - second.combined < minMargin) {
      return null;
    }

    return { id: best.id, combined: best.combined };
  }

  /** Pelota: prioriza cuero claro + costuras rojas; el texto es bonus. */
  private acceptPelota(
    best: { id: string; colorScore: number; textScore: number; combined: number } | undefined,
    second: { combined: number } | undefined,
    normalizedOcr: string,
  ): { id: string; combined: number } | null {
    if (!best || best.colorScore < 0.5 || best.combined < 0.48) return null;

    const hasBallCue =
      best.textScore >= 0.2 ||
      this.hasRedAndWhiteCue(best.id) ||
      /LMB|BALL|BASE|PELOTA/.test(normalizedOcr);

    if (!hasBallCue && best.colorScore < 0.7) return null;

    if (second && best.combined - second.combined < 0.06 && best.colorScore < 0.75) {
      return null;
    }

    return { id: best.id, combined: best.combined };
  }

  private hasRedAndWhiteCue(profileId: string): boolean {
    const profile = this.profiles.find((p) => p.id === profileId);
    if (!profile) return false;
    const hasRed = profile.rgbColors.some(
      (c) => c.r > 150 && c.g < 90 && c.b < 90,
    );
    const hasLight = profile.rgbColors.some((c) => {
      const lum = c.r * 0.299 + c.g * 0.587 + c.b * 0.114;
      return lum > 200;
    });
    return hasRed && hasLight;
  }

  private scoreColors(frame: Rgb[], profile: LoadedProfile): number {
    if (!profile.rgbColors.length) return 0;

    const signatures = profile.signatureColors.length
      ? profile.signatureColors
      : profile.rgbColors;

    let sigMatched = 0;
    for (const target of signatures) {
      const closest = Math.min(...frame.map((f) => this.colorDist(f, target)));
      if (closest < 80) sigMatched++;
    }
    if (signatures.length && sigMatched / signatures.length < 0.4) return 0;

    let matched = 0;
    for (const target of profile.rgbColors) {
      const closest = Math.min(...frame.map((f) => this.colorDist(f, target)));
      if (closest < 90) matched++;
    }
    return matched / profile.rgbColors.length;
  }

  private scoreKeywords(normalizedOcr: string, keywords: string[]): number {
    if (!keywords.length || !normalizedOcr) return 0;
    let hits = 0;
    for (const kw of keywords) {
      if (this.keywordMatches(normalizedOcr, kw)) hits++;
    }
    return hits / keywords.length;
  }

  private hasPrimaryKeyword(normalizedOcr: string, profileId: string): boolean {
    const profile = this.profiles.find((p) => p.id === profileId);
    if (!profile?.keywords.length) return false;

    const sorted = [...profile.keywords].sort((a, b) => b.length - a.length);
    const primary = sorted.find((k) => this.normalizeText(k).length >= 4) ?? sorted[0];
    return this.keywordMatches(normalizedOcr, primary);
  }

  private keywordMatches(normalizedOcr: string, keyword: string): boolean {
    const n = this.normalizeText(keyword);
    if (n.length < 2) return false;
    if (normalizedOcr.includes(n)) return true;
    if (n.length >= 5) {
      return normalizedOcr.split(' ').some((word) => this.fuzzyMatch(word, n));
    }
    return false;
  }

  private fuzzyMatch(a: string, b: string): boolean {
    if (!a || !b) return false;
    if (a.includes(b) || b.includes(a)) return true;
    if (Math.abs(a.length - b.length) > 2) return false;
    let diff = 0;
    const len = Math.max(a.length, b.length);
    for (let i = 0; i < len; i++) {
      if (a[i] !== b[i]) diff++;
    }
    return diff <= 2;
  }

  private isNeutralColor(c: Rgb): boolean {
    const lum = c.r * 0.299 + c.g * 0.587 + c.b * 0.114;
    if (lum > 225 || lum < 35) return true;
    const max = Math.max(c.r, c.g, c.b);
    const min = Math.min(c.r, c.g, c.b);
    return max - min < 28;
  }

  private colorDist(a: Rgb, b: Rgb): number {
    const dr = a.r - b.r;
    const dg = a.g - b.g;
    const db = a.b - b.b;
    return Math.sqrt(dr * dr + dg * dg + db * db);
  }

  private hexToRgb(hex: string): Rgb {
    const h = hex.replace('#', '');
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
    };
  }

  private normalizeText(s: string): string {
    return s
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private async refreshOcr(video: HTMLVideoElement, force = false): Promise<void> {
    const now = Date.now();
    if (this.ocrBusy || (!force && now - this.lastOcrAt < 700)) return;
    this.ocrBusy = true;
    this.lastOcrAt = now;

    try {
      const size = 400;
      this.canvas.width = size;
      this.canvas.height = size;
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      const cw = vw * 0.68;
      const ch = vh * 0.48;
      const cx = (vw - cw) / 2;
      const cy = (vh - ch) / 2;
      this.ctx.drawImage(video, cx, cy, cw, ch, 0, 0, size, size);
      this.ctx.filter = 'grayscale(1) contrast(1.8) brightness(1.1)';
      this.ctx.drawImage(this.canvas, 0, 0, size, size);
      this.ctx.filter = 'none';

      const worker = await this.getOcrWorker();
      const {
        data: { text },
      } = await worker.recognize(this.canvas);
      const cleaned = text ?? '';
      if (cleaned.trim()) {
        this.lastOcrText = cleaned;
      }
    } catch {
      /* OCR opcional */
    } finally {
      this.ocrBusy = false;
    }
  }

  private async getOcrWorker() {
    if (!this.ocrWorker) {
      this.ocrWorker = await this.createOcrWorker();
    }
    return this.ocrWorker;
  }

  private async createOcrWorker() {
    const { createWorker, PSM } = await import('tesseract.js');
    const worker = await createWorker('eng', 1, {
      logger: () => {},
    });
    await worker.setParameters({
      tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ',
      tessedit_pageseg_mode: PSM.SINGLE_LINE,
    });
    return worker;
  }
}
