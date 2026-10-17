import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { OrnateLeaf } from '../ornate-leaf/ornate-leaf';

@Component({
  selector: 'app-admin-layout',
  imports: [RouterLink, OrnateLeaf],
  templateUrl: './admin-layout.html',
})
export class AdminLayout {
  private router = inject(Router);

  logout() {
    this.router.navigate(['/login']);
  }
}