import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { HttpClient } from '@angular/common/http';
import { catchError, of } from 'rxjs';

export type GalleryTab = 'imagenes' | 'videos';

export type ImageFilterId =
  | 'none'
  | 'grayscale'
  | 'sepia'
  | 'contrast'
  | 'warm'
  | 'cool'
  | 'invert';

export interface GalleryVideo {
  id: string;
  title: string;
  caption: string;
  youtubeId: string;
  channel: string;
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

interface ImageFilterOption {
  id: ImageFilterId;
  label: string;
  css: string;
}

@Component({
  selector: 'app-video-filters',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './video-filters.component.html',
  styleUrl: './video-filters.component.scss',
})
export class VideoFiltersComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly embedCache = new Map<string, SafeResourceUrl>();

  readonly tab = signal<GalleryTab>('imagenes');
  readonly videos = signal<GalleryVideo[]>([]);
  readonly images = signal<GalleryImage[]>([]);
  readonly activeVideo = signal<GalleryVideo | null>(null);
  readonly activeImage = signal<GalleryImage | null>(null);
  readonly activeFilter = signal<ImageFilterId>('none');
  readonly brightness = signal(100);
  readonly contrast = signal(100);
  readonly saturate = signal(100);
  readonly loading = signal(true);
  readonly downloading = signal(false);
  readonly downloadError = signal<string | null>(null);

  /** Presets con CSS Filter API (sin servicio externo). */
  readonly filters: ImageFilterOption[] = [
    { id: 'none', label: 'Original', css: 'none' },
    { id: 'grayscale', label: 'B & N', css: 'grayscale(1)' },
    { id: 'sepia', label: 'Sepia', css: 'sepia(0.85)' },
    { id: 'contrast', label: 'Punch', css: 'contrast(1.45) saturate(1.15)' },
    { id: 'warm', label: 'Cálido', css: 'sepia(0.35) saturate(1.3) hue-rotate(-10deg)' },
    { id: 'cool', label: 'Frío', css: 'saturate(0.85) hue-rotate(180deg)' },
    { id: 'invert', label: 'Invertir', css: 'invert(1) hue-rotate(180deg)' },
  ];

  readonly activeFilterCss = computed(() => {
    const preset =
      this.filters.find((f) => f.id === this.activeFilter())?.css ?? 'none';
    const adj = `brightness(${this.brightness() / 100}) contrast(${this.contrast() / 100}) saturate(${this.saturate() / 100})`;
    return preset === 'none' ? adj : `${preset} ${adj}`;
  });

  ngOnInit(): void {
    this.http
      .get<GalleryManifest>('assets/data/galeria.json')
      .pipe(catchError(() => of({ videos: [], images: [] } as GalleryManifest)))
      .subscribe((data) => {
        this.videos.set(data.videos ?? []);
        this.images.set(data.images ?? []);
        this.activeVideo.set(data.videos?.[0] ?? null);
        this.activeImage.set(data.images?.[0] ?? null);
        this.loading.set(false);
      });
  }

  setTab(next: GalleryTab): void {
    this.tab.set(next);
  }

  selectVideo(item: GalleryVideo): void {
    this.activeVideo.set(item);
  }

  selectImage(item: GalleryImage): void {
    this.activeImage.set(item);
    this.resetAdjustments();
    this.downloadError.set(null);
  }

  setFilter(id: ImageFilterId): void {
    this.activeFilter.set(id);
  }

  onBrightness(ev: Event): void {
    this.brightness.set(Number((ev.target as HTMLInputElement).value));
  }

  onContrast(ev: Event): void {
    this.contrast.set(Number((ev.target as HTMLInputElement).value));
  }

  onSaturate(ev: Event): void {
    this.saturate.set(Number((ev.target as HTMLInputElement).value));
  }

  resetAdjustments(): void {
    this.activeFilter.set('none');
    this.brightness.set(100);
    this.contrast.set(100);
    this.saturate.set(100);
  }

  /** Exporta la imagen con filtros vía Canvas 2D. */
  async downloadFiltered(): Promise<void> {
    const item = this.activeImage();
    if (!item || this.downloading()) return;

    this.downloading.set(true);
    this.downloadError.set(null);

    try {
      const img = await this.loadImage(item.src);
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas no disponible');

      ctx.filter = this.activeFilterCss();
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      ctx.filter = 'none';

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/png'),
      );
      if (!blob) throw new Error('No se pudo generar el archivo');

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const slug = item.title
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      a.href = url;
      a.download = `${slug || item.id}-filtrada.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      this.downloadError.set(
        'No se pudo descargar. Prueba otra imagen o recarga la página.',
      );
    } finally {
      this.downloading.set(false);
    }
  }

  embedUrl(youtubeId: string): SafeResourceUrl {
    const cached = this.embedCache.get(youtubeId);
    if (cached) return cached;
    const url = this.sanitizer.bypassSecurityTrustResourceUrl(
      `https://www.youtube.com/embed/${youtubeId}?rel=0&modestbranding=1&playsinline=1`,
    );
    this.embedCache.set(youtubeId, url);
    return url;
  }

  thumbUrl(youtubeId: string): string {
    return `https://i.ytimg.com/vi/${youtubeId}/mqdefault.jpg`;
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
