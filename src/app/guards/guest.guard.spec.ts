import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, UrlTree } from '@angular/router';

import { TokenService } from '../services/token.service';
import { guestGuard } from './guest.guard';

describe('guestGuard', () => {
  let tokenServiceSpy: jasmine.SpyObj<TokenService>;
  let router: Router;

  beforeEach(() => {
    tokenServiceSpy = jasmine.createSpyObj<TokenService>('TokenService', ['isAuthenticated']);

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: TokenService, useValue: tokenServiceSpy },
      ],
    });

    router = TestBed.inject(Router);
  });

  it('should allow guests to continue to the auth screens', () => {
    tokenServiceSpy.isAuthenticated.and.returnValue(false);

    const result = TestBed.runInInjectionContext(() => guestGuard({} as any, [] as any));

    expect(result).toBeTrue();
  });

  it('should redirect authenticated users to the tabs area', () => {
    tokenServiceSpy.isAuthenticated.and.returnValue(true);

    const result = TestBed.runInInjectionContext(() => guestGuard({} as any, [] as any));

    expect(router.serializeUrl(result as UrlTree)).toBe('/tabs/home');
  });
});
