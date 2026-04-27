import { TestBed } from '@angular/core/testing';

import { Hour } from './hour';

describe('Hour', () => {
  let service: Hour;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Hour);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
