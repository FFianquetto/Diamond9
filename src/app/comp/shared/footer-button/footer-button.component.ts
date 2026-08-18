import { Component, OnInit } from '@angular/core';
import { Router, NavigationEnd, RouterLink } from '@angular/router';
import { filter } from 'rxjs/operators';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-footer-button',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './footer-button.component.html',
  styleUrl: './footer-button.component.scss'
})
export class footerButton implements OnInit {
  isLandingPage = false;

  constructor(private router: Router) {}

  ngOnInit() {
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        this.checkIfLandingPage(event.url);
      });

    this.checkIfLandingPage(this.router.url);
  }

  private checkIfLandingPage(url: string) {
    this.isLandingPage = url === '/' || url === '/home' || url === '/landing';
  }
}
