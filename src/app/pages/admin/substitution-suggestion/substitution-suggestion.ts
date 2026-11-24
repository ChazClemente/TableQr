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
  readonly savingRule = signal(false);
  readonly ruleMessage = signal<{ text: string; error: boolean } | null>(null);
  private readonly pickedTarget = signal<number | null>(null);

  readonly unavailableItems = this.substitution.unavailableItems;
  readonly unavailableItem = this.substitution.unavailableItem;
  readonly suggestions = this.substitution.suggestions;
  readonly rules = this.substitution.itemRules;
  readonly log = this.substitution.log;
  readonly acceptanceRate = this.substitution.acceptanceRate;

  readonly targetOptions = computed(() =>
    this.substitution.menuItems().filter((m) => m.isAvailable && m.id !== this.unavailableItem()?.id),
  );
  readonly target = computed(() => {
    const options = this.targetOptions();
    const picked = options.find((item) => item.id === this.pickedTarget());
    return picked?.id ?? options[0]?.id ?? null;
  });

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

  async saveRule(): Promise<void> {
    const t = this.target();
    if (t === null || this.savingRule()) return;
    this.savingRule.set(true);
    this.ruleMessage.set(null);
    try {
      await this.substitution.saveRule(this.ruleType(), t);
      this.ruleMessage.set({ text: 'Rule saved. Updated rankings are now visible here and on the customer menu.', error: false });
    } catch (error) {
      console.error('saveRule failed', error);
      const message = error instanceof Error && error.message.startsWith('Rule saved,')
        ? error.message
        : 'Could not save this rule. Check your connection or permissions, then try again.';
      this.ruleMessage.set({ text: message, error: true });
    } finally {
      this.savingRule.set(false);
    }
  }

  async removeRule(id: number): Promise<void> {
    if (this.savingRule()) return;
    this.savingRule.set(true);
    this.ruleMessage.set(null);
    try {
      await this.substitution.removeRule(id);
      this.ruleMessage.set({ text: 'Rule removed. Updated rankings are now visible here and on the customer menu.', error: false });
    } catch (error) {
      console.error('removeRule failed', error);
      const message = error instanceof Error && error.message.startsWith('Rule removed,')
        ? error.message
        : 'Could not remove this rule. Check your connection or permissions, then try again.';
      this.ruleMessage.set({ text: message, error: true });
    } finally {
      this.savingRule.set(false);
    }
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
    pickUnavailable(e: Event): void {
    this.select(Number((e.target as HTMLSelectElement).value));
  }

  ruleTypeLabel(type: Module8RuleType): string {
    return type === 'preferred' ? 'Preferred substitute' : 'Substitute excluded';
  }
}