import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PosTerminal } from './pos-terminal';

describe('PosTerminal', () => {
  let component: PosTerminal;
  let fixture: ComponentFixture<PosTerminal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PosTerminal],
    }).compileComponents();

    fixture = TestBed.createComponent(PosTerminal);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
