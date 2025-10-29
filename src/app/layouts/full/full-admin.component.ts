import { Component, ViewEncapsulation } from '@angular/core';
import { RouterModule } from '@angular/router';
import { MaterialModule } from 'src/app/material.module';
import { CommonModule } from '@angular/common';
import { NgScrollbarModule } from 'ngx-scrollbar';
import { TablerIconsModule } from 'angular-tabler-icons';
import { HeaderComponent } from './header/header.component';
import { SidebarComponent } from './sidebar/sidebar.component';
import { AppNavItemComponent } from './sidebar/nav-item/nav-item.component';
import { navItemsAdmin } from './sidebar/sidebar-data-admin';
import { AppTopstripComponent } from './top-strip/topstrip.component';
import { FullBase } from './full-base';
import { BreakpointObserver } from '@angular/cdk/layout';
import { CoreService } from 'src/app/services/core.service';
import { Router } from '@angular/router';


@Component({
  selector: 'app-full-admin',
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
export class FullAdminComponent extends FullBase {
  constructor(settings: CoreService, router: Router, breakpointObserver: BreakpointObserver) {
    super(settings, router, breakpointObserver);
    this.navItems = navItemsAdmin;
  }
}
