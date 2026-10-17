import { ComponentFixture, TestBed } from '@angular/core/testing';
import { VarianceEngine } from './variance-engine';

describe('VarianceEngine', () => {
  let component: VarianceEngine;
  let fixture: ComponentFixture<VarianceEngine>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VarianceEngine],
    }).compileComponents();

    fixture = TestBed.createComponent(VarianceEngine);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
