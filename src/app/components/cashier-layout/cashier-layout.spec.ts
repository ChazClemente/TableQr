import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CashierLayout } from './cashier-layout';

describe('CashierLayout', () => {
  let component: CashierLayout;
  let fixture: ComponentFixture<CashierLayout>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CashierLayout],
    }).compileComponents();

    fixture = TestBed.createComponent(CashierLayout);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
