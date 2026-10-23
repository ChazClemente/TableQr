import { Pipe, PipeTransform } from '@angular/core';

/** Mirrors JS `Number.prototype.toLocaleString()` used throughout the original React code. */
@Pipe({ name: 'num' })
export class NumPipe implements PipeTransform {
  transform(value: number | null | undefined, options?: Intl.NumberFormatOptions): string {
    return (value ?? 0).toLocaleString(undefined, options);
  }
}