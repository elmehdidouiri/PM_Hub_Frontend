import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HourEntry } from './hour-entry';

describe('HourEntry', () => {
  let component: HourEntry;
  let fixture: ComponentFixture<HourEntry>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [HourEntry]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HourEntry);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
