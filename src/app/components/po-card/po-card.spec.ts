import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PoCard } from './po-card';

describe('PoCard', () => {
  let component: PoCard;
  let fixture: ComponentFixture<PoCard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PoCard],
    }).compileComponents();

    fixture = TestBed.createComponent(PoCard);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
