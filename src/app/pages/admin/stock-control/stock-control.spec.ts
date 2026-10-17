import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StockControl } from './stock-control';

describe('StockControl', () => {
  let component: StockControl;
  let fixture: ComponentFixture<StockControl>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StockControl],
    }).compileComponents();

    fixture = TestBed.createComponent(StockControl);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
