import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';

import { AuthResponse, SignupResponse } from '../models/auth.model';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';

describe('AuthService', () => {
  let service: AuthService;
  let apiServiceSpy: jasmine.SpyObj<ApiService>;
  let tokenServiceSpy: jasmine.SpyObj<TokenService>;
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(() => {
    apiServiceSpy = jasmine.createSpyObj<ApiService>('ApiService', ['login', 'signup']);
    tokenServiceSpy = jasmine.createSpyObj<TokenService>('TokenService', [
      'isAuthenticated',
      'saveTokens',
      'removeTokens',
      'getAccessToken',
    ]);
    routerSpy = jasmine.createSpyObj<Router>('Router', ['navigateByUrl']);

    tokenServiceSpy.isAuthenticated.and.returnValue(false);
    routerSpy.navigateByUrl.and.returnValue(Promise.resolve(true));

    TestBed.configureTestingModule({
      providers: [
        AuthService,
        { provide: ApiService, useValue: apiServiceSpy },
        { provide: TokenService, useValue: tokenServiceSpy },
        { provide: Router, useValue: routerSpy },
      ],
    });

    service = TestBed.inject(AuthService);
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should save tokens and emit an authenticated state after a successful login', () => {
    const emissions: boolean[] = [];
    const response: AuthResponse = {
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      username: 'yassine',
      email: 'yassine@example.com',
    };

    service.isAuthenticated$.subscribe((value: boolean) => emissions.push(value));
    apiServiceSpy.login.and.returnValue(of(response));

    service.login({ username: 'yassine', password: 'secret' }).subscribe();

    expect(apiServiceSpy.login).toHaveBeenCalledWith({ username: 'yassine', password: 'secret' });
    expect(tokenServiceSpy.saveTokens).toHaveBeenCalledOnceWith('access-token', 'refresh-token');
    expect(emissions).toEqual([false, true]);
  });

  it('should not update the auth state when the backend response misses one token', () => {
    const emissions: boolean[] = [];

    service.isAuthenticated$.subscribe((value: boolean) => emissions.push(value));
    apiServiceSpy.login.and.returnValue(of({ accessToken: 'access-only' } as AuthResponse));

    service.login({ username: 'yassine', password: 'secret' }).subscribe();

    expect(tokenServiceSpy.saveTokens).not.toHaveBeenCalled();
    expect(emissions).toEqual([false]);
  });

  it('should delegate signup requests to ApiService', () => {
    const response: SignupResponse = {
      message: 'Compte cree',
      username: 'yassine',
      email: 'yassine@example.com',
    };

    apiServiceSpy.signup.and.returnValue(of(response));

    service.signup({
      username: 'yassine',
      email: 'yassine@example.com',
      password: 'secret',
    }).subscribe((result: SignupResponse) => {
      expect(result).toEqual(response);
    });

    expect(apiServiceSpy.signup).toHaveBeenCalled();
  });

  it('should store the user profile in localStorage', () => {
    service.storeUserProfile('yassine@example.com', 'Yassine');

    expect(localStorage.getItem('userEmail')).toBe('yassine@example.com');
    expect(localStorage.getItem('userName')).toBe('Yassine');
  });

  it('should clear auth data and redirect to login during logout', () => {
    const emissions: boolean[] = [];

    localStorage.setItem('userEmail', 'yassine@example.com');
    localStorage.setItem('userName', 'Yassine');
    service.isAuthenticated$.subscribe((value: boolean) => emissions.push(value));

    service.logout();

    expect(tokenServiceSpy.removeTokens).toHaveBeenCalled();
    expect(localStorage.getItem('userEmail')).toBeNull();
    expect(localStorage.getItem('userName')).toBeNull();
    expect(routerSpy.navigateByUrl).toHaveBeenCalledWith('/auth/login', { replaceUrl: true });
    expect(emissions).toEqual([false, false]);
  });
});
