import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BookingsTrackerComponent } from './bookings-tracker.component';

describe('BookingsTrackerComponent', () => {
  let component: BookingsTrackerComponent;
  let fixture: ComponentFixture<BookingsTrackerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BookingsTrackerComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BookingsTrackerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
