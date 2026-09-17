import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, finalize, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ScanModo } from './lnm-catalog.types';

export interface ScanApiTeam {
  id: string;
  nombre: string;
  liga?: string;
  abrev?: string;
  color?: string;
  modelKey?: string | null;
}

export interface ScanApiPlayer {
  id: string;
  nombre: string;
  equipo?: string;
  posicion?: string;
  liga?: string;
  stats?: Record<string, string>;
}

export interface ScanApiResponse {
  ok: boolean;
  recognized: boolean;
  objectType?: string;
  message: string;
  ocrText?: string;
  player?: ScanApiPlayer | null;
  team?: ScanApiTeam | null;
  detection?: {
    enabled: boolean;
    predictions: { class: string; confidence: number }[];
    error?: string | null;
    note?: string | null;
  };
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class ScanApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.scanApiUrl;
  private busy = false;

  get isBusy(): boolean {
    return this.busy;
  }

  health(): Observable<{ ok: boolean }> {
    return this.http
      .get<{ ok: boolean }>(`${this.base}/health`)
      .pipe(catchError(() => of({ ok: false })));
  }

  /** Cámara → Node → Roboflow → OCR → DB */
  scan(imageDataUrl: string, mode: ScanModo): Observable<ScanApiResponse> {
    this.busy = true;
    return this.http.post<ScanApiResponse>(this.base, { image: imageDataUrl, mode }).pipe(
      catchError((err) =>
        of({
          ok: false,
          recognized: false,
          message: 'API de escaneo no disponible. Arranca: cd server && npm start',
          error: err?.message || 'network',
        } as ScanApiResponse),
      ),
      finalize(() => {
        this.busy = false;
      }),
    );
  }

  captureFrame(video: HTMLVideoElement, maxWidth = 720): string | null {
    if (!video || video.readyState < 2 || video.videoWidth < 16) return null;

    const scale = Math.min(1, maxWidth / video.videoWidth);
    const w = Math.round(video.videoWidth * scale);
    const h = Math.round(video.videoHeight * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', 0.72);
  }
}
