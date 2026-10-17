import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BillSettlement } from './bill-settlement';

describe('BillSettlement', () => {
  let component: BillSettlement;
  let fixture: ComponentFixture<BillSettlement>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BillSettlement],
    }).compileComponents();

    fixture = TestBed.createComponent(BillSettlement);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
