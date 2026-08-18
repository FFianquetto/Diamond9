import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  inject,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { ParticleBurst, ParticleFxService, ParticleKind } from './particle-fx.service';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  shape: 'circle' | 'diamond' | 'rect';
  spin: number;
  angle: number;
}

@Component({
  selector: 'app-particle-fx',
  standalone: true,
  templateUrl: './particle-fx.component.html',
  styleUrl: './particle-fx.component.scss',
})
export class ParticleFxComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvasEl') canvasRef?: ElementRef<HTMLCanvasElement>;

  private readonly fx = inject(ParticleFxService);
  private ctx: CanvasRenderingContext2D | null = null;
  private particles: Particle[] = [];
  private raf = 0;
  private sub?: Subscription;
  private dpr = 1;
  private reducedMotion = false;

  ngAfterViewInit(): void {
    this.reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return;
    this.ctx = canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', this.resize);
    this.sub = this.fx.bursts.subscribe((burst) => this.spawn(burst));
    this.loop();
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.raf);
    this.sub?.unsubscribe();
    window.removeEventListener('resize', this.resize);
  }

  private resize = (): void => {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas || !this.ctx) return;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(window.innerWidth * this.dpr);
    canvas.height = Math.floor(window.innerHeight * this.dpr);
  };

  private spawn(burst: ParticleBurst): void {
    if (this.reducedMotion) return;
    const count = this.countFor(burst.kind);
    const palette = this.paletteFor(burst.kind);
    for (let i = 0; i < count; i++) {
      const speed = 1.4 + Math.random() * (burst.kind === 'homer' ? 8.5 : 5.5);
      const dir = Math.random() * Math.PI * 2;
      this.particles.push({
        x: burst.x,
        y: burst.y,
        vx: Math.cos(dir) * speed,
        vy: Math.sin(dir) * speed - (burst.kind === 'homer' ? 2.4 : 1.1),
        life: 1,
        maxLife: 520 + Math.random() * 420,
        size: burst.kind === 'homer' ? 5 + Math.random() * 7 : 3 + Math.random() * 5,
        color: palette[i % palette.length],
        shape: burst.kind === 'homer' && i % 3 === 0 ? 'diamond' : i % 4 === 0 ? 'rect' : 'circle',
        spin: (Math.random() - 0.5) * 0.28,
        angle: Math.random() * Math.PI,
      });
    }
  }

  private countFor(kind: ParticleKind): number {
    switch (kind) {
      case 'homer':
        return 46;
      case 'confetti':
        return 28;
      case 'spark':
        return 16;
      case 'strike':
        return 10;
    }
  }

  private paletteFor(kind: ParticleKind): string[] {
    if (kind === 'strike') {
      return ['#A8B3C2', '#FFFFFF', '#3E688C'];
    }
    if (kind === 'spark') {
      return ['#00C2D7', '#8BEAF2', '#FFFFFF'];
    }
    return ['#00C2D7', '#8BEAF2', '#FFFFFF', '#F5C542', '#3E688C'];
  }

  private loop = (): void => {
    const canvas = this.canvasRef?.nativeElement;
    const ctx = this.ctx;
    if (!canvas || !ctx) return;

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    const gravity = 0.12;
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const p of this.particles) {
      p.vy += gravity;
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.985;
      p.life -= 16 / p.maxLife;
      p.angle += p.spin;
      const alpha = Math.max(0, p.life);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      if (p.shape === 'diamond') {
        ctx.rotate(Math.PI / 4);
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      } else if (p.shape === 'rect') {
        ctx.fillRect(-p.size * 0.7, -p.size * 0.25, p.size * 1.4, p.size * 0.5);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.size * 0.55, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    this.raf = requestAnimationFrame(this.loop);
  };
}
