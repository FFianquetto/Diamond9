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
import { ScanModo } from '../lnm-catalog.types';
import { ScanApiResponse, ScanApiService } from '../scan-api.service';

export type ArAction = 'info' | 'stats' | 'video' | 'anim';

interface ScanModeOption {
  id: ScanModo;
  label: string;
  icon: string;
  hint: string;
}

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
  scanMiss = signal<string | null>(null);
  scanMode = signal<ScanModo>('tarjeta');
  apiOnline = signal(false);
  animating = signal(false);
  animMode = signal<ArAnimMode>('idle');
  showInfo = signal(false);
  showStats = signal(false);
  videoPlaying = signal(false);
  videoProgress = signal(0);
  btnPressed = signal<string | null>(null);
  activeAction = signal<ArAction | null>(null);

  readonly scanModes: ScanModeOption[] = [
    {
      id: 'tarjeta',
      label: 'Tarjeta',
      icon: 'badge',
      hint: 'Apunta a una carta de jugador, escudo o cartel de liga.',
    },
    {
      id: 'gorra',
      label: 'Gorra',
        icon: 'style',
      hint: 'Apunta al logo frontal de la gorra. Te diremos si es de un equipo conocido.',
    },
    {
      id: 'pelota',
      label: 'Pelota',
      icon: 'sports_baseball',
      hint: 'Acerca una pelota de beisbol (cuero claro y costuras rojas).',
    },
  ];

  private stream: MediaStream | null = null;
  private feedbackTimer: ReturnType<typeof setTimeout> | null = null;
  private scanTimer: ReturnType<typeof setInterval> | null = null;
  private cloudTimer: ReturnType<typeof setInterval> | null = null;
  private animTimer: ReturnType<typeof setTimeout> | null = null;
  private videoTimer: ReturnType<typeof setInterval> | null = null;
  private audioCtx: AudioContext | null = null;
  private readonly fx = inject(ParticleFxService);
  private readonly lnm = inject(LnmDataService);
  private readonly matcher = inject(MarkerMatcherService);
  private readonly rewards = inject(RewardsService);
  private readonly scanApi = inject(ScanApiService);

  ngOnInit(): void {
    this.rewards.loadCatalog().subscribe();
    this.lnm.loadCatalog().subscribe((bundle) => {
      this.catalog = bundle.all;
    });
    this.lnm.loadScanProfiles().subscribe(async (profiles) => {
      await this.matcher.loadProfiles(profiles);
      this.matcher.setMode(this.scanMode());
    });
    this.scanApi.health().subscribe((h) => this.apiOnline.set(!!h.ok));
  }

  setScanMode(mode: ScanModo, event?: Event): void {
    if (this.scanMode() === mode) return;
    this.scanMode.set(mode);
    this.matcher.setMode(mode);
    this.scanMiss.set(null);
    this.lastHitId = null;
    this.ping(`Modo: ${this.modeShortLabel()}`);
    this.fx.burst('spark', event);
  }

  modeHint(): string {
    return (
      this.scanModes.find((m) => m.id === this.scanMode())?.hint ??
      'Apunta al objeto dentro del cuadro.'
    );
  }

  modeShortLabel(): string {
    return this.scanModes.find((m) => m.id === this.scanMode())?.label ?? 'objeto';
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
      this.scanApi.health().subscribe((h) => {
        this.apiOnline.set(!!h.ok);
        if (h.ok) {
          this.ping(`API lista · modo ${this.modeShortLabel()} (Roboflow/OCR/DB)`);
        } else {
          this.ping(
            `Escaneando local · para equipo en DB arranca: cd server && npm start`,
          );
        }
      });
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
      case 'gorra':
        return 'Gorra';
      case 'pelota':
        return 'Pelota';
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
    this.cloudTimer = setInterval(() => this.tickCloudScan(), 2400);
  }

  private stopScanLoop(): void {
    if (this.scanTimer) clearInterval(this.scanTimer);
    this.scanTimer = null;
    if (this.cloudTimer) clearInterval(this.cloudTimer);
    this.cloudTimer = null;
    this.scanning.set(false);
  }

  private tickScan(): void {
    const video = this.videoEl?.nativeElement;
    if (!video || !this.cameraActive() || !this.matcher.isReady) return;

    // Si la API está online, el cloud scan es la fuente de verdad para equipo.
    if (this.apiOnline()) return;

    const id = this.matcher.matchVideoFrame(video);
    if (!id) {
      this.maybeReportMiss();
      return;
    }

    const now = Date.now();
    if (id === this.activeMarker()?.id) {
      this.lastHitId = id;
      this.lastHitAt = now;
      this.scanMiss.set(null);
      return;
    }

    if (this.activeMarker() && now - this.lastHitAt < 900) return;

    const marker = this.catalog.find((m) => m.id === id);
    if (marker) this.applyDetection(marker);
  }

  /** Node → Roboflow → OCR → DB (equipo / jugador). */
  private tickCloudScan(): void {
    if (!this.cameraActive() || !this.apiOnline() || this.scanApi.isBusy) return;
    const video = this.videoEl?.nativeElement;
    if (!video) return;

    const frame = this.scanApi.captureFrame(video);
    if (!frame) return;

    this.scanApi.scan(frame, this.scanMode()).subscribe((res) => {
      this.handleCloudResult(res);
    });
  }

  private handleCloudResult(res: ScanApiResponse): void {
    if (!res.ok) {
      this.apiOnline.set(false);
      return;
    }

    if (!res.recognized) {
      if (!this.activeMarker()) {
        this.scanMiss.set(res.message || 'No reconocido en la base de datos');
      }
      return;
    }

    const marker = this.markerFromApi(res);
    if (!marker) return;

    if (marker.id === this.activeMarker()?.id) {
      this.lastHitAt = Date.now();
      this.scanMiss.set(null);
      return;
    }

    this.applyDetection(marker);
  }

  private markerFromApi(res: ScanApiResponse): ArMarker | null {
    const team = res.team;
    const player = res.player;
    if (!team && !player) return null;

    if (player) {
      const fromCatalog = this.catalog.find((m) => m.id === player.id);
      if (fromCatalog) {
        return {
          ...fromCatalog,
          equipo: player.equipo || fromCatalog.equipo,
          equipoReconocido: true,
          ligaOrigen: player.liga || team?.liga,
          subtitle: `Equipo: ${player.equipo || team?.nombre || '—'}`,
          info: `${res.message}. ${fromCatalog.info}`,
        };
      }

      return {
        id: player.id,
        tipo: 'jugador',
        nombre: player.nombre,
        subtitle: `Equipo: ${player.equipo || team?.nombre || 'DB'}`,
        color: team?.color || '#00E5FF',
        info: res.message,
        stats: Object.entries(player.stats || {}).map(([label, value]) => ({
          label,
          value: String(value),
        })),
        videoHint: `Highlight: ${player.nombre}`,
        animationLabel: 'Swing / celebración',
        tip: 'Detectado vía API (OCR + DB)',
        actions: 'Info · Stats · Video · Animación',
        equipo: player.equipo,
        posicion: player.posicion,
        equipoReconocido: true,
        ligaOrigen: player.liga || team?.liga,
        modelKey: team?.modelKey || undefined,
      };
    }

    if (!team) return null;

    const mode = this.scanMode();
    const catalogHit =
      this.catalog.find((m) => m.id === team.id) ||
      this.catalog.find((m) => m.id === `gorra-${team.id}`) ||
      (team.modelKey
        ? this.catalog.find((m) => m.modelKey === team.modelKey || m.id === team.modelKey)
        : undefined) ||
      this.catalog.find(
        (m) => m.equipo?.toLowerCase() === team.nombre.toLowerCase(),
      ) ||
      this.catalog.find(
        (m) =>
          !!team.abrev &&
          m.abrev?.toLowerCase() === String(team.abrev).toLowerCase(),
      );

    if (catalogHit) {
      return {
        ...catalogHit,
        equipo: team.nombre,
        equipoReconocido: true,
        ligaOrigen: team.liga,
        modelKey: team.modelKey || catalogHit.modelKey,
        subtitle: res.message,
        info: `${res.message}. ${catalogHit.info}`,
      };
    }

    const tipo = mode === 'pelota' ? 'pelota' : mode === 'gorra' ? 'gorra' : 'equipo';
    return {
      id: team.id,
      tipo,
      nombre: team.nombre,
      subtitle: res.message,
      color: team.color || '#00E5FF',
      info: res.message,
      stats: [
        { label: 'Equipo', value: team.nombre },
        { label: 'Liga', value: team.liga || '—' },
        { label: 'Match', value: 'Sí' },
      ],
      videoHint: `Clip: ${team.nombre}`,
      animationLabel: 'Rotación 3D',
      tip: 'Detectado vía API (Roboflow/OCR + DB)',
      actions: 'Info · Stats · Video · Animación',
      equipo: team.nombre,
      abrev: team.abrev,
      equipoReconocido: true,
      ligaOrigen: team.liga,
      modelKey:
        team.modelKey ||
        (tipo === 'pelota' ? 'pelota' : tipo === 'gorra' ? 'gorra-yankees' : 'bate'),
    };
  }

  private maybeReportMiss(): void {
    const mode = this.scanMode();
    if (mode === 'tarjeta') return;
    if (this.activeMarker()) return;

    // ~6 s sin match con evidencia en cámara (OCR o pelota)
    const threshold = mode === 'pelota' ? 10 : 12;
    if (this.matcher.unmatchedStreak < threshold) return;
    if (this.scanMiss()) return;

    const msg =
      mode === 'gorra'
        ? 'No parece una gorra de un equipo conocido (MLB/LNM/LMB). Prueba más luz o acerca el logo.'
        : 'No se detectó una pelota de beisbol clara. Acerca el objeto y centra las costuras.';
    this.scanMiss.set(msg);
    this.matcher.clearUnmatched();
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
    this.scanMiss.set(null);
    this.matcher.clearUnmatched();

    this.clearPanels(false);
    this.activeAction.set('stats');
    this.runAnim('pulse3d', 1600);

    const verdict =
      marker.tipo === 'gorra' || marker.tipo === 'pelota'
        ? marker.equipoReconocido === false
          ? `No reconocido: ${marker.nombre}`
          : `Sí · ${marker.equipo || marker.nombre}`
        : `Detectado: ${marker.nombre}`;
    this.ping(verdict);
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
