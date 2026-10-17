import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FireTimeAdvisor } from './fire-time-advisor';

describe('FireTimeAdvisor', () => {
  let component: FireTimeAdvisor;
  let fixture: ComponentFixture<FireTimeAdvisor>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FireTimeAdvisor],
    }).compileComponents();

    fixture = TestBed.createComponent(FireTimeAdvisor);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
