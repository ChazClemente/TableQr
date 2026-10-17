import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DiscountManager } from './discount-manager';

describe('DiscountManager', () => {
  let component: DiscountManager;
  let fixture: ComponentFixture<DiscountManager>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DiscountManager],
    }).compileComponents();

    fixture = TestBed.createComponent(DiscountManager);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
