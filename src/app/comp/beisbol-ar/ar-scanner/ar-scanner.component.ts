import {
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { ArMarker } from '../ar-markers';
import { LnmDataService } from '../lnm-data.service';
import { MarkerMatcherService } from '../marker-matcher.service';
import { RewardsService } from '../rewards.service';
import { ParticleFxService } from '../../shared/particle-fx/particle-fx.service';
import { ArModelViewerComponent } from '../ar-3d/ar-model-viewer.component';
import { ArAnimMode } from '../ar-3d/ar-model.types';

export type ArAction = 'info' | 'stats' | 'video' | 'anim';

@Component({
  selector: 'app-ar-scanner',
  standalone: true,
  imports: [CommonModule, RouterLink, MatIconModule, ArModelViewerComponent],
  templateUrl: './ar-scanner.component.html',
  styleUrl: './ar-scanner.component.scss',
})
export class ArScannerComponent implements OnInit, OnDestroy {
  @ViewChild('videoEl') videoEl?: ElementRef<HTMLVideoElement>;

  private catalog: ArMarker[] = [];
  /** Evita re-disparar el mismo marcador cada frame. */
  private lastHitId: string | null = null;
  private lastHitAt = 0;

  cameraActive = signal(false);
  scanning = signal(false);
  cameraError = signal<string | null>(null);
  showCameraModal = signal(false);
  cameraBusy = signal(false);
  /** Última ficha vista (se mantiene al apagar cámara). */
  activeMarker = signal<ArMarker | null>(null);
  /** Hasta 2 escaneos previos. */
  recentScans = signal<ArMarker[]>([]);
  feedback = signal<string | null>(null);
  animating = signal(false);
  animMode = signal<ArAnimMode>('idle');
  showInfo = signal(false);
  showStats = signal(false);
  videoPlaying = signal(false);
  videoProgress = signal(0);
  btnPressed = signal<string | null>(null);
  activeAction = signal<ArAction | null>(null);

  private stream: MediaStream | null = null;
  private feedbackTimer: ReturnType<typeof setTimeout> | null = null;
  private scanTimer: ReturnType<typeof setInterval> | null = null;
  private animTimer: ReturnType<typeof setTimeout> | null = null;
  private videoTimer: ReturnType<typeof setInterval> | null = null;
  private audioCtx: AudioContext | null = null;
  private readonly fx = inject(ParticleFxService);
  private readonly lnm = inject(LnmDataService);
  private readonly matcher = inject(MarkerMatcherService);
  private readonly rewards = inject(RewardsService);

  ngOnInit(): void {
    this.rewards.loadCatalog().subscribe();
    this.lnm.loadCatalog().subscribe((bundle) => {
      this.catalog = bundle.all;
    });
    this.lnm.loadScanProfiles().subscribe(async (profiles) => {
      await this.matcher.loadProfiles(profiles);
    });
  }

  openCameraModal(event?: Event): void {
    if (this.cameraActive() || this.cameraBusy()) return;
    this.cameraError.set(null);
    this.showCameraModal.set(true);
    document.body.style.overflow = 'hidden';
    this.fx.burst('spark', event);
  }

  cancelCameraModal(): void {
    this.showCameraModal.set(false);
    document.body.style.overflow = '';
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.showCameraModal()) this.cancelCameraModal();
  }

  async confirmCamera(event?: Event): Promise<void> {
    this.showCameraModal.set(false);
    document.body.style.overflow = '';
    await this.startCamera(event);
  }

  async startCamera(event?: Event): Promise<void> {
    this.cameraError.set(null);
    this.cameraBusy.set(true);
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      const video = this.videoEl?.nativeElement;
      if (video) {
        video.srcObject = this.stream;
        await video.play();
        void this.matcher.warmOcr(video);
      }
      this.cameraActive.set(true);
      this.matcher.resetPending();
      this.lastHitId = null;
      this.startScanLoop();
      this.ping(
        this.activeMarker()
          ? 'Escaneando… la ficha anterior sigue en pantalla hasta detectar otra.'
          : 'Escaneando… apunta a una carta, escudo o cartel LNM.',
      );
      this.fx.burst('confetti', event);
    } catch {
      this.cameraError.set(
        'No se pudo acceder a la cámara. Revisa permisos del navegador.',
      );
      this.cameraActive.set(false);
    } finally {
      this.cameraBusy.set(false);
    }
  }

  /**
   * Apaga la cámara pero conserva la última ficha en pantalla
   * y la guarda en el historial hasta el próximo escaneo.
   */
  stopCamera(event?: Event): void {
    this.stopScanLoop();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.cameraActive.set(false);
    this.scanning.set(false);
    this.matcher.resetPending();

    const current = this.activeMarker();
    if (current) {
      this.pushRecent(current);
      this.ping(`Cámara apagada. Ficha guardada: ${current.nombre}`);
      this.fx.burst('spark', event);
    }
  }

  openRecent(marker: ArMarker, event?: Event): void {
    if (this.activeMarker()?.id === marker.id) return;
    const prev = this.activeMarker();
    if (prev) this.pushRecent(prev);
    this.recentScans.update((list) =>
      list.filter((m) => m.id !== marker.id).slice(0, 2),
    );
    this.activeMarker.set(marker);
    this.clearPanels(false);
    this.showStats.set(true);
    this.activeAction.set('stats');
    this.runAnim('pulse3d', 1400);
    this.ping(`Historial: ${marker.nombre}`);
    this.playClick();
    this.fx.burst('spark', event);
  }

  pressAction(action: ArAction, event?: Event): void {
    const marker = this.activeMarker();
    if (!marker) return;

    this.btnPressed.set(action);
    setTimeout(() => this.btnPressed.set(null), 220);
    this.playClick();

    switch (action) {
      case 'stats':
        this.stopVideoProgress();
        this.showStats.set(true);
        this.showInfo.set(false);
        this.videoPlaying.set(false);
        this.activeAction.set('stats');
        this.runAnim('pulse3d', 1200);
        this.fx.burst('spark', event);
        this.ping(`Estadísticas: ${marker.nombre}`);
        break;

      case 'video': {
        const next = !this.videoPlaying();
        this.showStats.set(false);
        this.showInfo.set(false);
        this.videoPlaying.set(next);
        this.activeAction.set(next ? 'video' : null);
        if (next) {
          this.startVideoProgress();
          this.runAnim('spin', 2800);
          this.fx.burst('confetti', event);
          this.ping(`Video: ${marker.videoHint}`);
        } else {
          this.stopVideoProgress();
          this.animMode.set('idle');
          this.animating.set(false);
          this.ping('Video detenido');
        }
        break;
      }

      case 'anim':
        this.stopVideoProgress();
        this.videoPlaying.set(false);
        this.activeAction.set('anim');
        this.runAnim('swing', 2200);
        this.fx.burst('homer', event);
        this.ping(`Animación 3D: ${marker.animationLabel}`);
        break;

      case 'info':
        this.stopVideoProgress();
        this.showInfo.set(true);
        this.showStats.set(false);
        this.videoPlaying.set(false);
        this.activeAction.set('info');
        this.runAnim('spin', 2000);
        this.fx.burst('spark', event);
        this.ping(`Info: ${marker.nombre}`);
        break;
    }
  }

  tipoLabel(tipo: ArMarker['tipo']): string {
    switch (tipo) {
      case 'jugador':
        return 'Jugador';
      case 'equipo':
        return 'Equipo';
      case 'liga':
        return 'Cartel LNM';
    }
  }

  ngOnDestroy(): void {
    this.stopScanLoop();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.resetDetection();
    this.stopVideoProgress();
    if (this.animTimer) clearTimeout(this.animTimer);
    document.body.style.overflow = '';
    if (this.feedbackTimer) clearTimeout(this.feedbackTimer);
    void this.audioCtx?.close();
  }

  private startScanLoop(): void {
    this.stopScanLoop();
    this.scanning.set(true);
    this.scanTimer = setInterval(() => this.tickScan(), 500);
  }

  private stopScanLoop(): void {
    if (this.scanTimer) clearInterval(this.scanTimer);
    this.scanTimer = null;
    this.scanning.set(false);
  }

  private tickScan(): void {
    const video = this.videoEl?.nativeElement;
    if (!video || !this.cameraActive() || !this.matcher.isReady) return;

    const id = this.matcher.matchVideoFrame(video);
    if (!id) return;

    const now = Date.now();
    // Mismo marcador: no reinicia UI; el loop sigue activo.
    if (id === this.activeMarker()?.id) {
      this.lastHitId = id;
      this.lastHitAt = now;
      return;
    }

    // Evita cambios demasiado rápidos entre logos distintos
    if (this.activeMarker() && now - this.lastHitAt < 900) return;

    const marker = this.catalog.find((m) => m.id === id);
    if (marker) this.applyDetection(marker);
  }

  /** Actualiza ficha actual; la anterior va al historial. El escaneo NO se detiene. */
  private applyDetection(marker: ArMarker, event?: Event): void {
    const prev = this.activeMarker();
    if (prev && prev.id !== marker.id) {
      this.pushRecent(prev);
    }

    this.activeMarker.set(marker);
    this.lastHitId = marker.id;
    this.lastHitAt = Date.now();

    this.clearPanels(false);
    this.activeAction.set('stats');
    this.runAnim('pulse3d', 1600);

    this.ping(`Detectado: ${marker.nombre}`);
    this.playClick();
    this.fx.burst('confetti', event);

    const unlocked = this.rewards.recordScan(marker.id);
    if (unlocked) {
      this.ping(`¡Premio: ${unlocked}!`);
    }
  }

  private pushRecent(marker: ArMarker): void {
    this.recentScans.update((list) =>
      [marker, ...list.filter((m) => m.id !== marker.id)].slice(0, 2),
    );
  }

  private clearPanels(clearActive = true): void {
    this.showInfo.set(false);
    this.showStats.set(false);
    this.videoPlaying.set(false);
    this.animating.set(false);
    this.animMode.set('idle');
    this.stopVideoProgress();
    if (clearActive) this.activeAction.set(null);
  }

  private resetDetection(): void {
    this.activeMarker.set(null);
    this.clearPanels();
  }

  private runAnim(mode: ArAnimMode, ms: number): void {
    if (this.animTimer) clearTimeout(this.animTimer);
    this.animMode.set(mode);
    this.animating.set(true);
    this.animTimer = setTimeout(() => {
      this.animating.set(false);
      this.animMode.set('idle');
      if (this.activeAction() === 'anim') this.activeAction.set(null);
    }, ms);
  }

  private startVideoProgress(): void {
    this.stopVideoProgress();
    this.videoProgress.set(0);
    this.videoTimer = setInterval(() => {
      const next = this.videoProgress() + 4;
      if (next >= 100) {
        this.videoProgress.set(100);
        this.stopVideoProgress();
        this.videoPlaying.set(false);
        this.activeAction.set(null);
        this.ping('Clip finalizado');
        return;
      }
      this.videoProgress.set(next);
    }, 120);
  }

  private stopVideoProgress(): void {
    if (this.videoTimer) clearInterval(this.videoTimer);
    this.videoTimer = null;
    this.videoProgress.set(0);
  }

  private ping(message: string): void {
    this.feedback.set(message);
    if (this.feedbackTimer) clearTimeout(this.feedbackTimer);
    this.feedbackTimer = setTimeout(() => this.feedback.set(null), 3200);
  }

  private playClick(): void {
    try {
      this.audioCtx ??= new AudioContext();
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'square';
      osc.frequency.value = 880;
      gain.gain.value = 0.04;
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.08);
      osc.stop(this.audioCtx.currentTime + 0.09);
    } catch {
      /* audio opcional */
    }
  }
}
