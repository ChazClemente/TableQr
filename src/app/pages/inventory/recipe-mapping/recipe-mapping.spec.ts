import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RecipeMapping } from './recipe-mapping';

describe('RecipeMapping', () => {
  let component: RecipeMapping;
  let fixture: ComponentFixture<RecipeMapping>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RecipeMapping],
    }).compileComponents();

    fixture = TestBed.createComponent(RecipeMapping);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
