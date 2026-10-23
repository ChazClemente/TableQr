import { Component } from '@angular/core';

@Component({
  selector: 'app-ornate-leaf',
  template: `
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" class="text-secondary opacity-60">
      <path d="M9 1C9 1 3 5 3 10C3 13.866 5.686 17 9 17C12.314 17 15 13.866 15 10C15 5 9 1 9 1Z" fill="currentColor" opacity="0.3" />
      <path d="M9 1L9 17M9 1C9 1 5 6 6 10M9 1C9 1 13 6 12 10" stroke="currentColor" stroke-width="0.8" stroke-linecap="round" />
    </svg>
  `,
})
export class OrnateLeaf {}