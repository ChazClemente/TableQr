import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-invalid-session',
  template: `
    <div class="min-h-screen flex items-center justify-center p-6 text-center" style="background: #F4ECD8;">
      <div class="max-w-sm">
        <span class="text-5xl block mb-3">🔒</span>
        <h1 class="text-2xl font-bold mb-2" style="font-family: 'Playfair Display', serif; color: #2C1810;">
          Hindi ma-access ang menu
        </h1>
        <p class="mb-4 text-sm" style="color: #5C2E0A; font-family: 'Lato', sans-serif;">{{ message }}</p>
        <p class="text-xs italic" style="color: #9B7B5A; font-family: 'IM Fell English', serif;">
          I-scan ulit ang QR code sa mesa o magtanong sa staff.
        </p>
      </div>
    </div>
  `,
})
export class InvalidSession {
  private route = inject(ActivatedRoute);
  readonly reason = this.route.snapshot.queryParamMap.get('reason') ?? 'invalid';

  readonly message =
    (
      {
        missing: 'Walang QR token. Kailangan mong mag-scan ng QR code ng mesa.',
        expired: 'Expired na ang QR session ng mesang ito.',
        inactive: 'Naka-deactivate ang mesang ito.',
        invalid: 'Hindi valid ang QR code.',
        error: 'May problema sa pag-check ng session. Subukan ulit.',
      } as Record<string, string>
    )[this.reason] ?? 'Hindi valid ang QR code.';
}