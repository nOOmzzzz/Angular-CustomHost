import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RequestStaffComponent } from './request-staff.component';

describe('RequestStaffComponent', () => {
  let component: RequestStaffComponent;
  let fixture: ComponentFixture<RequestStaffComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RequestStaffComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RequestStaffComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
