import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HourSummary } from './hour-summary';

describe('HourSummary', () => {
  let component: HourSummary;
  let fixture: ComponentFixture<HourSummary>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [HourSummary]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HourSummary);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
