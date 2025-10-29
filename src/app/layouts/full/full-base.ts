import { BreakpointObserver } from '@angular/cdk/layout';
import { OnDestroy, OnInit, ViewChild, Directive } from '@angular/core';
import { Subscription } from 'rxjs';
import { MatSidenav, MatSidenavContent } from '@angular/material/sidenav';
import { CoreService } from 'src/app/services/core.service';
import { filter } from 'rxjs/operators';
import { NavigationEnd, Router } from '@angular/router';

const MOBILE_VIEW = 'screen and (max-width: 768px)';
const TABLET_VIEW = 'screen and (min-width: 769px) and (max-width: 1024px)';

/**
 * Shared logic for the full layout variants.
 * Extracted to avoid duplication between `FullComponent` and `FullAdminComponent`.
 *
 * This base class uses Angular view/query decorators; mark as a directive so
 * Angular's compiler accepts property decorators on the base class.
 */
@Directive()
export abstract class FullBase implements OnInit, OnDestroy {
  navItems: any[] = [];

  @ViewChild('leftsidenav')
  public sidenav!: MatSidenav;

  @ViewChild('content', { static: true })
  public content!: MatSidenavContent;

  // get options from service
  options: any;
  private layoutChangesSubscription = Subscription.EMPTY;
  private isMobileScreen = false;
  private isContentWidthFixed = true;
  private isCollapsedWidthFixed = false;
  private htmlElement!: HTMLHtmlElement;

  get isOver(): boolean {
    return this.isMobileScreen;
  }

  constructor(
    protected settings: CoreService,
    protected router: Router,
    protected breakpointObserver: BreakpointObserver
  ) {
    this.htmlElement = document.querySelector('html')!;
    this.options = this.settings.getOptions();

    this.layoutChangesSubscription = this.breakpointObserver
      .observe([MOBILE_VIEW, TABLET_VIEW])
      .subscribe((state) => {
        // SidenavOpened must be reset true when layout changes
        this.options.sidenavOpened = true;
        this.isMobileScreen = state.breakpoints[MOBILE_VIEW];
        if (this.options.sidenavCollapsed == false) {
          this.options.sidenavCollapsed = state.breakpoints[TABLET_VIEW];
        }
      });

    // This is for scroll to top
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe(() => {
      try {
        this.content?.scrollTo({ top: 0 });
      } catch (e) {
        // content may not be available immediately; ignore
      }
    });
  }

  ngOnInit(): void {}

  ngOnDestroy() {
    this.layoutChangesSubscription.unsubscribe();
  }

  toggleCollapsed() {
    this.isContentWidthFixed = false;
    this.options.sidenavCollapsed = !this.options.sidenavCollapsed;
    this.resetCollapsedState();
  }

  resetCollapsedState(timer = 400) {
    setTimeout(() => this.settings.setOptions(this.options), timer);
  }

  onSidenavClosedStart() {
    this.isContentWidthFixed = false;
  }

  onSidenavOpenedChange(isOpened: boolean) {
    this.isCollapsedWidthFixed = !this.isOver;
    this.options.sidenavOpened = isOpened;
    //this.settings.setOptions(this.options);
  }
}
