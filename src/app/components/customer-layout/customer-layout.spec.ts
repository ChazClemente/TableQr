import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CustomerLayout } from './customer-layout';

describe('CustomerLayout', () => {
  let component: CustomerLayout;
  let fixture: ComponentFixture<CustomerLayout>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CustomerLayout],
    }).compileComponents();

    fixture = TestBed.createComponent(CustomerLayout);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
