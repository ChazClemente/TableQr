import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StockMonitor } from './stock-monitor';

describe('StockMonitor', () => {
  let component: StockMonitor;
  let fixture: ComponentFixture<StockMonitor>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StockMonitor],
    }).compileComponents();

    fixture = TestBed.createComponent(StockMonitor);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
