import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { ApiService } from './api.service';
import { TokenService } from './token.service';
import { LoginRequest, SignupRequest, AuthResponse, SignupResponse } from '../models/auth.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private isAuthenticatedSubject = new BehaviorSubject<boolean>(
    this.tokenService.isAuthenticated()
  );
  public isAuthenticated$ = this.isAuthenticatedSubject.asObservable();

  constructor(
    private apiService: ApiService,
    private tokenService: TokenService,
    private router: Router
  ) {}

  login(credentials: LoginRequest): Observable<AuthResponse> {
    return this.apiService.login(credentials).pipe(
      tap(response => {
        if (response.accessToken && response.refreshToken) {
          this.tokenService.saveTokens(response.accessToken, response.refreshToken);
          this.isAuthenticatedSubject.next(true);
        }
      })
    );
  }

  signup(userData: SignupRequest): Observable<SignupResponse> {
    return this.apiService.signup(userData);
  }

  storeUserProfile(email: string, userName: string): void {
    localStorage.setItem('userEmail', email);
    localStorage.setItem('userName', userName);
  }

  logout(): void {
    this.tokenService.removeTokens();
    localStorage.removeItem('userName');
    localStorage.removeItem('userEmail');
    this.isAuthenticatedSubject.next(false);
    void this.router.navigateByUrl('/auth/login', { replaceUrl: true });
  }

  isAuthenticated(): boolean {
    return this.tokenService.isAuthenticated();
  }

  getAccessToken(): string | null {
    return this.tokenService.getAccessToken();
  }
}

