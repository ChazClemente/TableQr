import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Module8RuleType } from '../../../core/models/module8.model';
import { Module8SubstitutionService } from '../../../services/module8-substitution.service';

@Component({
  selector: 'app-substitution-suggestion',
  imports: [CommonModule],
  templateUrl: './substitution-suggestion.html',
  styleUrl: './substitution-suggestion.css',
})
export class SubstitutionSuggestion {
  readonly substitution = inject(Module8SubstitutionService);
  readonly ruleType = signal<Module8RuleType>('preferred-substitute');
  readonly targetMenuItemId = signal('chicken-adobo');
  readonly targetOptions = computed(() =>
    this.substitution.menuItems().filter((item) => item.id !== this.substitution.unavailableItem()?.id),
  );
  readonly rules = this.substitution.rules.asReadonly();
  readonly suggestions = this.substitution.suggestions;
  readonly menuItems = this.substitution.menuItems.asReadonly();
  readonly unavailableItem = this.substitution.unavailableItem;
  readonly event = this.substitution.unavailableEvent;
  readonly log = this.substitution.log;
  readonly acceptanceRate = this.substitution.acceptanceRate;

  setRuleType(event: Event): void {
    this.ruleType.set((event.target as HTMLSelectElement).value as Module8RuleType);
  }

  setTargetMenuItem(event: Event): void {
    this.targetMenuItemId.set((event.target as HTMLSelectElement).value);
  }

  saveRule(): void {
    this.substitution.saveRule(this.ruleType(), this.targetMenuItemId());
  }

  previewNextEvent(): void {
    this.substitution.receiveNextUnavailableEvent();
  }

  removeRule(ruleId: string): void {
    this.substitution.removeRule(ruleId);
  }

  formatTime(date: Date): string {
    return this.substitution.formatTime(date);
  }

  menuItemName(itemId: string): string {
    return this.menuItems().find((item) => item.id === itemId)?.name ?? itemId;
  }

  ruleTypeLabel(type: Module8RuleType): string {
    if (type === 'exclude-item') return 'Item excluded';
    if (type === 'exclude-substitute') return 'Substitute excluded';
    return 'Preferred substitute';
  }
}
