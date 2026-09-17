import {
  Component,
  ElementRef,
  HostListener,
  NgZone,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { ArMarker } from '../ar-markers';
import { LnmDataService } from '../lnm-data.service';
import { RewardsService } from '../rewards.service';
import { ParticleFxService } from '../../shared/particle-fx/particle-fx.service';
import { ArModelViewerComponent } from '../ar-3d/ar-model-viewer.component';
import { ArAnimMode } from '../ar-3d/ar-model.types';
import { ScanModo } from '../lnm-catalog.types';
import { MindArService, MindTargetsFile } from '../mind-ar.service';
import {
  SectionPill,
  SectionShellComponent,
} from '../../shared/section-shell/section-shell.component';

export type ArAction = 'info' | 'stats' | 'video' | 'anim' | 'foto';

interface ScanModeOption {
  id: ScanModo;
  label: string;
  icon: string;
  hint: string;
}

@Component({
  selector: 'app-ar-scanner',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    ArModelViewerComponent,
    SectionShellComponent,
  ],
  templateUrl: './ar-scanner.component.html',
  styleUrl: './ar-scanner.component.scss',
})
export class ArScannerComponent implements OnInit, OnDestroy {
  @ViewChild('mindarHost') mindarHost?: ElementRef<HTMLElement>;
  @ViewChild('cameraFrame') cameraFrame?: ElementRef<HTMLElement>;
  @ViewChild(ArModelViewerComponent) modelViewer?: ArModelViewerComponent;

  private catalog: ArMarker[] = [];
  private lastHitId: string | null = null;
  private lastHitAt = 0;
  private readonly findCooldownMs = 600;
  private mindConfig: MindTargetsFile | null = null;
  private engineStarting = false;
  private trackedTargetIndex: number | null = null;

  cameraActive = signal(false);
  scanning = signal(false);
  cameraError = signal<string | null>(null);
  showCameraModal = signal(false);
  cameraBusy = signal(false);
  engineStatus = signal<string | null>(null);
  compileProgress = signal<number | null>(null);
  activeMarker = signal<ArMarker | null>(null);
  recentScans = signal<ArMarker[]>([]);
  feedback = signal<string | null>(null);
  scanMiss = signal<string | null>(null);
  scanMode = signal<ScanModo>('logo');
  animating = signal(false);
  animMode = signal<ArAnimMode>('idle');
  showInfo = signal(false);
  showStats = signal(false);
  videoPlaying = signal(false);
  videoProgress = signal(0);
  showParticles = signal(false);
  capturing = signal(false);
  lastPhotoUrl = signal<string | null>(null);
  btnPressed = signal<string | null>(null);
  activeAction = signal<ArAction | null>(null);

  readonly scanModes: ScanModeOption[] = [
    {
      id: 'tarjeta',
      label: 'Tarjeta',
      icon: 'badge',
      hint: 'Escanea algo de baseball y ve lo que sucede.',
    },
    {
      id: 'gorra',
      label: 'Gorra',
      icon: 'style',
      hint: 'Escanea algo de baseball y ve lo que sucede.',
    },
    {
      id: 'logo',
      label: 'Logo',
      icon: 'shield',
      hint: 'Escanea algo de baseball y ve lo que sucede.',
    },
  ];

  readonly modePills: SectionPill[] = this.scanModes.map((m) => ({
    id: m.id,
    label: m.label,
  }));

  private feedbackTimer: ReturnType<typeof setTimeout> | null = null;
  private animTimer: ReturnType<typeof setTimeout> | null = null;
  private videoTimer: ReturnType<typeof setInterval> | null = null;
  private missTimer: ReturnType<typeof setTimeout> | null = null;
  private photoUrlToRevoke: string | null = null;
  private audioCtx: AudioContext | null = null;

  private readonly zone = inject(NgZone);
  private readonly fx = inject(ParticleFxService);
  private readonly lnm = inject(LnmDataService);
  private readonly rewards = inject(RewardsService);
  private readonly mindAr = inject(MindArService);

  ngOnInit(): void {
    this.rewards.loadCatalog().subscribe();
    this.lnm.loadCatalog().subscribe((bundle) => {
      this.catalog = bundle.all;
    });
    this.mindAr.loadConfig().subscribe({
      next: (cfg) => (this.mindConfig = cfg),
      error: () =>
        this.cameraError.set('No se pudo cargar assets/data/mind-targets.json'),
    });
  }

  onModePill(id: string): void {
    if (id !== 'tarjeta' && id !== 'gorra' && id !== 'logo') return;
    void this.setScanMode(id);
  }

  async setScanMode(mode: ScanModo, event?: Event): Promise<void> {
    if (this.scanMode() === mode) return;
    this.scanMode.set(mode);
    this.scanMiss.set(null);
    this.clearLiveDetection(false);
    this.ping(`Modo: ${this.modeShortLabel()}`);
    this.fx.burst('spark', event);
    if (this.cameraActive()) await this.restartEngine();
  }

  modeHint(): string {
    return (
      this.mindConfig?.modes[this.scanMode()]?.hint ??
      this.scanModes.find((m) => m.id === this.scanMode())?.hint ??
      'Apunta al marcador dentro del cuadro.'
    );
  }

  modeShortLabel(): string {
    return this.scanModes.find((m) => m.id === this.scanMode())?.label ?? 'objeto';
  }

  currentTargets(): { id: string; image: string }[] {
    return this.mindConfig?.modes[this.scanMode()]?.targets ?? [];
  }

  /** Abre el PNG del target. */
  openTargetImage(image: string, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    window.open(image, '_blank', 'noopener');
    this.ping('Marcador abierto · o usa Detectar ahora');
    this.fx.burst('spark', event);
  }

  /** Fuerza la ficha del target (demo / si la cámara no pega). */
  forceDetectTarget(id: string, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    const marker = this.catalog.find((m) => m.id === id);
    if (!marker) {
      this.ping(`Sin ficha para ${id}`);
      return;
    }
    this.applyDetection(marker, event);
    this.ping(`Detectado (manual): ${marker.nombre}`);
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
      // MindARThree pide la cámara (como el tutorial oficial)
      this.cameraActive.set(true);
      this.lastHitId = null;
      // Espera un tick para que #mindarHost exista en el DOM
      await new Promise<void>((r) => setTimeout(r, 0));
      await this.restartEngine();
      this.fx.burst('confetti', event);
    } catch (err) {
      this.cameraError.set(
        err instanceof Error
          ? err.message
          : 'No se pudo iniciar MindAR. Usa Chrome en localhost/HTTPS.',
      );
      this.cameraActive.set(false);
      this.scanning.set(false);
      await this.stopEngines();
    } finally {
      this.cameraBusy.set(false);
    }
  }

  async stopCamera(event?: Event): Promise<void> {
    this.clearMissTimer();
    await this.stopEngines();
    this.cameraActive.set(false);
    this.scanning.set(false);
    this.engineStatus.set(null);
    this.compileProgress.set(null);
    this.trackedTargetIndex = null;

    const current = this.activeMarker();
    if (current) {
      this.pushRecent(current);
      this.clearLiveDetection(false);
      this.ping(`Cámara apagada. Guardado: ${current.nombre}`);
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
    this.showParticles.set(true);
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

    if (action === 'foto') {
      void this.capturePhoto(event);
      return;
    }

    switch (action) {
      case 'stats':
        this.stopVideoProgress();
        this.showStats.set(true);
        this.showInfo.set(false);
        this.videoPlaying.set(false);
        this.showParticles.set(true);
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
        this.showParticles.set(next);
        this.activeAction.set(next ? 'video' : null);
        if (next) {
          this.startVideoProgress();
          this.runAnim('spin', 2800);
          this.fx.burstCenter('homer');
          this.ping(`Video + partículas: ${marker.videoHint}`);
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
        this.showParticles.set(true);
        this.activeAction.set('anim');
        this.runAnim(
          marker.tipo === 'gorra' || marker.tipo === 'logo' || marker.tipo === 'pelota'
            ? 'showcase'
            : 'swing',
          3200,
        );
        this.fx.burst('homer', event);
        this.ping(`Animación 3D: ${marker.animationLabel}`);
        break;

      case 'info':
        this.stopVideoProgress();
        this.showInfo.set(true);
        this.showStats.set(false);
        this.videoPlaying.set(false);
        this.showParticles.set(true);
        this.activeAction.set('info');
        this.runAnim('spin', 2000);
        this.fx.burst('spark', event);
        this.ping(`Info: ${marker.nombre}`);
        break;
    }
  }

  /** Captura foto: cámara + modelo 3D + etiqueta. */
  async capturePhoto(event?: Event): Promise<void> {
    const video = this.mindAr.getVideo();
    const frame = this.cameraFrame?.nativeElement;
    const marker = this.activeMarker();
    if (!video || !frame || !this.cameraActive() || this.capturing()) return;

    this.capturing.set(true);
    this.activeAction.set('foto');
    this.fx.burst('confetti', event);
    this.showParticles.set(true);

    try {
      const w = frame.clientWidth || video.clientWidth || 640;
      const h = frame.clientHeight || video.clientHeight || 480;
      const out = document.createElement('canvas');
      out.width = Math.max(1, Math.round(w));
      out.height = Math.max(1, Math.round(h));
      const ctx = out.getContext('2d');
      if (!ctx) throw new Error('Canvas 2D no disponible');

      // Video de fondo (cover)
      const vw = video.videoWidth || w;
      const vh = video.videoHeight || h;
      const scale = Math.max(out.width / vw, out.height / vh);
      const dw = vw * scale;
      const dh = vh * scale;
      const dx = (out.width - dw) / 2;
      const dy = (out.height - dh) / 2;
      ctx.drawImage(video, dx, dy, dw, dh);

      // Overlay 3D
      const glCanvas = this.modelViewer?.getCanvas();
      if (glCanvas && glCanvas.width > 0) {
        const scene = frame.querySelector('.ar-scene') as HTMLElement | null;
        const rect = frame.getBoundingClientRect();
        const sceneRect = scene?.getBoundingClientRect();
        if (sceneRect) {
          const sx = sceneRect.left - rect.left;
          const sy = sceneRect.top - rect.top;
          ctx.drawImage(
            glCanvas,
            sx,
            sy,
            sceneRect.width,
            sceneRect.height,
          );
        } else {
          const size = Math.min(out.width, out.height) * 0.55;
          ctx.drawImage(
            glCanvas,
            (out.width - size) / 2,
            out.height * 0.18,
            size,
            size,
          );
        }
      }

      // Etiqueta
      if (marker) {
        ctx.fillStyle = 'rgba(8, 16, 24, 0.72)';
        const labelH = Math.max(36, out.height * 0.08);
        ctx.fillRect(0, out.height - labelH, out.width, labelH);
        ctx.fillStyle = '#fff';
        ctx.font = `700 ${Math.max(14, Math.round(out.width * 0.035))}px Lexend Deca, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(
          marker.nombre,
          out.width / 2,
          out.height - labelH / 2,
          out.width * 0.9,
        );
      }

      const blob = await new Promise<Blob | null>((resolve) =>
        out.toBlob(resolve, 'image/jpeg', 0.92),
      );
      if (!blob) throw new Error('No se pudo generar la imagen');

      if (this.photoUrlToRevoke) URL.revokeObjectURL(this.photoUrlToRevoke);
      const url = URL.createObjectURL(blob);
      this.photoUrlToRevoke = url;
      this.lastPhotoUrl.set(url);

      const a = document.createElement('a');
      a.href = url;
      a.download = `diamante9-${marker?.id || 'scan'}-${Date.now()}.jpg`;
      a.click();

      this.ping(`Foto guardada · ${marker?.nombre || 'escaneo'}`);
      this.fx.burstCenter('confetti');
    } catch {
      this.ping('No se pudo tomar la foto');
    } finally {
      this.capturing.set(false);
      if (this.activeAction() === 'foto') this.activeAction.set(null);
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
      case 'gorra':
        return 'Gorra';
      case 'logo':
        return 'Logo';
      case 'pelota':
        return 'Pelota';
    }
  }

  ngOnDestroy(): void {
    void this.stopEngines();
    this.clearLiveDetection(false);
    this.stopVideoProgress();
    this.clearMissTimer();
    if (this.animTimer) clearTimeout(this.animTimer);
    if (this.photoUrlToRevoke) URL.revokeObjectURL(this.photoUrlToRevoke);
    document.body.style.overflow = '';
    if (this.feedbackTimer) clearTimeout(this.feedbackTimer);
    void this.audioCtx?.close();
  }

  private async stopEngines(): Promise<void> {
    await this.mindAr.stop();
  }

  private async restartEngine(): Promise<void> {
    if (this.engineStarting) return;
    const host = this.mindarHost?.nativeElement;
    const mode = this.scanMode();
    const modeCfg = this.mindConfig?.modes[mode];
    if (!host || !modeCfg || !this.cameraActive()) return;

    this.engineStarting = true;
    this.scanning.set(false);
    this.compileProgress.set(null);
    this.scanMiss.set(null);
    this.clearLiveDetection(false);
    await this.stopEngines();

    try {
      this.engineStatus.set('Iniciando MindARThree…');
      await this.mindAr.start(
        mode,
        host,
        modeCfg,
        (index, found) => this.zone.run(() => this.onMindTarget(index, found)),
        (message) => {
          this.zone.run(() => this.engineStatus.set(message));
        },
      );
      this.scanning.set(true);
      this.engineStatus.set(`MindAR · ${modeCfg.targets.length} targets`);
      this.compileProgress.set(null);
      this.scheduleMissHint();
      this.ping(`Escaneando ${this.modeShortLabel()} (MindAR)`);
    } catch (err) {
      const detail =
        err instanceof Error ? err.message : 'Error al iniciar escáner';
      this.cameraError.set(detail);
      this.scanning.set(false);
      this.engineStatus.set(null);
      throw err;
    } finally {
      this.engineStarting = false;
    }
  }

  private onMindTarget(index: number, found: boolean): void {
    if (!found) {
      if (this.trackedTargetIndex === index) {
        this.clearLiveDetection(true);
        this.trackedTargetIndex = null;
      }
      this.scheduleMissHint();
      return;
    }

    const id = this.mindAr.getTargetId(index);
    if (!id) return;

    const now = Date.now();
    if (id === this.activeMarker()?.id) {
      this.lastHitId = id;
      this.lastHitAt = now;
      this.trackedTargetIndex = index;
      this.scanMiss.set(null);
      this.clearMissTimer();
      return;
    }

    if (this.activeMarker() && now - this.lastHitAt < this.findCooldownMs) {
      return;
    }

    const marker = this.catalog.find((m) => m.id === id);
    if (!marker) {
      this.scanMiss.set(`Target ${id} sin ficha en catálogo`);
      return;
    }

    this.trackedTargetIndex = index;
    this.applyDetection(marker);
  }

  /** Quita modelo, paneles y partículas al perder el marcador. */
  private clearLiveDetection(announce: boolean): void {
    this.activeMarker.set(null);
    this.lastHitId = null;
    this.clearPanels(true);
    this.showParticles.set(false);
    if (announce) this.ping('Marcador fuera de vista');
  }

  private scheduleMissHint(): void {
    this.clearMissTimer();
    if (this.activeMarker() || !this.scanning()) return;
    this.missTimer = setTimeout(() => {
      if (!this.activeMarker() && this.scanning()) {
        this.scanMiss.set(
          'Sin match MindAR. Abre el PNG exacto del sidebar (logo-demo primero) o imprímelo.',
        );
      }
    }, 6000);
  }

  private clearMissTimer(): void {
    if (this.missTimer) clearTimeout(this.missTimer);
    this.missTimer = null;
  }

  private applyDetection(marker: ArMarker, event?: Event): void {
    const prev = this.activeMarker();
    if (prev && prev.id !== marker.id) this.pushRecent(prev);

    this.activeMarker.set(marker);
    this.lastHitId = marker.id;
    this.lastHitAt = Date.now();
    this.scanMiss.set(null);
    this.clearMissTimer();
    this.clearPanels(false);
    this.showParticles.set(true);

    if (marker.tipo === 'gorra' || marker.tipo === 'logo' || marker.tipo === 'pelota') {
      this.activeAction.set('anim');
      this.runAnim('showcase', 4200);
    } else {
      this.activeAction.set('stats');
      this.runAnim('pulse3d', 1600);
    }

    this.ping(
      marker.tipo === 'logo' || marker.tipo === 'gorra' || marker.tipo === 'pelota'
        ? `Sí · ${marker.equipo || marker.nombre}`
        : `Detectado: ${marker.nombre}`,
    );
    this.playClick();
    this.fx.burst('confetti', event);

    const unlocked = this.rewards.recordScan(marker.id, this.scanMode());
    if (unlocked) this.ping(`¡${unlocked}!`);
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
    this.feedbackTimer = setTimeout(() => this.feedback.set(null), 2800);
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
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        this.audioCtx.currentTime + 0.08,
      );
      osc.stop(this.audioCtx.currentTime + 0.09);
    } catch {
      /* audio opcional */
    }
  }
}
