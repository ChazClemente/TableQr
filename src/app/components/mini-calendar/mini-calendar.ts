import { Component, computed, input, output, signal } from '@angular/core';

export function toDateKey(d: Date) {
  return d.toLocaleDateString('en-CA'); // YYYY-MM-DD
}

@Component({
  selector: 'app-mini-calendar',
  templateUrl: './mini-calendar.html',
})
export class MiniCalendar {
  activeDates = input.required<Set<string>>();
  selected = input('');
  dateSelected = output<string>();

  weekdays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  private today = new Date();
  viewYear = signal(this.today.getFullYear());
  viewMonth = signal(this.today.getMonth()); // 0-indexed

  monthLabel = computed(() =>
    new Date(this.viewYear(), this.viewMonth(), 1).toLocaleDateString('en-PH', { month: 'long', year: 'numeric' }),
  );

  cells = computed(() => {
    const y = this.viewYear();
    const m = this.viewMonth();
    const firstDay = new Date(y, m, 1).getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();

    const result: ({ day: number; key: string; isToday: boolean; hasReceipts: boolean; isSelected: boolean } | null)[] =
      Array(firstDay).fill(null);

    for (let d = 1; d <= daysInMonth; d++) {
      const key = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      result.push({
        day: d,
        key,
        isToday: key === toDateKey(this.today),
        hasReceipts: this.activeDates().has(key),
        isSelected: key === this.selected(),
      });
    }
    while (result.length % 7 !== 0) result.push(null);
    return result;
  });

  prevMonth() {
    if (this.viewMonth() === 0) {
      this.viewMonth.set(11);
      this.viewYear.update(y => y - 1);
    } else {
      this.viewMonth.update(m => m - 1);
    }
  }

  nextMonth() {
    if (this.viewMonth() === 11) {
      this.viewMonth.set(0);
      this.viewYear.update(y => y + 1);
    } else {
      this.viewMonth.update(m => m + 1);
    }
  }

  pick(c: { key: string; isSelected: boolean }) {
    this.dateSelected.emit(c.isSelected ? '' : c.key);
  }
}