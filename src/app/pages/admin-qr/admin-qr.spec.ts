import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AdminQr } from './admin-qr';

describe('AdminQr', () => {
  let component: AdminQr;
  let fixture: ComponentFixture<AdminQr>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminQr],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminQr);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
