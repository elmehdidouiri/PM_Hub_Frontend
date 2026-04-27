import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InternForm } from './intern-form';

describe('InternForm', () => {
  let component: InternForm;
  let fixture: ComponentFixture<InternForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [InternForm]
    })
    .compileComponents();

    fixture = TestBed.createComponent(InternForm);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
