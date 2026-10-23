import { Component } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-home',
  imports: [RouterLink, NgTemplateOutlet],
  templateUrl: './home.html',
})
export class Home {
  modules = [
    {
      icon: '🍽',
      title: 'Digital Menu',
      description: 'Mobile-responsive menu with real-time stock status and categorized Filipino dishes.',
      link: '/table/T01/menu',
      linkLabel: 'Preview Menu',
    },
    {
      icon: '🛒',
      title: 'Order Cart',
      description: 'Customers build their order, adjust quantities, and see a live subtotal before submitting.',
      link: '/table/T01/cart',
      linkLabel: 'View Cart',
    },
    {
      icon: '📋',
      title: 'Order Status',
      description: 'Real-time order tracking — Preparing, Ready, Served — with a live itemized bill preview.',
      link: '/table/T01/order',
      linkLabel: 'Track Order',
    },
    {
      icon: '💳',
      title: 'Payment',
      description: 'Pay via GCash, Maya, or notify the cashier for cash — all from the customer\'s mobile browser.',
      link: '/table/T01/payment',
      linkLabel: 'Go to Payment',
    },
  ];
}