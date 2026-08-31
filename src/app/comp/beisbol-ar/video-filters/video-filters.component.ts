import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { HttpClient } from '@angular/common/http';
import { catchError, of } from 'rxjs';

export type GalleryTab = 'imagenes' | 'videos';

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
  readonly loading = signal(true);

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
  }

  embedUrl(youtubeId: string): SafeResourceUrl {
    const cached = this.embedCache.get(youtubeId);
    if (cached) return cached;
    const url = this.sanitizer.bypassSecurityTrustResourceUrl(
      `https://www.youtube-nocookie.com/embed/${youtubeId}?rel=0&modestbranding=1&playsinline=1`,
    );
    this.embedCache.set(youtubeId, url);
    return url;
  }

  /** Thumbnail liviano (mqdefault ~320px) para móviles. */
  thumbUrl(youtubeId: string): string {
    return `https://i.ytimg.com/vi/${youtubeId}/mqdefault.jpg`;
  }
}
