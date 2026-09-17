import { Component, OnInit, signal, inject } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { MenuBarComponent } from './comp/shared/menu-bar/menu-bar.component';
import { footerButton } from './comp/shared/footer-button/footer-button.component';
import { ParticleFxComponent } from './comp/shared/particle-fx/particle-fx.component';
import { CartaUnlockOverlayComponent } from './comp/shared/carta-unlock-overlay/carta-unlock-overlay.component';
import { filter } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    MenuBarComponent,
    footerButton,
    ParticleFxComponent,
    CartaUnlockOverlayComponent,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  isInAppBrowser = signal<boolean>(false);
  isHomeRoute = false;
  title = 'Diamante9';
  protected readonly appName = 'Diamante 9 · Beisbol AR';
  private router = inject(Router);

  constructor() {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      takeUntilDestroyed()
    ).subscribe((event: NavigationEnd) => {
      this.isHomeRoute = event.url === '/' || event.url === '/home';
    });
  }

  ngOnInit(): void {
    this.detectInAppBrowser();
  }

  goToLanding() {
    this.router.navigate(['/landing']);
  }

  private detectInAppBrowser(): void {
    if (['Instagram', 'FBAV', 'FBAN', 'Twitter', 'YouTube'].some(signature => (navigator.userAgent || navigator.vendor || (window as any).opera).includes(signature))) {
      this.isInAppBrowser.set(true);
    }
  }
}
