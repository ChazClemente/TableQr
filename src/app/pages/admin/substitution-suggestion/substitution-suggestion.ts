import { Component, computed, inject, signal } from '@angular/core';
import { Module8RuleType } from '../../../core/models/module8.model';
import { MENU_IMAGES } from '../../../core/models/module8-images';
import { Module8SubstitutionService } from '../../../services/module8-substitution.service';

@Component({
  selector: 'app-substitution-suggestion',
  imports: [],
  templateUrl: './substitution-suggestion.html',
  styleUrl: './substitution-suggestion.css',
})
export class SubstitutionSuggestion {
  readonly substitution = inject(Module8SubstitutionService);

  readonly ruleType = signal<Module8RuleType>('preferred');
  private readonly pickedTarget = signal<number | null>(null);

  readonly unavailableItems = this.substitution.unavailableItems;
  readonly unavailableItem = this.substitution.unavailableItem;
  readonly suggestions = this.substitution.suggestions;
  readonly rules = this.substitution.itemRules;
  readonly log = this.substitution.log;
  readonly acceptanceRate = this.substitution.acceptanceRate;

  readonly targetOptions = computed(() =>
    this.substitution.menuItems().filter((m) => m.id !== this.unavailableItem()?.id),
  );
  readonly target = computed(() => this.pickedTarget() ?? this.targetOptions()[0]?.id ?? null);

  image(name: string): string {
    return MENU_IMAGES[name] ?? '';
  }

  hideImg(e: Event): void {
    (e.target as HTMLImageElement).style.display = 'none';
  }

  select(id: number): void {
    this.substitution.select(id);
    this.pickedTarget.set(null);
  }

  setRuleType(e: Event): void {
    this.ruleType.set((e.target as HTMLSelectElement).value as Module8RuleType);
  }

  setTarget(e: Event): void {
    this.pickedTarget.set(Number((e.target as HTMLSelectElement).value));
  }

  saveRule(): void {
    const t = this.target();
    if (t !== null) void this.substitution.saveRule(this.ruleType(), t);
  }

  removeRule(id: number): void {
    this.substitution.removeRule(id);
  }

  menuItemName(id: number): string {
    return this.substitution.menuItemName(id);
  }

  ruleDescription = (r: Parameters<Module8SubstitutionService['ruleDescription']>[0]) =>
    this.substitution.ruleDescription(r);

  formatTime(d: Date): string {
    return this.substitution.formatTime(d);
  }

  outcome(a: boolean | null): string {
    return a === null ? 'Awaiting customer' : a ? 'Accepted' : 'Skipped';
  }
}