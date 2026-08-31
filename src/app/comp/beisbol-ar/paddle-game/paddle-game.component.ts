import {
  AfterViewInit,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ParticleFxService } from '../../shared/particle-fx/particle-fx.service';
import { RewardsService } from '../rewards.service';

type GameState = 'ready' | 'playing' | 'paused' | 'over' | 'won';

interface Star {
  x: number;
  y: number;
  r: number;
}

@Component({
  selector: 'app-paddle-game',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './paddle-game.component.html',
  styleUrl: './paddle-game.component.scss',
})
export class PaddleGameComponent implements AfterViewInit, OnDestroy {
  @ViewChild('court') courtRef?: ElementRef<HTMLCanvasElement>;

  private readonly fx = inject(ParticleFxService);
  private readonly zone = inject(NgZone);
  private readonly rewards = inject(RewardsService);

  readonly goal = 5;
  state = signal<GameState>('ready');
  score = signal(0);
  lives = signal(3);

  private ctx: CanvasRenderingContext2D | null = null;
  private raf = 0;
  private dpr = 1;
  private w = 0;
  private h = 0;
  private paddle = { x: 0, y: 0, w: 86, h: 14 };
  private ball = { x: 0, y: 0, vx: 0, vy: 0, r: 9 };
  private star: Star | null = null;
  private dragging = false;
  private lastTs = 0;
  private speedMul = 1;

  ngAfterViewInit(): void {
    this.rewards.loadCatalog().subscribe();
    const canvas = this.courtRef?.nativeElement;
    if (!canvas) return;
    this.ctx = canvas.getContext('2d');
    this.resize();
    this.resetBall(true);
    this.placeStar();
    this.draw(0);
    window.addEventListener('resize', this.resize);
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.resize);
  }

  start(event?: Event): void {
    event?.preventDefault();
    this.fx.burst('confetti', event);
    this.score.set(0);
    this.lives.set(3);
    this.speedMul = 1;
    this.state.set('playing');
    this.resetBall(false);
    this.placeStar();
    this.lastTs = 0;
    cancelAnimationFrame(this.raf);
    this.zone.runOutsideAngular(() => this.loop(0));
    this.vibrate(12);
  }

  pauseToggle(event?: Event): void {
    if (this.state() === 'playing') {
      this.state.set('paused');
      this.fx.burst('spark', event);
      return;
    }
    if (this.state() === 'paused') {
      this.state.set('playing');
      this.fx.burst('spark', event);
      this.lastTs = 0;
      this.zone.runOutsideAngular(() => this.loop(0));
    }
  }

  onPointerDown(event: PointerEvent): void {
    event.preventDefault();
    this.dragging = true;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    this.movePaddle(event);
  }

  onPointerMove(event: PointerEvent): void {
    if (this.dragging || event.pointerType === 'mouse') {
      this.movePaddle(event);
    }
  }

  onPointerUp(): void {
    this.dragging = false;
  }

  private resize = (): void => {
    const canvas = this.courtRef?.nativeElement;
    if (!canvas || !this.ctx) return;
    const parent = canvas.parentElement;
    const cssW = parent?.clientWidth || 320;
    const cssH = Math.min(Math.round(cssW * 1.35), Math.round(window.innerHeight * 0.52));
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(cssW * this.dpr);
    canvas.height = Math.floor(cssH * this.dpr);
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    this.w = cssW;
    this.h = cssH;
    this.paddle.w = Math.max(72, Math.min(110, cssW * 0.28));
    this.paddle.h = 14;
    this.paddle.y = this.h - 28;
    if (this.state() !== 'playing') {
      this.paddle.x = (this.w - this.paddle.w) / 2;
    } else {
      this.paddle.x = Math.min(
        Math.max(this.paddle.x, 0),
        this.w - this.paddle.w,
      );
    }
    this.ball.r = Math.max(8, Math.round(cssW * 0.028));
    if (this.star) this.star.r = Math.max(12, Math.round(cssW * 0.045));
    this.draw(performance.now());
  };

  private movePaddle(event: PointerEvent): void {
    const canvas = this.courtRef?.nativeElement;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * this.w;
    this.paddle.x = Math.min(
      Math.max(x - this.paddle.w / 2, 0),
      this.w - this.paddle.w,
    );
    if (this.state() !== 'playing') this.draw(performance.now());
  }

  private resetBall(center: boolean): void {
    this.ball.x = this.w / 2;
    this.ball.y = center ? this.h * 0.45 : this.h * 0.38;
    const dir = Math.random() > 0.5 ? 1 : -1;
    const speed = (2.9 + this.speedMul * 0.85) * this.speedMul;
    this.ball.vx = dir * (1.15 + Math.random() * 0.9) * this.speedMul;
    this.ball.vy = -speed;
    this.clampSpeed();
  }

  private placeStar(): void {
    const pad = 32;
    const starR = Math.max(12, Math.round(this.w * 0.045));
    let x = this.w / 2;
    let y = this.h * 0.2;
    let tries = 0;
    do {
      const edge = tries % 3;
      if (edge === 0) {
        x = pad + Math.random() * (this.w - pad * 2);
        y = pad + 8 + Math.random() * (this.h * 0.18);
      } else if (edge === 1) {
        x = pad + Math.random() * 18;
        y = pad + Math.random() * (this.h * 0.55);
      } else {
        x = this.w - pad - Math.random() * 18;
        y = pad + Math.random() * (this.h * 0.55);
      }
      tries += 1;
    } while (
      tries < 12 &&
      Math.hypot(x - this.ball.x, y - this.ball.y) < 70
    );
    this.star = { x, y, r: starR };
  }

  private loop = (ts: number): void => {
    if (this.state() !== 'playing') {
      this.draw(ts);
      return;
    }
    const dt = this.lastTs ? Math.min((ts - this.lastTs) / 16.67, 2.2) : 1;
    this.lastTs = ts;
    this.step(dt);
    this.draw(ts);
    this.raf = requestAnimationFrame(this.loop);
  };

  private step(dt: number): void {
    this.ball.x += this.ball.vx * dt;
    this.ball.y += this.ball.vy * dt;

    if (this.ball.x - this.ball.r <= 0) {
      this.ball.x = this.ball.r;
      this.ball.vx = Math.abs(this.ball.vx);
    } else if (this.ball.x + this.ball.r >= this.w) {
      this.ball.x = this.w - this.ball.r;
      this.ball.vx = -Math.abs(this.ball.vx);
    }

    if (this.ball.y - this.ball.r <= 0) {
      this.ball.y = this.ball.r;
      this.ball.vy = Math.abs(this.ball.vy);
    }

    this.checkStarHit();

    const p = this.paddle;
    const hit =
      this.ball.vy > 0 &&
      this.ball.y + this.ball.r >= p.y &&
      this.ball.y + this.ball.r <= p.y + p.h + 10 &&
      this.ball.x >= p.x - 4 &&
      this.ball.x <= p.x + p.w + 4;

    if (hit) {
      const offset = (this.ball.x - (p.x + p.w / 2)) / (p.w / 2);
      this.ball.y = p.y - this.ball.r - 0.5;
      this.ball.vy = -Math.abs(this.ball.vy);
      this.ball.vx += offset * 1.55;
      this.clampSpeed();
    }

    if (this.ball.y - this.ball.r > this.h) {
      this.onMiss();
    }
  }

  private checkStarHit(): void {
    const star = this.star;
    if (!star || this.state() !== 'playing') return;
    const dist = Math.hypot(this.ball.x - star.x, this.ball.y - star.y);
    if (dist > this.ball.r + star.r) return;

    this.speedMul = Math.min(1.85, this.speedMul + 0.14);
    this.ball.vx *= 1.12;
    this.ball.vy *= 1.12;
    this.clampSpeed();

    this.zone.run(() => {
      this.score.update((s) => s + 1);
      this.burstAt(star.x, star.y, this.score() >= this.goal ? 'homer' : 'confetti');
      this.vibrate(18);
      if (this.score() >= this.goal) {
        this.state.set('won');
        this.rewards.recordReboteWin();
        this.fx.burstCenter('homer');
        this.star = null;
        return;
      }
      this.placeStar();
    });
  }

  private onMiss(): void {
    this.zone.run(() => {
      this.lives.update((n) => n - 1);
      this.burstAtBall('strike');
      this.vibrate(30);
      if (this.lives() <= 0) {
        this.state.set('over');
        return;
      }
      this.resetBall(false);
    });
  }

  private clampSpeed(): void {
    const max = 3.2 + this.speedMul * 2.4;
    const min = 2.4 * this.speedMul;
    const mag = Math.hypot(this.ball.vx, this.ball.vy) || 1;
    const capped = Math.min(max, Math.max(min, mag));
    this.ball.vx = (this.ball.vx / mag) * capped;
    this.ball.vy = (this.ball.vy / mag) * capped;
  }

  private burstAt(x: number, y: number, kind: 'spark' | 'homer' | 'strike' | 'confetti'): void {
    const canvas = this.courtRef?.nativeElement;
    if (!canvas) {
      this.fx.burstCenter(kind);
      return;
    }
    const rect = canvas.getBoundingClientRect();
    this.fx.burst(kind, {
      clientX: rect.left + (x / this.w) * rect.width,
      clientY: rect.top + (y / this.h) * rect.height,
    });
  }

  private burstAtBall(kind: 'spark' | 'homer' | 'strike' | 'confetti'): void {
    this.burstAt(this.ball.x, this.ball.y, kind);
  }

  private draw(ts: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = '#0a1f14';
    ctx.fillRect(0, 0, this.w, this.h);

    ctx.strokeStyle = 'rgba(0, 194, 215, 0.28)';
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, this.w - 16, this.h - 16);
    ctx.beginPath();
    ctx.moveTo(this.w / 2, 12);
    ctx.lineTo(this.w / 2, this.h - 12);
    ctx.stroke();

    if (this.star) {
      const pulse = 1 + Math.sin(ts / 180) * 0.08;
      this.paintStar(ctx, this.star.x, this.star.y, this.star.r * pulse, ts / 420);
    }

    ctx.fillStyle = '#00C2D7';
    this.roundRect(ctx, this.paddle.x, this.paddle.y, this.paddle.w, this.paddle.h, 7);
    ctx.fill();

    ctx.beginPath();
    ctx.fillStyle = '#f4f4f4';
    ctx.arc(this.ball.x, this.ball.y, this.ball.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#c62828';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(this.ball.x - 1, this.ball.y, this.ball.r * 0.55, 0.4, 2.4);
    ctx.stroke();
  }

  private paintStar(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    r: number,
    rot: number,
  ): void {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.shadowColor = '#F5C542';
    ctx.shadowBlur = 16;
    ctx.beginPath();
    const spikes = 5;
    const inner = r * 0.42;
    for (let i = 0; i < spikes * 2; i++) {
      const rad = i % 2 === 0 ? r : inner;
      const a = (i * Math.PI) / spikes - Math.PI / 2;
      const x = Math.cos(a) * rad;
      const y = Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = '#F5C542';
    ctx.fill();
    ctx.strokeStyle = '#fff6c8';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.restore();
  }

  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
  ): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  private vibrate(ms: number): void {
    try {
      navigator.vibrate?.(ms);
    } catch {
      /* opcional */
    }
  }
}
