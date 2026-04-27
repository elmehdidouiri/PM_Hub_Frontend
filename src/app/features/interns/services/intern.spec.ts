import { TestBed } from '@angular/core/testing';

import { Intern } from './intern';

describe('Intern', () => {
  let service: Intern;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Intern);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
