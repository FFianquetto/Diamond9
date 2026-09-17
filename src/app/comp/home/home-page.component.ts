import {
  Component,
  HostListener,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { RevealOnScrollDirective } from '../shared/reveal-on-scroll.directive';
import { ParticleFxService } from '../shared/particle-fx/particle-fx.service';
import { ProfileService } from '../beisbol-ar/profile.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatIconModule,
    RevealOnScrollDirective,
  ],
  templateUrl: './home-page.component.html',
  styleUrl: './home-page.component.scss',
})
export class HomeComponent implements OnInit {
  atTop = true;
  private readonly fx = inject(ParticleFxService);
  private readonly profile = inject(ProfileService);
  private readonly router = inject(Router);

  readonly perfil = this.profile.state;
  readonly displayName = this.profile.displayName;
  readonly gearOpen = signal(false);
  readonly draftName = signal('');

  ngOnInit(): void {
    this.checkScrollPosition();
    this.profile.load().subscribe();
  }

  @HostListener('window:scroll')
  onWindowScroll(): void {
    this.checkScrollPosition();
  }

  @HostListener('document:click', ['$event'])
  onDocClick(event: Event): void {
    const t = event.target as HTMLElement;
    if (!t.closest('.hero-user-chip')) this.gearOpen.set(false);
  }

  private checkScrollPosition(): void {
    this.atTop = window.pageYOffset < 50;
  }

  navigateTo(path: string, event?: Event): void {
    this.fx.burst('spark', event);
    void this.router.navigateByUrl(path);
  }

  toggleGear(event: Event): void {
    event.stopPropagation();
    const next = !this.gearOpen();
    this.gearOpen.set(next);
    if (next) this.draftName.set(this.displayName());
  }

  closeGear(): void {
    this.gearOpen.set(false);
  }

  onDraft(event: Event): void {
    this.draftName.set((event.target as HTMLInputElement).value);
  }

  saveName(): void {
    this.profile.setNombreUsuario(this.draftName());
    this.gearOpen.set(false);
    this.fx.burstCenter('spark');
  }
}
