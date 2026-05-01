import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { filter } from 'rxjs/operators';
import { MaterialModule } from 'src/app/material.module';
import { CommonModule } from '@angular/common';
import { NgScrollbarModule } from 'ngx-scrollbar';
import { TablerIconsModule } from 'angular-tabler-icons';
import { HeaderComponent } from './header/header.component';
import { AppNavItemComponent } from './sidebar/nav-item/nav-item.component';
import { navItems as navItemsSource } from './sidebar/sidebar-data';
import { navItemsAdmin } from './sidebar/sidebar-data-admin';
import { AppTopstripComponent } from './top-strip/topstrip.component';
import { FullBase } from './full-base';
import { BreakpointObserver } from '@angular/cdk/layout';
import { CoreService } from 'src/app/services/core.service';
import { AuthService } from 'src/app/services/auth.service';
import { NavItem } from './sidebar/nav-item/nav-item';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-full',
  imports: [
    RouterModule,
    AppNavItemComponent,
    MaterialModule,
    CommonModule,
    NgScrollbarModule,
    TablerIconsModule,
    HeaderComponent,
    AppTopstripComponent
  ],
  templateUrl: './full.component.html',
  styleUrls: [],
  encapsulation: ViewEncapsulation.None
})
export class FullComponent extends FullBase implements OnInit {
  /**
   * Page plan de table : layout plein viewport sans scroll sur le shell,
   * pour que la molette zoome le canevas et non la page.
   */
  layoutFillViewport = false;

  private readonly guestNavSub: Subscription;

  constructor(
    settings: CoreService,
    router: Router,
    breakpointObserver: BreakpointObserver,
    private readonly auth: AuthService,
  ) {
    super(settings, router, breakpointObserver);
    const syncFromRoute = () => {
      // Après chaque navigation : URL fiable (au constructeur, l’URL peut ne pas encore être `/admin`).
      this.navItems = router.url.startsWith('/admin') ? navItemsAdmin : this.buildGuestNavItems();
      this.layoutFillViewport = router.url.includes('plan-de-table');
    };
    syncFromRoute();
    router.events.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd)).subscribe(syncFromRoute);
    this.guestNavSub = this.auth.guestNavLayoutTick$.subscribe(() => {
      if (!router.url.startsWith('/admin')) {
        this.navItems = this.buildGuestNavItems();
      }
    });
  }

  ngOnInit(): void {
    if (!this.router.url.startsWith('/admin')) {
      void this.auth.refreshGuestPersonnesFromRpc();
    }
  }

  private buildGuestNavItems(): NavItem[] {
    const showAnniv = this.auth.canSeeAnniversaire40Page();
    return navItemsSource.filter((item) => !item.requiresAnniversaireInvite || showAnniv);
  }

  override ngOnDestroy(): void {
    this.guestNavSub.unsubscribe();
    super.ngOnDestroy();
  }
}

