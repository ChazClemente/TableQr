import { ComponentFixture, TestBed } from '@angular/core/testing';
import { IngredientMaster } from './ingredient-master';

describe('IngredientMaster', () => {
  let component: IngredientMaster;
  let fixture: ComponentFixture<IngredientMaster>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IngredientMaster],
    }).compileComponents();

    fixture = TestBed.createComponent(IngredientMaster);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
