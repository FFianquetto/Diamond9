import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { ParticleFxService } from '../../shared/particle-fx/particle-fx.service';

type FilterId =
  | 'none'
  | 'blur'
  | 'pixelate'
  | 'thermal'
  | 'colorShift'
  | 'pastel'
  | 'highSat'
  | 'smooth';

interface VideoItem {
  id: string;
  title: string;
  caption: string;
  /** Poster / frame color while using procedural demo frames */
  accent: string;
}

@Component({
  selector: 'app-video-filters',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './video-filters.component.html',
  styleUrl: './video-filters.component.scss',
})
export class VideoFiltersComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvasEl') canvasRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('sourceVideo') sourceVideo?: ElementRef<HTMLVideoElement>;
  private readonly fx = inject(ParticleFxService);

  readonly videos: VideoItem[] = [
    {
      id: 'lmb-historia',
      title: 'Historia LMB',
      caption: 'Orígenes del beisbol profesional en México',
      accent: '#00C2D7',
    },
    {
      id: 'mundial-2026',
      title: 'Acervo Mundial 2026',
      caption: 'Material temático del archivo multimedia del proyecto',
      accent: '#8BEAF2',
    },
    {
      id: 'diamante-vivo',
      title: 'Noche en el diamante',
      caption: 'Ambiente de estadio y jugadas clave',
      accent: '#3E688C',
    },
  ];

  readonly filters: { id: FilterId; label: string }[] = [
    { id: 'none', label: 'Original' },
    { id: 'blur', label: 'Desenfoque' },
    { id: 'pixelate', label: 'Pixelado' },
    { id: 'thermal', label: 'Cámara térmica' },
    { id: 'colorShift', label: 'Ajuste de color' },
    { id: 'pastel', label: 'Colores pastel' },
    { id: 'highSat', label: 'Alta saturación' },
    { id: 'smooth', label: 'Suavizado' },
  ];

  selectedVideo = signal(this.videos[0]);
  selectedFilter = signal<FilterId>('none');
  feedback = signal<string | null>(null);
  playing = signal(false);

  private raf = 0;
  private offscreen: HTMLCanvasElement | null = null;
  private demoPhase = 0;

  ngAfterViewInit(): void {
    this.offscreen = document.createElement('canvas');
    this.drawLoop();
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.raf);
  }

  selectVideo(item: VideoItem, event?: Event): void {
    this.selectedVideo.set(item);
    this.feedback.set(`Acervo: ${item.title}`);
    this.playing.set(true);
    this.fx.burst('spark', event);
  }

  selectFilter(id: FilterId, event?: Event): void {
    this.selectedFilter.set(id);
    const label = this.filters.find((f) => f.id === id)?.label ?? id;
    this.feedback.set(`Filtro aplicado: ${label}`);
    this.fx.burst(id === 'none' ? 'spark' : 'confetti', event);
  }

  private drawLoop = (): void => {
    this.demoPhase += 0.02;
    this.renderFrame();
    this.raf = requestAnimationFrame(this.drawLoop);
  };

  private renderFrame(): void {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas || !this.offscreen) return;

    const w = (canvas.width = 640);
    const h = (canvas.height = 360);
    this.offscreen.width = w;
    this.offscreen.height = h;

    const ctx = this.offscreen.getContext('2d', { willReadFrequently: true });
    const out = canvas.getContext('2d');
    if (!ctx || !out) return;

    // Frame procedural (demo sin depender de archivos de video externos)
    const video = this.selectedVideo();
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#071A2E');
    g.addColorStop(1, video.accent);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate(this.demoPhase * 0.15);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.moveTo(0, -50);
    ctx.lineTo(50, 0);
    ctx.lineTo(0, 50);
    ctx.lineTo(-50, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 22px Lexend Deca, sans-serif';
    ctx.fillText(video.title, 24, 40);
    ctx.font = '14px Lexend Deca, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText(video.caption, 24, 64);

    // Béisbol en movimiento
    const bx = w * 0.7 + Math.sin(this.demoPhase) * 40;
    const by = h * 0.55 + Math.cos(this.demoPhase * 1.3) * 20;
    ctx.beginPath();
    ctx.arc(bx, by, 18, 0, Math.PI * 2);
    ctx.fillStyle = '#F5F5F5';
    ctx.fill();
    ctx.strokeStyle = '#C62828';
    ctx.lineWidth = 2;
    ctx.stroke();

    this.applyFilter(ctx, out, w, h);
  }

  private applyFilter(
    src: CanvasRenderingContext2D,
    out: CanvasRenderingContext2D,
    w: number,
    h: number,
  ): void {
    const filter = this.selectedFilter();

    if (filter === 'blur' || filter === 'smooth') {
      out.filter = filter === 'blur' ? 'blur(6px)' : 'blur(2.5px) contrast(0.95)';
      out.drawImage(this.offscreen!, 0, 0);
      out.filter = 'none';
      return;
    }

    if (filter === 'none') {
      out.drawImage(this.offscreen!, 0, 0);
      return;
    }

    const image = src.getImageData(0, 0, w, h);
    const d = image.data;

    if (filter === 'pixelate') {
      const block = 12;
      for (let y = 0; y < h; y += block) {
        for (let x = 0; x < w; x += block) {
          const i = (y * w + x) * 4;
          const r = d[i];
          const g = d[i + 1];
          const b = d[i + 2];
          for (let by = 0; by < block && y + by < h; by++) {
            for (let bx = 0; bx < block && x + bx < w; bx++) {
              const j = ((y + by) * w + (x + bx)) * 4;
              d[j] = r;
              d[j + 1] = g;
              d[j + 2] = b;
            }
          }
        }
      }
    } else if (filter === 'thermal') {
      for (let i = 0; i < d.length; i += 4) {
        const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        if (lum < 64) {
          d[i] = 0;
          d[i + 1] = 0;
          d[i + 2] = lum * 2;
        } else if (lum < 128) {
          d[i] = 0;
          d[i + 1] = (lum - 64) * 3;
          d[i + 2] = 255 - lum;
        } else if (lum < 192) {
          d[i] = (lum - 128) * 4;
          d[i + 1] = 255;
          d[i + 2] = 0;
        } else {
          d[i] = 255;
          d[i + 1] = 255 - (lum - 192) * 2;
          d[i + 2] = 0;
        }
      }
    } else if (filter === 'colorShift') {
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i];
        const g = d[i + 1];
        const b = d[i + 2];
        d[i] = Math.min(255, r * 0.85 + 30);
        d[i + 1] = Math.min(255, g * 1.05);
        d[i + 2] = Math.min(255, b * 1.25 + 20);
      }
    } else if (filter === 'pastel') {
      for (let i = 0; i < d.length; i += 4) {
        d[i] = Math.round(d[i] * 0.55 + 120);
        d[i + 1] = Math.round(d[i + 1] * 0.55 + 130);
        d[i + 2] = Math.round(d[i + 2] * 0.55 + 140);
      }
    } else if (filter === 'highSat') {
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i] / 255;
        const g = d[i + 1] / 255;
        const b = d[i + 2] / 255;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h = 0;
        let s = 0;
        const l = (max + min) / 2;
        if (max !== min) {
          const dlt = max - min;
          s = l > 0.5 ? dlt / (2 - max - min) : dlt / (max + min);
          switch (max) {
            case r:
              h = (g - b) / dlt + (g < b ? 6 : 0);
              break;
            case g:
              h = (b - r) / dlt + 2;
              break;
            default:
              h = (r - g) / dlt + 4;
          }
          h /= 6;
        }
        s = Math.min(1, s * 1.85);
        const rgb = this.hslToRgb(h, s, l);
        d[i] = rgb[0];
        d[i + 1] = rgb[1];
        d[i + 2] = rgb[2];
      }
    }

    out.putImageData(image, 0, 0);
  }

  private hslToRgb(h: number, s: number, l: number): [number, number, number] {
    if (s === 0) {
      const v = Math.round(l * 255);
      return [v, v, v];
    }
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    return [
      Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
      Math.round(hue2rgb(p, q, h) * 255),
      Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
    ];
  }
}
