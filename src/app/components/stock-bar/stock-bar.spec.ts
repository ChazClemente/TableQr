import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StockBar } from './stock-bar';

describe('StockBar', () => {
  let component: StockBar;
  let fixture: ComponentFixture<StockBar>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StockBar],
    }).compileComponents();

    fixture = TestBed.createComponent(StockBar);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
