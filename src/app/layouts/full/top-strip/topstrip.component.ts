import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  inject,
} from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-topstrip',
  imports: [RouterLink],
  templateUrl: './topstrip.component.html',
})
export class AppTopstripComponent implements AfterViewInit, OnDestroy {
  private el = inject(ElementRef<HTMLElement>);
  private ro: ResizeObserver | null = null;

  ngAfterViewInit(): void {
    const inner = this.el.nativeElement.querySelector('.app-topstrip');
    if (!(inner instanceof HTMLElement)) {
      return;
    }

    const apply = (): void => {
      const h = Math.ceil(inner.getBoundingClientRect().height);
      const px = Math.max(h, 48);
      document.documentElement.style.setProperty('--topstrip-offset', `${px}px`);
    };

    apply();
    requestAnimationFrame(() => apply());
    requestAnimationFrame(() => {
      requestAnimationFrame(() => apply());
    });

    if (typeof ResizeObserver !== 'undefined') {
      this.ro = new ResizeObserver(() => apply());
      this.ro.observe(inner);
    }

    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    if (fonts?.ready) {
      void fonts.ready.then(() => requestAnimationFrame(() => apply()));
    }
  }

  ngOnDestroy(): void {
    this.ro?.disconnect();
    this.ro = null;
    document.documentElement.style.removeProperty('--topstrip-offset');
  }
}
 