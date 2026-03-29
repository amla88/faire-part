import { Component, ViewEncapsulation } from '@angular/core';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { filter } from 'rxjs/operators';
import { MaterialModule } from 'src/app/material.module';
import { CommonModule } from '@angular/common';
import { NgScrollbarModule } from 'ngx-scrollbar';
import { TablerIconsModule } from 'angular-tabler-icons';
import { HeaderComponent } from './header/header.component';
import { SidebarComponent } from './sidebar/sidebar.component';
import { AppNavItemComponent } from './sidebar/nav-item/nav-item.component';
import { navItems } from './sidebar/sidebar-data';
import { navItemsAdmin } from './sidebar/sidebar-data-admin';
import { AppTopstripComponent } from './top-strip/topstrip.component';
import { FullBase } from './full-base';
import { BreakpointObserver } from '@angular/cdk/layout';
import { CoreService } from 'src/app/services/core.service';

@Component({
  selector: 'app-full',
  imports: [
    RouterModule,
    AppNavItemComponent,
    MaterialModule,
    CommonModule,
    SidebarComponent,
    NgScrollbarModule,
    TablerIconsModule,
    HeaderComponent,
    AppTopstripComponent
  ],
  templateUrl: './full.component.html',
  styleUrls: [],
  encapsulation: ViewEncapsulation.None
})
export class FullComponent extends FullBase {
  /**
   * Page plan de table : layout plein viewport sans scroll sur le shell,
   * pour que la molette zoome le canevas et non la page.
   */
  layoutFillViewport = false;

  constructor(settings: CoreService, router: Router, breakpointObserver: BreakpointObserver) {
    super(settings, router, breakpointObserver);
    if (router.url.startsWith('/admin')) {
      this.navItems = navItemsAdmin;
    } else {
      this.navItems = navItems;
    }
    const syncFill = () => {
      this.layoutFillViewport = router.url.includes('plan-de-table');
    };
    syncFill();
    router.events.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd)).subscribe(syncFill);
  }
}
