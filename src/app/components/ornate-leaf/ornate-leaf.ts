import { Component } from '@angular/core';

@Component({
  selector: 'app-ornate-leaf',
  template: `
    <img
      src="/logo-full.jpg"
      alt="Kainan kay Aling Nene"
      class="h-9 w-9 sm:h-10 sm:w-10 rounded-full object-cover shrink-0"
      style="border: 1.5px solid #C4A882"
    />
  `,
})
export class OrnateLeaf {}