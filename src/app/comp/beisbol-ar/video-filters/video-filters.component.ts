import {
  AfterViewChecked,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { catchError, of } from 'rxjs';
import {
  SectionPill,
  SectionShellComponent,
} from '../../shared/section-shell/section-shell.component';
import { UiSoundService } from '../../shared/ui-sound.service';
import { ScanPhotosService } from '../scan-photos.service';
import { ActivatedRoute } from '@angular/router';

export type GalleryTab = 'videos' | 'imagenes';

/** Filtros permitidos por rúbrica (sin B&N, grises, sepia, exposición ni invertir). */
export type MediaFilterId =
  | 'none'
  | 'blur'
  | 'pixelate'
  | 'thermal'
  | 'color'
  | 'soft'
  | 'pastel'
  | 'vivid';

export interface GalleryVideo {
  id: string;
  title: string;
  caption: string;
  src: string;
  poster?: string;
  tag: string;
}

export interface GalleryImage {
  id: string;
  title: string;
  caption: string;
  src: string;
  tag: string;
}

interface GalleryManifest {
  videos: GalleryVideo[];
  images: GalleryImage[];
}

interface FilterOption {
  id: MediaFilterId;
  label: string;
  hint: string;
}

@Component({
  selector: 'app-video-filters',
  standalone: true,
  imports: [CommonModule, SectionShellComponent],
  templateUrl: './video-filters.component.html',
  styleUrl: './video-filters.component.scss',
})
export class VideoFiltersComponent
  implements OnInit, OnDestroy, AfterViewChecked
{
  @ViewChild('sourceVideo') sourceVideo?: ElementRef<HTMLVideoElement>;
  @ViewChild('filterCanvas') filterCanvas?: ElementRef<HTMLCanvasElement>;

  private readonly http = inject(HttpClient);
  private readonly sounds = inject(UiSoundService);
  private readonly scanPhotos = inject(ScanPhotosService);
  private readonly route = inject(ActivatedRoute);
  private rafId = 0;
  private boundVideo: HTMLVideoElement | null = null;
  private scratch: HTMLCanvasElement | null = null;
  private frameSkip = 0;
  private readonly isMobile =
    typeof window !== 'undefined' &&
    (window.matchMedia('(max-width: 820px)').matches ||
      window.matchMedia('(pointer: coarse)').matches);
  private onVisibility = (): void => {
    if (document.hidden) {
      if (this.rafId) cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    } else if (this.boundVideo && !this.rafId) {
      const tick = () => {
        this.paintFrame();
        this.rafId = requestAnimationFrame(tick);
      };
      this.rafId = requestAnimationFrame(tick);
    }
  };

  readonly tab = signal<GalleryTab>('videos');
  readonly pills: SectionPill[] = [
    { id: 'videos', label: 'Videos' },
    { id: 'imagenes', label: 'Imágenes' },
  ];
  readonly videos = signal<GalleryVideo[]>([]);
  readonly images = signal<GalleryImage[]>([]);
  readonly activeVideo = signal<GalleryVideo | null>(null);
  readonly activeImage = signal<GalleryImage | null>(null);
  readonly activeFilter = signal<MediaFilterId>('none');
  /** Matiz en grados (−180…180) para ajuste de color. */
  readonly hue = signal(0);
  /** Saturación % (40…220). No es exposición. */
  readonly saturate = signal(100);
  readonly loading = signal(true);
  readonly feedback = signal<string | null>(null);
  readonly canvasReady = signal(false);
  readonly playing = signal(false);
  readonly progress = signal(0);

  readonly filters: FilterOption[] = [
    { id: 'none', label: 'Original', hint: 'Sin efectos' },
    { id: 'blur', label: 'Desenfoque', hint: 'Blur suave' },
    { id: 'pixelate', label: 'Pixelado', hint: 'Bloques retro' },
    { id: 'thermal', label: 'Térmica', hint: 'Cámara térmica' },
    { id: 'color', label: 'Color', hint: 'Ajuste de color' },
    { id: 'soft', label: 'Suavizado', hint: 'Personalizado' },
    { id: 'pastel', label: 'Pasteles', hint: 'Personalizado' },
    { id: 'vivid', label: 'Alta sat.', hint: 'Personalizado' },
  ];

  readonly activeFilterLabel = computed(
    () =>
      this.filters.find((f) => f.id === this.activeFilter())?.label ??
      'Original',
  );

  private feedbackTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    document.addEventListener('visibilitychange', this.onVisibility);
    const wantCaptures = this.route.snapshot.queryParamMap.get('tab') === 'imagenes';
    this.http
      .get<GalleryManifest>('assets/data/galeria.json')
      .pipe(catchError(() => of({ videos: [], images: [] } as GalleryManifest)))
      .subscribe((data) => {
        this.videos.set(data.videos ?? []);
        const captures: GalleryImage[] = this.scanPhotos.photos().map((p) => ({
          id: p.id,
          title: p.title,
          caption: p.caption,
          src: p.src,
          tag: p.tag,
        }));
        const images = [...captures, ...(data.images ?? [])];
        this.images.set(images);
        this.activeVideo.set(data.videos?.[0] ?? null);
        this.activeImage.set(
          (wantCaptures && captures[0]) || images[0] || null,
        );
        if (wantCaptures) {
          this.tab.set('imagenes');
        }
        this.loading.set(false);
        if (wantCaptures && captures.length) {
          this.ping(
            captures.length === 1
              ? '1 captura del escáner AR'
              : `${captures.length} capturas del escáner AR`,
          );
        }
      });
  }

  ngAfterViewChecked(): void {
    const video = this.sourceVideo?.nativeElement ?? null;
    if (this.tab() !== 'videos' || !video) {
      if (this.boundVideo) this.detachLoop();
      return;
    }
    if (this.boundVideo !== video) {
      this.attachLoop(video);
    }
  }

  ngOnDestroy(): void {
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.detachLoop();
    if (this.feedbackTimer) clearTimeout(this.feedbackTimer);
  }

  setTab(next: string): void {
    if (next !== 'imagenes' && next !== 'videos') return;
    if (next === 'imagenes') this.detachLoop();
    this.tab.set(next);
    this.sounds.play('click');
    this.ping(next === 'videos' ? 'Acervo de videos' : 'Galería de imágenes');
  }

  selectVideo(item: GalleryVideo): void {
    if (this.activeVideo()?.id === item.id) return;
    this.detachLoop();
    this.activeVideo.set(item);
    this.sounds.play('click');
    this.ping(`Video: ${item.title}`);
  }

  selectImage(item: GalleryImage): void {
    this.activeImage.set(item);
    this.downloadError = null;
    this.sounds.play('click');
    this.ping(`Imagen: ${item.title}`);
  }

  setFilter(id: MediaFilterId): void {
    this.activeFilter.set(id);
    if (id !== 'color') {
      this.hue.set(0);
      this.saturate.set(100);
    }
    const label = this.filters.find((f) => f.id === id)?.label ?? id;
    this.sounds.play('filter');
    this.ping(`Filtro · ${label}`);
  }

  onHue(ev: Event): void {
    this.hue.set(Number((ev.target as HTMLInputElement).value));
  }

  onSaturate(ev: Event): void {
    this.saturate.set(Number((ev.target as HTMLInputElement).value));
  }

  resetFilter(): void {
    this.activeFilter.set('none');
    this.hue.set(0);
    this.saturate.set(100);
    this.sounds.play('click');
    this.ping('Filtros reiniciados');
  }

  /** CSS Filter API solo para pestaña imágenes (mismos presets permitidos). */
  imageFilterCss(): string {
    const hue = this.hue();
    const sat = this.saturate() / 100;
    switch (this.activeFilter()) {
      case 'blur':
        return 'blur(5px)';
      case 'pixelate':
        // Aprox. visual; el pixelado real va en canvas de video.
        return 'contrast(1.2) saturate(1.1)';
      case 'thermal':
        return 'hue-rotate(180deg) saturate(2.4) contrast(1.35)';
      case 'color':
        return `hue-rotate(${hue}deg) saturate(${sat})`;
      case 'soft':
        return 'blur(1.6px) contrast(0.92) saturate(0.9)';
      case 'pastel':
        return 'saturate(0.48) contrast(0.88) hue-rotate(18deg)';
      case 'vivid':
        return 'saturate(2.15) contrast(1.12)';
      default:
        return 'none';
    }
  }

  downloadError: string | null = null;
  readonly downloading = signal(false);

  async downloadFilteredImage(): Promise<void> {
    const item = this.activeImage();
    if (!item || this.downloading()) return;
    this.downloading.set(true);
    this.downloadError = null;
    try {
      const img = await this.loadImage(item.src);
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas no disponible');

      if (this.activeFilter() === 'pixelate') {
        this.drawPixelated(ctx, img, canvas.width, canvas.height, 14);
      } else if (this.activeFilter() === 'thermal') {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        this.applyThermal(ctx, canvas.width, canvas.height);
      } else {
        ctx.filter = this.imageFilterCss();
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        ctx.filter = 'none';
      }

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/png'),
      );
      if (!blob) throw new Error('No se pudo generar el archivo');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${item.id}-filtrada.png`;
      a.click();
      URL.revokeObjectURL(url);
      this.ping('Imagen descargada');
    } catch {
      this.downloadError =
        'No se pudo descargar. Prueba otra imagen o recarga la página.';
    } finally {
      this.downloading.set(false);
    }
  }

  togglePlay(): void {
    const video = this.sourceVideo?.nativeElement;
    if (!video) return;
    if (video.paused) {
      void video.play();
      this.playing.set(true);
      this.sounds.play('click');
      this.ping('Reproduciendo');
    } else {
      video.pause();
      this.playing.set(false);
      this.sounds.play('click');
      this.ping('Pausa');
    }
  }

  onSeek(ev: Event): void {
    const video = this.sourceVideo?.nativeElement;
    if (!video || !video.duration) return;
    const value = Number((ev.target as HTMLInputElement).value);
    video.currentTime = (value / 100) * video.duration;
  }

  private attachLoop(video: HTMLVideoElement): void {
    this.detachLoop();
    this.boundVideo = video;
    const onMeta = () => this.syncCanvasSize(video);
    const onPlay = () => this.playing.set(true);
    const onPause = () => this.playing.set(false);
    const onTime = () => {
      if (!video.duration) return;
      this.progress.set((video.currentTime / video.duration) * 100);
    };
    video.addEventListener('loadedmetadata', onMeta);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('timeupdate', onTime);
    (video as HTMLVideoElement & { __d9Clean?: () => void }).__d9Clean = () => {
      video.removeEventListener('loadedmetadata', onMeta);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('timeupdate', onTime);
    };
    if (video.readyState >= 1) onMeta();
    void video.play().then(
      () => this.playing.set(true),
      () => this.playing.set(false),
    );
    const tick = () => {
      this.paintFrame();
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
    this.canvasReady.set(true);
  }

  private detachLoop(): void {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = 0;
    const video = this.boundVideo as
      | (HTMLVideoElement & { __d9Clean?: () => void })
      | null;
    video?.__d9Clean?.();
    this.boundVideo = null;
    this.canvasReady.set(false);
    this.playing.set(false);
    this.progress.set(0);
  }

  private syncCanvasSize(video: HTMLVideoElement): void {
    const canvas = this.filterCanvas?.nativeElement;
    if (!canvas) return;
    let w = video.videoWidth || 640;
    let h = video.videoHeight || 360;
    const maxSide = this.isMobile ? 480 : 720;
    const scale = Math.min(1, maxSide / Math.max(w, h));
    w = Math.max(1, Math.round(w * scale));
    h = Math.max(1, Math.round(h * scale));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  }

  private paintFrame(): void {
    const video = this.sourceVideo?.nativeElement;
    const canvas = this.filterCanvas?.nativeElement;
    if (!video || !canvas || video.readyState < 2) return;

    // En móvil, térmica/pixelado cada 2 frames para bajar CPU
    const heavy =
      this.activeFilter() === 'thermal' || this.activeFilter() === 'pixelate';
    if (this.isMobile && heavy) {
      this.frameSkip = (this.frameSkip + 1) % 2;
      if (this.frameSkip === 1) return;
    }

    this.syncCanvasSize(video);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const filter = this.activeFilter();

    ctx.save();
    ctx.clearRect(0, 0, w, h);

    switch (filter) {
      case 'blur':
        ctx.filter = 'blur(7px)';
        ctx.drawImage(video, 0, 0, w, h);
        break;
      case 'soft':
        ctx.filter = 'blur(2.2px) contrast(0.92) saturate(0.9)';
        ctx.drawImage(video, 0, 0, w, h);
        break;
      case 'pastel':
        ctx.filter = 'saturate(0.48) contrast(0.88) hue-rotate(18deg)';
        ctx.drawImage(video, 0, 0, w, h);
        break;
      case 'vivid':
        ctx.filter = 'saturate(2.2) contrast(1.12)';
        ctx.drawImage(video, 0, 0, w, h);
        break;
      case 'color':
        ctx.filter = `hue-rotate(${this.hue()}deg) saturate(${this.saturate() / 100})`;
        ctx.drawImage(video, 0, 0, w, h);
        break;
      case 'pixelate':
        this.drawPixelated(ctx, video, w, h, this.isMobile ? 20 : 16);
        break;
      case 'thermal':
        ctx.filter = 'none';
        ctx.drawImage(video, 0, 0, w, h);
        this.applyThermal(ctx, w, h);
        break;
      default:
        ctx.filter = 'none';
        ctx.drawImage(video, 0, 0, w, h);
        break;
    }

    ctx.restore();
  }

  private drawPixelated(
    ctx: CanvasRenderingContext2D,
    source: CanvasImageSource,
    w: number,
    h: number,
    block: number,
  ): void {
    if (!this.scratch) this.scratch = document.createElement('canvas');
    const sw = Math.max(1, Math.floor(w / block));
    const sh = Math.max(1, Math.floor(h / block));
    this.scratch.width = sw;
    this.scratch.height = sh;
    const sctx = this.scratch.getContext('2d');
    if (!sctx) return;
    sctx.imageSmoothingEnabled = false;
    sctx.drawImage(source, 0, 0, sw, sh);
    ctx.imageSmoothingEnabled = false;
    ctx.filter = 'none';
    ctx.drawImage(this.scratch, 0, 0, sw, sh, 0, 0, w, h);
    ctx.imageSmoothingEnabled = true;
  }

  /** Mapa térmico falso-color (azul → cian → verde → amarillo → rojo). */
  private applyThermal(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
  ): void {
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const y = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      const t = y / 255;
      let r: number;
      let g: number;
      let b: number;
      if (t < 0.25) {
        const k = t / 0.25;
        r = 0;
        g = Math.round(40 + 180 * k);
        b = 255;
      } else if (t < 0.5) {
        const k = (t - 0.25) / 0.25;
        r = 0;
        g = 255;
        b = Math.round(255 * (1 - k));
      } else if (t < 0.75) {
        const k = (t - 0.5) / 0.25;
        r = Math.round(255 * k);
        g = 255;
        b = 0;
      } else {
        const k = (t - 0.75) / 0.25;
        r = 255;
        g = Math.round(255 * (1 - k));
        b = 0;
      }
      d[i] = r;
      d[i + 1] = g;
      d[i + 2] = b;
    }
    ctx.putImageData(img, 0, 0);
  }

  private ping(msg: string): void {
    this.feedback.set(msg);
    if (this.feedbackTimer) clearTimeout(this.feedbackTimer);
    this.feedbackTimer = setTimeout(() => this.feedback.set(null), 1600);
  }

  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('load failed'));
      img.src = src;
    });
  }
}
