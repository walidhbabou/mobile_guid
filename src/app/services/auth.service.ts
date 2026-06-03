import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { ApiService } from './api.service';
import { TokenService } from './token.service';
import {
  LoginRequest,
  SignupRequest,
  AuthResponse,
  SignupResponse,
  AuthValidationResponse,
  UpdatePasswordRequest,
  UpdateUserProfileRequest,
  UserProfileResponse,
  ForgotPasswordRequest,
  ForgotPasswordResponse,
  ResetPasswordRequest,
  ResetPasswordResponse,
} from '../models/auth.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly userIdStorageKey = 'userId';
  private readonly userPhoneStorageKey = 'userPhone';
  private isAuthenticatedSubject = new BehaviorSubject<boolean>(
    this.tokenService.isAuthenticated()
  );
  private currentUserIdSubject = new BehaviorSubject<number | null>(
    this.readStoredUserId()
  );
  public isAuthenticated$ = this.isAuthenticatedSubject.asObservable();
  public currentUserId$ = this.currentUserIdSubject.asObservable();

  constructor(
    private apiService: ApiService,
    private tokenService: TokenService,
    private router: Router
  ) {}

  login(credentials: LoginRequest): Observable<AuthResponse> {
    return this.apiService.login(credentials).pipe(
      tap((response: AuthResponse) => {
        const accessToken = response.accessToken || response.token || response.jwt;
        const refreshToken = response.refreshToken;

        if (accessToken) {
          this.tokenService.saveTokens(accessToken, refreshToken);
          this.isAuthenticatedSubject.next(true);
        }
      })
    );
  }

  signup(userData: SignupRequest): Observable<SignupResponse> {
    return this.apiService.signup(userData);
  }

  getCurrentUserProfile(): Observable<UserProfileResponse> {
    return this.apiService.getCurrentUserProfile().pipe(
      tap((profile: UserProfileResponse) => this.persistProfileSnapshot(profile))
    );
  }

  updateCurrentUserProfile(payload: UpdateUserProfileRequest): Observable<UserProfileResponse> {
    return this.apiService.updateCurrentUserProfile(payload).pipe(
      tap((profile: UserProfileResponse) => this.persistProfileSnapshot(profile))
    );
  }

  updateCurrentUserPassword(payload: UpdatePasswordRequest): Observable<{ message: string }> {
    return this.apiService.updateCurrentUserPassword(payload);
  }

  forgotPassword(payload: ForgotPasswordRequest): Observable<ForgotPasswordResponse> {
    return this.apiService.forgotPassword(payload);
  }

  resetPassword(payload: ResetPasswordRequest): Observable<ResetPasswordResponse> {
    return this.apiService.resetPassword(payload);
  }

  storeUserProfile(email: string, userName: string, userId?: number | null, phone?: string | null): void {
    localStorage.setItem('userEmail', email);
    localStorage.setItem('userName', userName);

    if (typeof phone === 'string') {
      localStorage.setItem(this.userPhoneStorageKey, phone);
    } else if (phone === null) {
      localStorage.removeItem(this.userPhoneStorageKey);
    }

    if (typeof userId === 'number' && Number.isFinite(userId)) {
      this.persistUserId(userId);
    }
  }

  logout(): void {
    this.tokenService.removeTokens();
    localStorage.removeItem('userName');
    localStorage.removeItem('userEmail');
    localStorage.removeItem(this.userPhoneStorageKey);
    localStorage.removeItem(this.userIdStorageKey);
    this.isAuthenticatedSubject.next(false);
    this.currentUserIdSubject.next(null);
    void this.router.navigateByUrl('/auth/login', { replaceUrl: true });
  }

  isAuthenticated(): boolean {
    return this.tokenService.isAuthenticated();
  }

  getAccessToken(): string | null {
    return this.tokenService.getAccessToken();
  }

  getStoredUserId(): number | null {
    return this.currentUserIdSubject.value;
  }

  resolveCurrentUserId(forceRefresh = false): Observable<number | null> {
    const storedUserId = this.readStoredUserId();
    const accessToken = this.tokenService.getAccessToken();

    if (
      !forceRefresh
      && typeof storedUserId === 'number'
      && accessToken
      && !this.tokenService.isTokenExpired(accessToken)
    ) {
      if (this.currentUserIdSubject.value !== storedUserId) {
        this.currentUserIdSubject.next(storedUserId);
      }

      return of(storedUserId);
    }

    if (!accessToken || this.tokenService.isTokenExpired(accessToken)) {
      localStorage.removeItem(this.userIdStorageKey);
      this.currentUserIdSubject.next(null);
      return of(null);
    }

    return this.apiService.validateAccessToken().pipe(
      map((response: AuthValidationResponse) => this.extractUserId(response)),
      tap((userId: number | null) => {
        if (typeof userId === 'number') {
          this.persistUserId(userId);
          return;
        }

        localStorage.removeItem(this.userIdStorageKey);
        this.currentUserIdSubject.next(null);
      }),
      catchError(() => {
        localStorage.removeItem(this.userIdStorageKey);
        this.currentUserIdSubject.next(null);
        return of(null);
      })
    );
  }

  private extractUserId(response: AuthValidationResponse): number | null {
    if (!response?.valid) {
      return null;
    }

    const candidate = typeof response.userId === 'string'
      ? Number(response.userId)
      : response.userId;

    return typeof candidate === 'number' && Number.isFinite(candidate) ? candidate : null;
  }

  private readStoredUserId(): number | null {
    const storedUserId = localStorage.getItem(this.userIdStorageKey);

    if (!storedUserId) {
      return null;
    }

    const parsedUserId = Number(storedUserId);
    return Number.isFinite(parsedUserId) ? parsedUserId : null;
  }

  private persistUserId(userId: number): void {
    localStorage.setItem(this.userIdStorageKey, String(userId));
    this.currentUserIdSubject.next(userId);
  }

  private persistProfileSnapshot(profile: UserProfileResponse): void {
    this.storeUserProfile(
      profile.email || localStorage.getItem('userEmail') || '',
      profile.fullName || profile.username || localStorage.getItem('userName') || 'Utilisateur',
      profile.id,
      profile.phone ?? null
    );
  }
}

