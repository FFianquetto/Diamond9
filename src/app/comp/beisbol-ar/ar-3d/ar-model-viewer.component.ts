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
import { ArAnimMode, AR_CELEBRATION_MODES } from './ar-model.types';
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
  @Input() modelKey = '';
  @Input() accentColor = '#00e5ff';
  @Input() animMode: ArAnimMode = 'idle';
  @Input() active = true;
  /** Partículas 3D (se intensifican con video / animación). */
  @Input() particles = false;

  private readonly loader = inject(ArModelLoaderService);

  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private model: THREE.Object3D | null = null;
  private particleSystem: THREE.Points | null = null;
  private particleVel: Float32Array | null = null;
  private keyLight: THREE.DirectionalLight | null = null;
  private rimLight: THREE.DirectionalLight | null = null;
  private fillLight: THREE.DirectionalLight | null = null;
  private raf = 0;
  private startedAt = 0;
  private resizeObs: ResizeObserver | null = null;
  private ready = false;
  private pendingKey = '';
  private loadToken = 0;
  private readonly isMobile =
    typeof window !== 'undefined' &&
    (window.matchMedia('(max-width: 820px)').matches ||
      window.matchMedia('(pointer: coarse)').matches);

  ngOnInit(): void {
    this.loader.loadManifest().subscribe(() => {
      this.ready = true;
      this.initScene();
      void this.swapModel();
      this.syncParticles();
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.ready) return;

    if (changes['particles'] || changes['accentColor']) {
      this.syncParticles();
    }

    if (changes['animMode']) {
      this.startedAt = performance.now();
      this.applyCelebrationLights();
      this.boostParticlesForAnim();
      if (
        !changes['markerId'] &&
        !changes['markerTipo'] &&
        !changes['modelKey'] &&
        !changes['accentColor'] &&
        !changes['active']
      ) {
        return;
      }
    }

    if (
      changes['markerId'] ||
      changes['markerTipo'] ||
      changes['modelKey'] ||
      changes['accentColor'] ||
      changes['active']
    ) {
      void this.swapModel();
    }
  }

  ngOnDestroy(): void {
    this.stopLoop();
    this.resizeObs?.disconnect();
    this.disposeParticles();
    if (this.model) this.loader.disposeObject(this.model);
    this.renderer?.dispose();
    this.renderer = null;
  }

  /** Canvas WebGL para composición de fotos. */
  getCanvas(): HTMLCanvasElement | null {
    return this.canvasRef?.nativeElement ?? null;
  }

  private initScene(): void {
    const canvas = this.canvasRef.nativeElement;
    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: !this.isMobile,
      preserveDrawingBuffer: true,
      powerPreference: this.isMobile ? 'low-power' : 'high-performance',
      failIfMajorPerformanceCaveat: false,
    });
    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio || 1, this.isMobile ? 1 : 1.25),
    );
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
    scene.add(hemi, key);

    // En móvil: menos luces = menos GPU
    if (!this.isMobile) {
      const fill = new THREE.DirectionalLight(0xa8f0ff, 0.7);
      fill.position.set(-2.5, 1.5, -1.5);
      const rim = new THREE.DirectionalLight(0xffffff, 0.45);
      rim.position.set(0, 2, -3);
      scene.add(fill, rim);
      this.fillLight = fill;
      this.rimLight = rim;
    }

    this.keyLight = key;
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.startedAt = performance.now();
    this.applyCelebrationLights();

    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(canvas.parentElement ?? canvas);
    this.resize();
    this.startLoop();
  }

  private applyCelebrationLights(): void {
    const celebrating = AR_CELEBRATION_MODES.has(this.animMode);
    const accent = new THREE.Color(this.accentColor || '#00e5ff');
    if (this.keyLight) {
      this.keyLight.intensity = celebrating ? 1.85 : 1.4;
      this.keyLight.color = celebrating ? accent.clone().lerp(new THREE.Color(0xffffff), 0.45) : new THREE.Color(0xffffff);
    }
    if (this.fillLight) {
      this.fillLight.intensity = celebrating ? 1.05 : 0.7;
      this.fillLight.color = accent;
    }
    if (this.rimLight) {
      this.rimLight.intensity = celebrating ? 0.95 : 0.45;
      this.rimLight.color = celebrating ? accent : new THREE.Color(0xffffff);
    }
  }

  private boostParticlesForAnim(): void {
    if (!this.particleSystem) return;
    const mat = this.particleSystem.material as THREE.PointsMaterial;
    const celebrating = AR_CELEBRATION_MODES.has(this.animMode);
    mat.size = celebrating ? 0.07 : 0.045;
    mat.opacity = celebrating ? 1 : 0.85;
    mat.color = new THREE.Color(this.accentColor || '#00e5ff');
  }

  private syncParticles(): void {
    if (!this.scene) return;
    if (!this.particles) {
      this.disposeParticles();
      return;
    }
    if (this.particleSystem) {
      this.boostParticlesForAnim();
      return;
    }

    const count = this.isMobile ? 72 : 160;
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const r = 0.35 + Math.random() * 1.4;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i3 + 2] = r * Math.cos(phi);
      velocities[i3] = (Math.random() - 0.5) * 0.012;
      velocities[i3 + 1] = 0.008 + Math.random() * 0.018;
      velocities[i3 + 2] = (Math.random() - 0.5) * 0.012;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.045,
      color: new THREE.Color(this.accentColor || '#00e5ff'),
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    this.particleSystem = points;
    this.particleVel = velocities;
    this.scene.add(points);
    this.boostParticlesForAnim();
  }

  private disposeParticles(): void {
    if (!this.particleSystem) return;
    this.scene?.remove(this.particleSystem);
    this.particleSystem.geometry.dispose();
    (this.particleSystem.material as THREE.PointsMaterial).dispose();
    this.particleSystem = null;
    this.particleVel = null;
  }

  private tickParticles(): void {
    if (!this.particleSystem || !this.particleVel) return;
    const celebrating = AR_CELEBRATION_MODES.has(this.animMode);
    const pos = this.particleSystem.geometry.getAttribute(
      'position',
    ) as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    const vel = this.particleVel;
    const speed = celebrating ? 1.65 : 1;
    for (let i = 0; i < arr.length; i += 3) {
      arr[i] += vel[i] * speed;
      arr[i + 1] += vel[i + 1] * speed;
      arr[i + 2] += vel[i + 2] * speed;
      if (arr[i + 1] > 1.8) {
        arr[i + 1] = -1.2;
        arr[i] = (Math.random() - 0.5) * 2.2;
        arr[i + 2] = (Math.random() - 0.5) * 2.2;
      }
    }
    pos.needsUpdate = true;
    this.particleSystem.rotation.y += celebrating ? 0.012 : 0.004;
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

    if (this.model) {
      this.scene.remove(this.model);
      this.loader.disposeObject(this.model);
      this.model = null;
    }
    const placeholder = this.loader.createPlaceholder(
      resolved.entry.fallback,
      this.accentColor,
    );
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
    const isGorra =
      this.modelKey === 'gorra' ||
      this.modelKey.startsWith('gorra-') ||
      this.markerTipo === 'gorra';
    const zoom = this.modelKey === 'guante' ? 1.5 : isGorra ? 1.45 : 1.15;

    this.camera.position.set(
      center.x,
      center.y + maxDim * 0.02,
      center.z + (dist * 1.2) / zoom,
    );
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
          this.loader.applyAnimation(
            this.model,
            this.animMode,
            now - this.startedAt,
          );
        }
        if (this.particles) this.tickParticles();
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
