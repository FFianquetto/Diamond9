import {
  Component,
  HostListener,
  OnDestroy,
  OnInit,
  inject,
} from '@angular/core';
import { Router, NavigationEnd, RouterLink } from '@angular/router';
import { filter } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import { ProfileService } from '../../beisbol-ar/profile.service';

@Component({
  selector: 'app-menu-bar',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './menu-bar.component.html',
  styleUrl: './menu-bar.component.scss',
})
export class MenuBarComponent implements OnInit, OnDestroy {
  public isAtTop = true;
  public isMenuOpen = false;
  public isExtraMenuOpen = false;
  public isGamesMenuOpen = false;
  public isMobileGamesOpen = false;
  public isMobileMoreOpen = false;
  public isLandingPage = true;
  public activeRoute = '/';
  public logoLetters = ['D', '9', '·', 'A', 'R'];
  public logoClickCount = 0;
  private skipNextDocumentClose = false;

  private readonly profile = inject(ProfileService);
  readonly displayName = this.profile.displayName;

  constructor(private router: Router) {
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        this.checkCurrentRoute(event.urlAfterRedirects || event.url);
      });
  }

  ngOnInit(): void {
    this.checkScroll();
    this.checkCurrentRoute(this.router.url);
    this.profile.load().subscribe();
  }

  ngOnDestroy(): void {
    document.body.style.overflow = '';
  }

  @HostListener('window:scroll', [])
  onWindowScroll(): void {
    this.checkScroll();
  }

  @HostListener('window:resize', [])
  onResize(): void {
    if (window.innerWidth > 900 && this.isMenuOpen) {
      this.isMenuOpen = false;
      document.body.style.overflow = '';
    }
    if (window.innerWidth <= 800) {
      this.isExtraMenuOpen = false;
      this.isGamesMenuOpen = false;
    } else {
      this.isMobileGamesOpen = false;
      this.isMobileMoreOpen = false;
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    const target = event.target as HTMLElement;

    if (
      !target.closest('.menu-bar') &&
      this.isMenuOpen &&
      window.innerWidth <= 900
    ) {
      this.isMenuOpen = false;
      document.body.style.overflow = '';
    }

    if (this.skipNextDocumentClose) {
      this.skipNextDocumentClose = false;
      return;
    }

    if (window.innerWidth > 800) {
      const onToggle = target.closest('.more-menu-btn');
      const inPanel = target.closest('.extra-menu-panel');

      if (!onToggle && !inPanel) {
        this.isExtraMenuOpen = false;
        this.isGamesMenuOpen = false;
      }
    }
  }

  toggleMenu(): void {
    this.isMenuOpen = !this.isMenuOpen;
    if (this.isMenuOpen) {
      this.isExtraMenuOpen = false;
      this.isGamesMenuOpen = false;
    } else {
      this.isMobileGamesOpen = false;
      this.isMobileMoreOpen = false;
    }
    document.body.style.overflow = this.isMenuOpen ? 'hidden' : '';
  }

  toggleExtraMenu(event: Event): void {
    event.stopPropagation();
    this.skipNextDocumentClose = true;
    this.isGamesMenuOpen = false;
    this.isExtraMenuOpen = !this.isExtraMenuOpen;
  }

  toggleGamesMenu(event: Event): void {
    event.stopPropagation();
    this.skipNextDocumentClose = true;
    this.isExtraMenuOpen = false;
    this.isGamesMenuOpen = !this.isGamesMenuOpen;
  }

  toggleMobileGames(event: Event): void {
    event.stopPropagation();
    this.isMobileMoreOpen = false;
    this.isMobileGamesOpen = !this.isMobileGamesOpen;
  }

  toggleMobileMore(event: Event): void {
    event.stopPropagation();
    this.isMobileGamesOpen = false;
    this.isMobileMoreOpen = !this.isMobileMoreOpen;
  }

  closeExpandedMenus(): void {
    this.isExtraMenuOpen = false;
    this.isGamesMenuOpen = false;
    this.isMobileGamesOpen = false;
    this.isMobileMoreOpen = false;
    this.isMenuOpen = false;
    document.body.style.overflow = '';
  }

  navigateTo(route: string): void {
    const path = route ? '/' + route : '/';
    void this.router.navigateByUrl(path);
    this.closeExpandedMenus();
  }

  isActive(route: string): boolean {
    const path = route ? '/' + route : '/';
    return this.activeRoute === path;
  }

  isGamesActive(): boolean {
    return (
      this.isActive('trivia') ||
      this.isActive('juego') ||
      this.isActive('rebote')
    );
  }

  isMoreActive(): boolean {
    return (
      this.isActive('equipos') ||
      this.isActive('historia') ||
      this.isActive('coleccion') ||
      this.isActive('recompensas') ||
      this.isActive('modelos')
    );
  }

  private checkCurrentRoute(url: string): void {
    const clean = (url.split('?')[0].split('#')[0] || '/').replace(/\/$/, '');
    this.activeRoute = clean === '' || clean === '/home' ? '/' : clean;
    this.isLandingPage = this.activeRoute === '/';
  }

  private checkScroll(): void {
    this.isAtTop = window.pageYOffset < 10;
  }
}
