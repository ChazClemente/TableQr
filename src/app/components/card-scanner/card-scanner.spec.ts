import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CardScanner } from './card-scanner';

describe('CardScanner', () => {
  let component: CardScanner;
  let fixture: ComponentFixture<CardScanner>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CardScanner],
    }).compileComponents();

    fixture = TestBed.createComponent(CardScanner);
    component = fixture.componentInstance;

    // Required signal input — must be set BEFORE whenStable/detectChanges,
    // otherwise the template throws NG0950 on first render.
    fixture.componentRef.setInput('discountType', 'pwd');

    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});