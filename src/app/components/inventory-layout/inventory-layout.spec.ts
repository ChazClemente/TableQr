import { ComponentFixture, TestBed } from '@angular/core/testing';
import { InventoryLayout } from './inventory-layout';

describe('InventoryLayout', () => {
  let component: InventoryLayout;
  let fixture: ComponentFixture<InventoryLayout>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InventoryLayout],
    }).compileComponents();

    fixture = TestBed.createComponent(InventoryLayout);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
