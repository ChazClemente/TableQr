import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BillCard } from './bill-card';

describe('BillCard', () => {
  let component: BillCard;
  let fixture: ComponentFixture<BillCard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BillCard],
    }).compileComponents();

    fixture = TestBed.createComponent(BillCard);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
