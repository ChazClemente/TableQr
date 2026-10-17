import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReceiptView } from './receipt-view';

describe('ReceiptView', () => {
  let component: ReceiptView;
  let fixture: ComponentFixture<ReceiptView>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReceiptView],
    }).compileComponents();

    fixture = TestBed.createComponent(ReceiptView);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
