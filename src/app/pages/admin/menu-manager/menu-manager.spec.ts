import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MenuManager } from './menu-manager';

describe('MenuManager', () => {
  let component: MenuManager;
  let fixture: ComponentFixture<MenuManager>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MenuManager],
    }).compileComponents();

    fixture = TestBed.createComponent(MenuManager);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
