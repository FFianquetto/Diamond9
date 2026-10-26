import {
  Component,
  HostListener,
  OnInit,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { RevealOnScrollDirective } from '../shared/reveal-on-scroll.directive';
import { ParticleFxService } from '../shared/particle-fx/particle-fx.service';
import { ProfileService } from '../beisbol-ar/profile.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterModule, RevealOnScrollDirective],
  templateUrl: './home-page.component.html',
  styleUrl: './home-page.component.scss',
})
export class HomeComponent implements OnInit {
  atTop = true;
  private readonly fx = inject(ParticleFxService);
  private readonly profile = inject(ProfileService);
  private readonly router = inject(Router);

  ngOnInit(): void {
    this.checkScrollPosition();
    this.profile.load().subscribe();
  }

  @HostListener('window:scroll')
  onWindowScroll(): void {
    this.checkScrollPosition();
  }

  private checkScrollPosition(): void {
    this.atTop = window.pageYOffset < 50;
  }

  navigateTo(path: string, event?: Event): void {
    this.fx.burst('spark', event);
    void this.router.navigateByUrl(path);
  }
}
