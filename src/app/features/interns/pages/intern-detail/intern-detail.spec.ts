import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InternDetail } from './intern-detail';

describe('InternDetail', () => {
  let component: InternDetail;
  let fixture: ComponentFixture<InternDetail>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [InternDetail]
    })
    .compileComponents();

    fixture = TestBed.createComponent(InternDetail);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
