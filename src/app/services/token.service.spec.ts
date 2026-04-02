import { TestBed } from '@angular/core/testing';

import { TokenService } from './token.service';

describe('TokenService', () => {
  let service: TokenService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TokenService);
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  function createToken(offsetInSeconds: number): string {
    const payload = btoa(JSON.stringify({
      exp: Math.floor(Date.now() / 1000) + offsetInSeconds,
    }));

    return `header.${payload}.signature`;
  }

  it('should save access and refresh tokens in localStorage', () => {
    service.saveTokens('access-token', 'refresh-token');

    expect(service.getAccessToken()).toBe('access-token');
    expect(service.getRefreshToken()).toBe('refresh-token');
    expect(localStorage.getItem('token')).toBe('access-token');
    expect(localStorage.getItem('isLoggedIn')).toBe('true');
  });

  it('should remove all token related keys from localStorage', () => {
    service.saveTokens('access-token', 'refresh-token');

    service.removeTokens();

    expect(service.getAccessToken()).toBeNull();
    expect(service.getRefreshToken()).toBeNull();
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('isLoggedIn')).toBeNull();
  });

  it('should authenticate the user when the access token is still valid', () => {
    localStorage.setItem('accessToken', createToken(3600));

    expect(service.isAuthenticated()).toBeTrue();
  });

  it('should authenticate the user with a valid refresh token when the access token is expired', () => {
    localStorage.setItem('accessToken', createToken(-3600));
    localStorage.setItem('refreshToken', createToken(3600));

    expect(service.isAuthenticated()).toBeTrue();
  });

  it('should consider missing or malformed tokens as expired', () => {
    expect(service.isTokenExpired()).toBeTrue();
    expect(service.isTokenExpired('not-a-jwt')).toBeTrue();
  });
});
