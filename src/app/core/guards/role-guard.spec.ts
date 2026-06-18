import { TestBed } from '@angular/core/testing';
import { CanActivateFn, Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';

import { roleGuard } from './role-guard';
import { AuthService } from '../services/auth';

describe('roleGuard', () => {
  const executeGuard: CanActivateFn = (...guardParameters) => 
      TestBed.runInInjectionContext(() => roleGuard(...guardParameters));

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthService,
          useValue: {
            isReady$: new BehaviorSubject(true),
            isAuthenticated: () => true,
            isAdmin: () => true,
          },
        },
        {
          provide: Router,
          useValue: {
            createUrlTree: () => ({}),
          },
        },
      ],
    });
  });

  it('should be created', () => {
    const result = executeGuard({ data: {} } as any, { url: '/admin' } as any);

    expect(result).toBeTruthy();
  });
});
