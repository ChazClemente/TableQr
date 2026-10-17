import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OrnateLeaf } from './ornate-leaf';

describe('OrnateLeaf', () => {
  let component: OrnateLeaf;
  let fixture: ComponentFixture<OrnateLeaf>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OrnateLeaf],
    }).compileComponents();

    fixture = TestBed.createComponent(OrnateLeaf);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
