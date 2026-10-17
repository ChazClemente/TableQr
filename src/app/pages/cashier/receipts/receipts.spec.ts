import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Receipts } from './receipts';

describe('Receipts', () => {
  let component: Receipts;
  let fixture: ComponentFixture<Receipts>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Receipts],
    }).compileComponents();

    fixture = TestBed.createComponent(Receipts);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
