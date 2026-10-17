import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Workload } from './workload';

describe('Workload', () => {
  let component: Workload;
  let fixture: ComponentFixture<Workload>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Workload],
    }).compileComponents();

    fixture = TestBed.createComponent(Workload);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
