import { Component, computed, inject, input, resource } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import QRCode from 'qrcode';

/** Replacement for qrcode.react's <QRCodeSVG>. */
@Component({
  selector: 'app-qr-code',
  template: `<div [innerHTML]="svg.value() ?? ''" [style.width.px]="size()" [style.height.px]="size()"></div>`,
})
export class QrCode {
  private sanitizer = inject(DomSanitizer);

  value = input.required<string>();
  size = input(128);
  fgColor = input('#000000');
  bgColor = input('#FFFFFF');
  level = input<'L' | 'M' | 'Q' | 'H'>('L');

  private params = computed(() => ({
    value: this.value(), size: this.size(), fg: this.fgColor(), bg: this.bgColor(), level: this.level(),
  }));

  svg = resource({
    params: () => this.params(),
    loader: async ({ params: p }) => {
      const markup = await QRCode.toString(p.value, {
        type: 'svg', width: p.size, margin: 0, errorCorrectionLevel: p.level,
        color: { dark: p.fg, light: p.bg },
      });
      return this.sanitizer.bypassSecurityTrustHtml(markup);
    },
  });
}