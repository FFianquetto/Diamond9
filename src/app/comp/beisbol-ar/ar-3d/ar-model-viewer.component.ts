import {
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
  ViewChild,
  inject,
} from '@angular/core';
import * as THREE from 'three';
import { ArModelLoaderService } from './ar-model-loader.service';
import { ArAnimMode } from './ar-model.types';
import { LnmItemType } from '../lnm-catalog.types';

@Component({
  selector: 'app-ar-model-viewer',
  standalone: true,
  template: `<canvas #canvas class="ar-model-canvas" aria-hidden="true"></canvas>`,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
        height: 100%;
      }
      .ar-model-canvas {
        display: block;
        width: 100%;
        height: 100%;
        touch-action: none;
      }
    `,
  ],
})
export class ArModelViewerComponent implements OnInit, OnChanges, OnDestroy {
  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  @Input({ required: false }) markerId = '';
  @Input({ required: false }) markerTipo: LnmItemType = 'jugador';
  /** Si se define, carga el modelo directo por clave (galería 3D). */
  @Input() modelKey = '';
  @Input() accentColor = '#00e5ff';
  @Input() animMode: ArAnimMode = 'idle';
  @Input() active = true;

  private readonly loader = inject(ArModelLoaderService);

  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private model: THREE.Object3D | null = null;
  private raf = 0;
  private startedAt = 0;
  private resizeObs: ResizeObserver | null = null;
  private ready = false;
  private pendingKey = '';
  private loadToken = 0;

  ngOnInit(): void {
    this.loader.loadManifest().subscribe(() => {
      this.ready = true;
      this.initScene();
      void this.swapModel();
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.ready) return;
    if (
      changes['markerId'] ||
      changes['markerTipo'] ||
      changes['modelKey'] ||
      changes['accentColor'] ||
      changes['animMode'] ||
      changes['active']
    ) {
      void this.swapModel();
    }
  }

  ngOnDestroy(): void {
    this.stopLoop();
    this.resizeObs?.disconnect();
    if (this.model) this.loader.disposeObject(this.model);
    this.renderer?.dispose();
    this.renderer = null;
  }

  private initScene(): void {
    const canvas = this.canvasRef.nativeElement;
    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
      failIfMajorPerformanceCaveat: false,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 200);
    camera.position.set(0, 0.2, 3.4);
    camera.lookAt(0, 0, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 1.2));
    const hemi = new THREE.HemisphereLight(0xffffff, 0x1a2a33, 0.9);
    const key = new THREE.DirectionalLight(0xffffff, 1.4);
    key.position.set(2.5, 4.5, 3);
    const fill = new THREE.DirectionalLight(0xa8f0ff, 0.7);
    fill.position.set(-2.5, 1.5, -1.5);
    const rim = new THREE.DirectionalLight(0xffffff, 0.45);
    rim.position.set(0, 2, -3);
    scene.add(hemi, key, fill, rim);

    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.startedAt = performance.now();

    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(canvas.parentElement ?? canvas);
    this.resize();
    this.startLoop();
  }

  private async swapModel(): Promise<void> {
    if (!this.scene || !this.active) return;
    if (!this.modelKey && !this.markerId) return;

    const resolved = this.modelKey
      ? this.loader.resolveByKey(this.modelKey)
      : this.loader.resolve({
          markerId: this.markerId,
          tipo: this.markerTipo,
        });
    if (!resolved) return;

    const key = `${resolved.key}:${this.accentColor}`;
    if (key === this.pendingKey && this.model) return;
    this.pendingKey = key;
    const token = ++this.loadToken;

    // Placeholder inmediato para no dejar la card vacía mientras carga un GLB pesado.
    if (this.model) {
      this.scene.remove(this.model);
      this.loader.disposeObject(this.model);
      this.model = null;
    }
    const placeholder = this.loader.createPlaceholder(resolved.entry.fallback, this.accentColor);
    this.model = placeholder;
    this.scene.add(placeholder);
    this.frameModel(placeholder);

    try {
      const next = await this.loader.loadModel(resolved, this.accentColor);
      if (token !== this.loadToken || !this.scene) {
        this.loader.disposeObject(next);
        return;
      }
      this.scene.remove(placeholder);
      this.loader.disposeObject(placeholder);
      this.model = next;
      this.scene.add(next);
      this.frameModel(next);
      this.resize();
    } catch (err) {
      console.warn('[AR 3D] swapModel:', err);
    }
  }

  private frameModel(obj: THREE.Object3D): void {
    if (!this.camera) return;
    const box = new THREE.Box3().setFromObject(obj);
    if (box.isEmpty()) return;

    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z, 0.001);
    const fov = THREE.MathUtils.degToRad(this.camera.fov);
    const dist = (maxDim * 0.55) / Math.tan(fov * 0.5);
    const zoom = this.modelKey === 'guante' ? 1.5 : 1;

    this.camera.position.set(center.x, center.y + maxDim * 0.02, center.z + (dist * 1.35) / zoom);
    this.camera.near = Math.max(dist / 100, 0.01);
    this.camera.far = Math.max(dist * 40, 50);
    this.camera.lookAt(center.x, center.y, center.z);
    this.camera.updateProjectionMatrix();
  }

  private resize(): void {
    if (!this.renderer || !this.camera) return;
    const parent = this.canvasRef.nativeElement.parentElement;
    const w = Math.max(parent?.clientWidth ?? 140, 1);
    const h = Math.max(parent?.clientHeight ?? 140, 1);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.model) this.frameModel(this.model);
  }

  private startLoop(): void {
    this.stopLoop();
    const tick = (now: number) => {
      if (!this.renderer || !this.scene || !this.camera) return;
      if (this.active) {
        if (this.model) {
          this.loader.applyAnimation(this.model, this.animMode, now - this.startedAt);
        }
        this.renderer.render(this.scene, this.camera);
      }
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  private stopLoop(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }
}
