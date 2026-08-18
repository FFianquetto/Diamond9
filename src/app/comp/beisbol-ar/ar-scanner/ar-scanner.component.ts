import {
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { AR_MARKERS, ArMarker } from '../ar-markers';
import { ParticleFxService } from '../../shared/particle-fx/particle-fx.service';

@Component({
  selector: 'app-ar-scanner',
  standalone: true,
  imports: [CommonModule, RouterLink, MatIconModule],
  templateUrl: './ar-scanner.component.html',
  styleUrl: './ar-scanner.component.scss',
})
export class ArScannerComponent implements OnDestroy {
  @ViewChild('videoEl') videoEl?: ElementRef<HTMLVideoElement>;

  readonly markers: ArMarker[] = AR_MARKERS;

  cameraActive = signal(false);
  cameraError = signal<string | null>(null);
  showCameraModal = signal(false);
  cameraBusy = signal(false);
  activeMarker = signal<ArMarker | null>(null);
  feedback = signal<string | null>(null);
  animating = signal(false);
  showInfo = signal(false);
  showStats = signal(false);
  videoPlaying = signal(false);
  btnPressed = signal<string | null>(null);

  private stream: MediaStream | null = null;
  private feedbackTimer: ReturnType<typeof setTimeout> | null = null;
  private audioCtx: AudioContext | null = null;
  private readonly fx = inject(ParticleFxService);

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
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      const video = this.videoEl?.nativeElement;
      if (video) {
        video.srcObject = this.stream;
        await video.play();
      }
      this.cameraActive.set(true);
      this.ping('Cámara lista. Apunta a un marcador o selecciónalo abajo.');
      this.fx.burst('confetti', event);
    } catch {
      this.cameraError.set(
        'No se pudo acceder a la cámara. Revisa permisos o usa “Simular escaneo”.',
      );
      this.cameraActive.set(false);
    } finally {
      this.cameraBusy.set(false);
    }
  }

  stopCamera(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.cameraActive.set(false);
  }

  simulateScan(marker: ArMarker, event?: Event): void {
    this.activeMarker.set(marker);
    this.showInfo.set(false);
    this.showStats.set(false);
    this.videoPlaying.set(false);
    this.animating.set(false);
    this.ping(`Marcador detectado: ${marker.name}`);
    this.playClick();
    this.fx.burst('confetti', event);
  }

  clearMarker(): void {
    this.activeMarker.set(null);
    this.showInfo.set(false);
    this.showStats.set(false);
    this.videoPlaying.set(false);
    this.animating.set(false);
    this.ping('Experiencia AR cerrada.');
  }

  pressAction(action: 'info' | 'stats' | 'video' | 'anim', event?: Event): void {
    const marker = this.activeMarker();
    if (!marker) return;

    this.btnPressed.set(action);
    setTimeout(() => this.btnPressed.set(null), 220);
    this.playClick();
    this.fx.burst(action === 'anim' ? 'homer' : 'spark', event);

    switch (action) {
      case 'info':
        this.showInfo.set(true);
        this.showStats.set(false);
        this.videoPlaying.set(false);
        this.animating.set(true);
        this.ping(`${marker.animationLabel} + narración de información`);
        setTimeout(() => this.animating.set(false), 2400);
        break;
      case 'stats':
        this.showStats.set(true);
        this.showInfo.set(false);
        this.ping('Estadísticas en tiempo real (simuladas)');
        break;
      case 'video':
        this.videoPlaying.set(!this.videoPlaying());
        this.ping(
          this.videoPlaying()
            ? `Reproduciendo: ${marker.videoHint}`
            : 'Video detenido',
        );
        break;
      case 'anim':
        this.animating.set(true);
        this.ping(`Animación: ${marker.animationLabel}`);
        setTimeout(() => this.animating.set(false), 2000);
        break;
    }
  }

  ngOnDestroy(): void {
    this.stopCamera();
    document.body.style.overflow = '';
    if (this.feedbackTimer) clearTimeout(this.feedbackTimer);
    void this.audioCtx?.close();
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
