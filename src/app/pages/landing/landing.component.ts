import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { isCountdownWindowActive } from 'src/app/services/countdown-window';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule],
  template: ``,
})
export class LandingComponent implements OnInit {
  constructor(private router: Router) {}

  ngOnInit(): void {
    const target = isCountdownWindowActive() ? '/decompte' : '/dashboard';
    void this.router.navigate([target], { replaceUrl: true });
  }
}

