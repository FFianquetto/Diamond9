import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, firstValueFrom, of, tap } from 'rxjs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import {
  ArAnimMode,
  ArModelEntry,
  ArModelFallback,
  ArModelResolveInput,
  ArModelResolved,
  ArModelsManifest,
} from './ar-model.types';

const MANIFEST_URL = 'assets/data/ar-models.json';

@Injectable({ providedIn: 'root' })
export class ArModelLoaderService {
  private readonly http = inject(HttpClient);
  private manifest: ArModelsManifest | null = null;
  private readonly cache = new Map<string, THREE.Object3D>();
  private loadChain: Promise<void> = Promise.resolve();

  loadManifest(): Observable<ArModelsManifest> {
    if (this.manifest) return of(this.manifest);
    return this.http.get<ArModelsManifest>(MANIFEST_URL).pipe(
      tap((m) => (this.manifest = m)),
      catchError(() => {
        const fallback: ArModelsManifest = {
          nota: '',
          formatoRecomendado: 'glb',
          defaults: { jugador: 'bate', equipo: 'pelota', liga: 'trofeo' },
          overrides: {},
          models: {
            bate: {
              label: 'Bate',
              file: '',
              format: 'glb',
              scale: 1.4,
              fallback: 'bate',
            },
            pelota: {
              label: 'Pelota',
              file: '',
              format: 'glb',
              scale: 1.2,
              fallback: 'pelota',
            },
            trofeo: {
              label: 'Trofeo',
              file: '',
              format: 'glb',
              scale: 1.3,
              fallback: 'trofeo',
            },
          },
        };
        this.manifest = fallback;
        return of(fallback);
      }),
    );
  }

  resolve(input: ArModelResolveInput): ArModelResolved | null {
    const manifest = this.manifest;
    if (!manifest) return null;

    const key =
      manifest.overrides[input.markerId] ??
      manifest.defaults[input.tipo] ??
      'pelota';
    const entry = manifest.models[key];
    if (!entry) return null;
    return { key, entry };
  }

  resolveByKey(key: string): ArModelResolved | null {
    const entry = this.manifest?.models[key];
    if (!entry) return null;
    return { key, entry };
  }

  listModelKeys(): { key: string; label: string }[] {
    if (!this.manifest) return [];
    return Object.entries(this.manifest.models).map(([key, entry]) => ({
      key,
      label: entry.label,
    }));
  }

  async loadModel(resolved: ArModelResolved, accent: string): Promise<THREE.Object3D> {
    const cacheKey = `${resolved.key}:${accent}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached.clone(true);

    // Cola serial: evita saturar WebGL con varios GLB pesados a la vez (ej. guante ~25MB).
    return new Promise<THREE.Object3D>((resolve) => {
      this.loadChain = this.loadChain
        .then(async () => {
          const again = this.cache.get(cacheKey);
          if (again) {
            resolve(again.clone(true));
            return;
          }

          let model: THREE.Object3D | null = null;
          if (resolved.entry.file) {
            model = await this.tryLoadFile(resolved.entry);
          }
          if (!model) {
            model = this.buildFallback(resolved.entry.fallback, accent);
          }

          await this.applyExternalTextures(model, resolved.entry);
          this.normalizeModel(model, resolved.entry.scale);
          this.cache.set(cacheKey, model);
          resolve(model.clone(true));
        })
        .catch((err) => {
          console.warn('[AR 3D] loadModel:', err);
          const fallback = this.buildFallback(resolved.entry.fallback, accent);
          this.normalizeModel(fallback, resolved.entry.scale);
          resolve(fallback);
        });
    });
  }

  /** Placeholder ligero mientras llega el GLB real. */
  createPlaceholder(kind: ArModelFallback, accent: string): THREE.Object3D {
    const model = this.buildFallback(kind, accent);
    this.normalizeModel(model, 1);
    return model;
  }

  applyAnimation(
    model: THREE.Object3D,
    mode: ArAnimMode,
    elapsed: number,
  ): void {
    const t = elapsed * 0.001;
    switch (mode) {
      case 'spin':
        model.rotation.y = t * 0.35;
        model.rotation.x = 0.08;
        break;
      case 'swing':
        model.rotation.z = Math.sin(t * 6) * 0.55;
        model.rotation.y = -0.35 + Math.sin(t * 3) * 0.2;
        model.position.y = Math.sin(t * 5) * 0.06;
        break;
      case 'pulse3d': {
        const s = 1 + Math.sin(t * 4) * 0.08;
        model.scale.setScalar(s);
        model.rotation.y = t * 1.2;
        break;
      }
      default:
        model.rotation.y = t * 0.25;
        model.rotation.x = 0.08;
        break;
    }
  }

  disposeObject(obj: THREE.Object3D): void {
    obj.traverse((child: THREE.Object3D) => {
      const mesh = child as THREE.Mesh;
      mesh.geometry?.dispose();
      const mat = mesh.material;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else mat?.dispose();
    });
  }

  private async tryLoadFile(entry: ArModelEntry): Promise<THREE.Object3D | null> {
    try {
      if (entry.format === 'obj') {
        const model = await this.loadObj(entry.file);
        return this.optimizeModel(model, entry.fallback);
      }
      const loader = new GLTFLoader();
      const gltf = await firstValueFrom(
        new Observable<{ scene: THREE.Object3D }>((sub) => {
          loader.load(
            entry.file,
            (g: { scene: THREE.Object3D }) => {
              sub.next(g);
              sub.complete();
            },
            undefined,
            (err: unknown) => sub.error(err),
          );
        }),
      );
      return this.optimizeModel(gltf.scene, entry.fallback);
    } catch (err) {
      console.warn(`[AR 3D] Falló carga de ${entry.file}:`, err);
      return null;
    }
  }

  private loadObj(url: string): Promise<THREE.Object3D> {
    const basePath = url.slice(0, url.lastIndexOf('/') + 1);
    const fileName = url.slice(url.lastIndexOf('/') + 1);
    const mtlName = fileName.replace(/\.obj$/i, '.mtl');

    return firstValueFrom(
      new Observable<THREE.Object3D>((sub) => {
        const tryObj = (loader: OBJLoader) => {
          loader.load(
            url,
            (obj) => {
              sub.next(obj);
              sub.complete();
            },
            undefined,
            () => sub.error(new Error(`OBJ no encontrado: ${url}`)),
          );
        };

        const mtlLoader = new MTLLoader();
        mtlLoader.setPath(basePath);
        mtlLoader.load(
          mtlName,
          (materials) => {
            materials.preload();
            const objLoader = new OBJLoader();
            objLoader.setMaterials(materials);
            tryObj(objLoader);
          },
          undefined,
          () => tryObj(new OBJLoader()),
        );
      }),
    );
  }

  /** Reduce costo GPU y evita modelos negros (metalness alto sin env map). */
  private optimizeModel(model: THREE.Object3D, kind: ArModelFallback): THREE.Object3D {
    let triangles = 0;
    const fallbackMat = new THREE.MeshStandardMaterial({
      color: kind === 'pelota' ? 0xf5f5f5 : 0xcccccc,
      metalness: 0.08,
      roughness: 0.82,
    });

    model.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;

      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.frustumCulled = true;
      mesh.visible = true;

      const geo = mesh.geometry as THREE.BufferGeometry;
      if (geo) {
        if (!geo.getAttribute('normal')) geo.computeVertexNormals();
        const idx = geo.index;
        triangles += idx ? idx.count / 3 : (geo.attributes['position']?.count ?? 0) / 3;
      }

      const mat = mesh.material;
      if (!mat || (Array.isArray(mat) && mat.length === 0)) {
        mesh.material = fallbackMat.clone();
      } else {
        const materials = Array.isArray(mat) ? mat : [mat];
        const upgraded = materials.map((source) => this.upgradeMaterial(source, fallbackMat));
        mesh.material = Array.isArray(mat) ? upgraded : upgraded[0];
      }
    });

    if (triangles > 80_000) {
      console.warn(
        `[AR 3D] Modelo muy pesado (~${Math.round(triangles)} triángulos). ` +
          'En Blender usa Decimate para bajar a < 20k antes de exportar.',
      );
    }

    return model;
  }

  private upgradeMaterial(
    source: THREE.Material,
    fallbackMat: THREE.MeshStandardMaterial,
  ): THREE.Material {
    if (
      source instanceof THREE.MeshStandardMaterial ||
      source instanceof THREE.MeshPhysicalMaterial
    ) {
      // Sin environment map, metalness alto se ve negro.
      source.metalness = Math.min(source.metalness ?? 0.2, 0.35);
      source.roughness = Math.max(source.roughness ?? 0.6, 0.35);
      if (source.color.getHex() === 0x000000 && !source.map) {
        source.color.set(0xb0b0b0);
      }
      this.fixTextureColorSpace(source);
      source.needsUpdate = true;
      return source;
    }

    if (source instanceof THREE.MeshPhongMaterial) {
      const upgraded = new THREE.MeshStandardMaterial({
        color: source.color.getHex() === 0 ? 0xb0b0b0 : source.color,
        map: source.map ?? undefined,
        normalMap: source.normalMap ?? undefined,
        metalness: 0.1,
        roughness: 0.75,
      });
      this.fixTextureColorSpace(upgraded);
      source.dispose();
      return upgraded;
    }

    if (source instanceof THREE.MeshLambertMaterial) {
      const upgraded = new THREE.MeshStandardMaterial({
        color: source.color.getHex() === 0 ? 0xb0b0b0 : source.color,
        map: source.map ?? undefined,
        metalness: 0.05,
        roughness: 0.9,
      });
      this.fixTextureColorSpace(upgraded);
      source.dispose();
      return upgraded;
    }

    if (source instanceof THREE.MeshBasicMaterial) {
      const upgraded = new THREE.MeshStandardMaterial({
        color: source.color,
        map: source.map ?? undefined,
        metalness: 0.05,
        roughness: 0.85,
      });
      this.fixTextureColorSpace(upgraded);
      return upgraded;
    }

    return fallbackMat.clone();
  }

  private fixTextureColorSpace(material: THREE.MeshStandardMaterial): void {
    if (material.map) material.map.colorSpace = THREE.SRGBColorSpace;
    if (material.emissiveMap) material.emissiveMap.colorSpace = THREE.SRGBColorSpace;
    if (material.normalMap) material.normalMap.colorSpace = THREE.NoColorSpace;
    if (material.roughnessMap) material.roughnessMap.colorSpace = THREE.NoColorSpace;
    if (material.metalnessMap) material.metalnessMap.colorSpace = THREE.NoColorSpace;
    if (material.aoMap) material.aoMap.colorSpace = THREE.NoColorSpace;
  }

  private loadTexture(url: string, isColorMap: boolean): Promise<THREE.Texture> {
    return new Promise((resolve, reject) => {
      const loader = new THREE.TextureLoader();
      loader.load(
        url,
        (tex) => {
          tex.flipY = false;
          tex.colorSpace = isColorMap ? THREE.SRGBColorSpace : THREE.NoColorSpace;
          tex.needsUpdate = true;
          resolve(tex);
        },
        undefined,
        (err) => reject(err),
      );
    });
  }

  private async applyExternalTextures(
    model: THREE.Object3D,
    entry: ArModelEntry,
  ): Promise<void> {
    if (!entry.texture && !entry.normalMap) return;

    let colorMap: THREE.Texture | null = null;
    let normalMap: THREE.Texture | null = null;

    try {
      if (entry.texture) {
        colorMap = await this.loadTexture(entry.texture, true);
      }
      if (entry.normalMap) {
        normalMap = await this.loadTexture(entry.normalMap, false);
      }
    } catch (err) {
      console.warn('[AR 3D] No se pudo cargar textura externa:', err);
      return;
    }

    model.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;

      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const next = mats.map((mat) => {
        let std: THREE.MeshStandardMaterial;
        if (mat instanceof THREE.MeshStandardMaterial) {
          std = mat;
        } else {
          std = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            metalness: 0.1,
            roughness: 0.7,
          });
        }
        if (colorMap && !std.map) {
          std.map = colorMap;
          std.color.set(0xffffff);
        }
        if (normalMap && !std.normalMap) {
          std.normalMap = normalMap;
          std.normalScale.set(1, 1);
        }
        std.metalness = Math.min(std.metalness, 0.35);
        std.roughness = Math.max(std.roughness, 0.35);
        std.needsUpdate = true;
        return std;
      });
      mesh.material = Array.isArray(mesh.material) ? next : next[0];
    });
  }

  private normalizeModel(model: THREE.Object3D, scale: number): void {
    model.position.set(0, 0, 0);
    model.rotation.set(0, 0, 0);
    model.scale.setScalar(1);

    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const fit = (1.35 / maxDim) * Math.min(Math.max(scale || 1, 0.6), 1.4);
    model.scale.setScalar(fit);

    box.setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    model.position.sub(center);
  }

  private buildFallback(kind: ArModelFallback, accent: string): THREE.Object3D {
    const color = new THREE.Color(accent || '#00e5ff');
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      color,
      metalness: 0.35,
      roughness: 0.45,
    });
    const wood = new THREE.MeshStandardMaterial({
      color: 0x8d6e63,
      metalness: 0.1,
      roughness: 0.7,
    });
    const leather = new THREE.MeshStandardMaterial({
      color: 0xf5f5f5,
      metalness: 0.05,
      roughness: 0.85,
    });
    const gold = new THREE.MeshStandardMaterial({
      color: 0xffc107,
      metalness: 0.35,
      roughness: 0.4,
    });

    switch (kind) {
      case 'bate': {
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.1, 16), wood);
        barrel.rotation.z = Math.PI / 2;
        barrel.position.x = 0.15;
        const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.45, 12), mat);
        handle.rotation.z = Math.PI / 2;
        handle.position.x = -0.45;
        group.add(barrel, handle);
        group.rotation.z = -0.35;
        break;
      }
      case 'pelota': {
        const ball = new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 24), leather);
        const seam = new THREE.Mesh(
          new THREE.TorusGeometry(0.42, 0.012, 8, 48),
          new THREE.MeshStandardMaterial({ color: 0xc62828 }),
        );
        seam.rotation.x = Math.PI / 2;
        group.add(ball, seam);
        break;
      }
      case 'trofeo': {
        const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.22, 0.55, 20), gold);
        cup.position.y = 0.35;
        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.45, 0.12, 20), gold);
        const handles = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.03, 8, 24, Math.PI), gold);
        handles.rotation.z = Math.PI / 2;
        handles.position.y = 0.45;
        group.add(cup, base, handles);
        break;
      }
      case 'guante': {
        const palm = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.15, 0.7), mat);
        const thumb = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.28), mat);
        thumb.position.set(0.32, 0.05, 0.15);
        thumb.rotation.y = -0.5;
        group.add(palm, thumb);
        break;
      }
      case 'gorra': {
        const crown = new THREE.Mesh(
          new THREE.SphereGeometry(0.4, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.55),
          mat,
        );
        crown.position.y = 0.08;
        const visor = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.05, 0.28), mat);
        visor.position.set(0, 0, 0.22);
        const button = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.04, 12), mat);
        button.position.y = 0.38;
        group.add(crown, visor, button);
        break;
      }
    }

    return group;
  }
}
