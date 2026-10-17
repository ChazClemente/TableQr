import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DayClosing } from './day-closing';

describe('DayClosing', () => {
  let component: DayClosing;
  let fixture: ComponentFixture<DayClosing>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DayClosing],
    }).compileComponents();

    fixture = TestBed.createComponent(DayClosing);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
