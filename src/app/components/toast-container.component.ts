import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ToastService } from '../services/toast.service';

@Component({
  standalone: true,
  selector: 'app-toast-container',
  imports: [CommonModule],
  templateUrl: './toast-container.component.html',
  styleUrls: ['./toast-container.component.css']
})
export class ToastContainerComponent {
  constructor(public svc: ToastService, private snack: MatSnackBar) {
    // Ouvre un snackbar à chaque toast émis
    const open = (type: 'success'|'error'|'info', text: string) => {
      this.snack.open(text, 'OK', { duration: type === 'error' ? 3500 : 2500, panelClass: [type] });
    };
    const origShow = svc.show.bind(svc);
    svc.show = (text: string, type = 'info', ms = 2500) => { open(type, text); origShow(text, type, ms); };
  }
}
