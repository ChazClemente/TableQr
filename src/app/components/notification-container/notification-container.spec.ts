import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NotificationContainer } from "./notification-container";

describe("NotificationContainer", () => {
  let component: NotificationContainer;
  let fixture: ComponentFixture<NotificationContainer>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NotificationContainer],
    }).compileComponents();

    fixture = TestBed.createComponent(NotificationContainer);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
