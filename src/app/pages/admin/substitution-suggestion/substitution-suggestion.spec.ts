import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SubstitutionSuggestion } from './substitution-suggestion';

describe('SubstitutionSuggestion', () => {
  let component: SubstitutionSuggestion;
  let fixture: ComponentFixture<SubstitutionSuggestion>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SubstitutionSuggestion],
    }).compileComponents();

    fixture = TestBed.createComponent(SubstitutionSuggestion);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
