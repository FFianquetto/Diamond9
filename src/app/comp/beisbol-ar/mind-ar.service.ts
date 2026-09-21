import { Injectable, inject, NgZone } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, firstValueFrom } from 'rxjs';
import { ScanModo } from './lnm-catalog.types';

export interface MindTargetEntry {
  id: string;
  image: string;
}

export interface MindModeConfig {
  label: string;
  mindFile: string;
  hint: string;
  targets: MindTargetEntry[];
}

export interface MindTargetsFile {
  version: number;
  modes: Record<ScanModo, MindModeConfig>;
}

export type MindTargetHandler = (targetIndex: number, found: boolean) => void;

interface MindARThreeAnchor {
  onTargetFound: (() => void) | null;
  onTargetLost: (() => void) | null;
}

interface MindARThreeInstance {
  start: () => Promise<void>;
  stop: () => void;
  addAnchor: (targetIndex: number) => MindARThreeAnchor;
  video: HTMLVideoElement;
  scene: unknown;
  camera: unknown;
  renderer: {
    domElement: HTMLElement;
    setAnimationLoop: (cb: null | (() => void)) => void;
    render: (scene: unknown, camera: unknown) => void;
  };
  cssRenderer: { domElement: HTMLElement };
}

type MindARThreeCtor = new (opts: {
  container: HTMLElement;
  imageTargetSrc: string;
  maxTrack?: number;
  uiLoading?: string;
  uiScanning?: string;
  uiError?: string;
  warmupTolerance?: number;
  missTolerance?: number;
}) => MindARThreeInstance;

/**
 * Image Tracking oficial (MindARThree).
 *
 * MindAR nos da (y es suficiente para Diamante 9):
 * - Cámara + detección de imágenes compiladas (.mind)
 * - Multi-target + onTargetFound / onTargetLost
 * - Video del stream (para foto)
 *
 * No es IA/OCR: reconoce el PNG exacto (impreso o en pantalla).
 * @see https://hiukim.github.io/mind-ar-js-doc/more-examples/threejs-image
 * @see https://www.mindar.org/
 */
@Injectable({ providedIn: 'root' })
export class MindArService {
  private readonly http = inject(HttpClient);
  private readonly zone = inject(NgZone);

  private mindar: MindARThreeInstance | null = null;
  private container: HTMLElement | null = null;
  private activeMode: ScanModo | null = null;
  private targets: MindTargetEntry[] = [];
  private handler: MindTargetHandler | null = null;
  private loadPromise: Promise<MindARThreeCtor> | null = null;

  loadConfig(): Observable<MindTargetsFile> {
    return this.http.get<MindTargetsFile>('assets/data/mind-targets.json');
  }

  async fetchConfig(): Promise<MindTargetsFile> {
    return firstValueFrom(this.loadConfig());
  }

  getTargetId(index: number): string | null {
    return this.targets[index]?.id ?? null;
  }

  getTargets(): MindTargetEntry[] {
    return this.targets;
  }

  getVideo(): HTMLVideoElement | null {
    return this.mindar?.video ?? null;
  }

  get mode(): ScanModo | null {
    return this.activeMode;
  }

  async ensureApi(): Promise<MindARThreeCtor> {
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = (async () => {
      // Bare specifier resuelto en runtime por el import map de index.html
      const spec = 'mindar-image-three';
      const mod = (await import(/* @vite-ignore */ spec)) as {
        MindARThree?: MindARThreeCtor;
      };
      const ctor = mod.MindARThree;
      if (!ctor) {
        throw new Error(
          'MindARThree no disponible. Revisa el import map en index.html.',
        );
      }
      return ctor;
    })();

    try {
      return await this.loadPromise;
    } catch (err) {
      this.loadPromise = null;
      throw err;
    }
  }

  async start(
    mode: ScanModo,
    container: HTMLElement,
    config: MindModeConfig,
    onTarget: MindTargetHandler,
    onProgress?: (message: string) => void,
  ): Promise<void> {
    await this.stop();
    const MindARThree = await this.ensureApi();

    this.activeMode = mode;
    this.targets = [...config.targets];
    this.handler = onTarget;
    this.container = container;

    container.replaceChildren();
    Object.assign(container.style, {
      position: 'relative',
      overflow: 'hidden',
      width: '100%',
      height: '100%',
    });

    onProgress?.('Iniciando MindAR…');

    // Logo más estricto; gorra un punto medio (detecta bien sin disparar a lo lejos)
    const mindar = new MindARThree({
      container,
      imageTargetSrc: config.mindFile,
      maxTrack: 1,
      uiLoading: 'no',
      uiScanning: 'no',
      uiError: 'yes',
      warmupTolerance: mode === 'logo' ? 8 : mode === 'gorra' ? 5 : 3,
      missTolerance: mode === 'logo' ? 6 : 10,
    });
    this.mindar = mindar;

    for (let i = 0; i < config.targets.length; i++) {
      const anchor = mindar.addAnchor(i);
      const idx = i;
      anchor.onTargetFound = () => {
        this.zone.run(() => this.handler?.(idx, true));
      };
      anchor.onTargetLost = () => {
        this.zone.run(() => this.handler?.(idx, false));
      };
    }

    mindar.renderer.domElement.style.visibility = 'hidden';
    mindar.renderer.domElement.style.pointerEvents = 'none';
    mindar.cssRenderer.domElement.style.display = 'none';

    onProgress?.('Pidiendo cámara…');
    await mindar.start();

    const video = mindar.video;
    Object.assign(video.style, {
      position: 'absolute',
      inset: '0',
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      zIndex: '0',
    });
    video.playsInline = true;
    video.muted = true;

    const { renderer, scene, camera } = mindar;
    this.zone.runOutsideAngular(() => {
      renderer.setAnimationLoop(() => {
        renderer.render(scene, camera);
      });
    });

    onProgress?.(`MindAR listo · ${config.targets.length} targets`);
  }

  async stop(): Promise<void> {
    if (this.mindar) {
      try {
        this.mindar.renderer.setAnimationLoop(null);
        this.mindar.stop();
      } catch {
        /* ignore */
      }
    }
    this.mindar = null;
    this.container?.replaceChildren();
    this.container = null;
    this.activeMode = null;
    this.targets = [];
    this.handler = null;
  }
}
