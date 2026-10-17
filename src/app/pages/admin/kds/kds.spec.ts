import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Kds } from './kds';

describe('Kds', () => {
  let component: Kds;
  let fixture: ComponentFixture<Kds>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Kds],
    }).compileComponents();

    fixture = TestBed.createComponent(Kds);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
