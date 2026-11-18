import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-invalid-session',
  template: `
    <div class="min-h-screen flex items-center justify-center p-6 text-center" style="background: #F4ECD8;">
      <div class="max-w-sm">
        <span class="text-5xl block mb-3">🔒</span>
        <h1 class="text-2xl font-bold mb-2" style="font-family: 'Playfair Display', serif; color: #2C1810;">
          Cannot access the menu
        </h1>
        <p class="mb-4 text-sm" style="color: #5C2E0A; font-family: 'Lato', sans-serif;">{{ message }}</p>
        <p class="text-xs italic" style="color: #9B7B5A; font-family: 'IM Fell English', serif;">
          Scan the QR code on the table again or ask a staff member.
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
        missing: 'No QR token. Please scan the QR code on your table.',
        expired: 'The QR session for this table has expired. Please scan the QR code on the table again.',
        ended: 'The session for this table has ended. Staff have been notified; please wait a moment or ask a staff member.',
        inactive: 'This table is deactivated.',
        invalid: 'This QR code is not valid.',
        error: 'There was a problem checking the session. Please try again.',
      } as Record<string, string>
    )[this.reason] ?? 'This QR code is not valid.';
}