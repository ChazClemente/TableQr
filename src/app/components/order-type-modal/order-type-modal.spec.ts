import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OrderTypeModal } from './order-type-modal';

describe('OrderTypeModal', () => {
  let component: OrderTypeModal;
  let fixture: ComponentFixture<OrderTypeModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OrderTypeModal],
    }).compileComponents();

    fixture = TestBed.createComponent(OrderTypeModal);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
