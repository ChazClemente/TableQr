import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FloorMap } from './floor-map';

describe('FloorMap', () => {
  let component: FloorMap;
  let fixture: ComponentFixture<FloorMap>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FloorMap],
    }).compileComponents();

    fixture = TestBed.createComponent(FloorMap);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
