import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Capacitor } from '@capacitor/core';
import { Observable, throwError, TimeoutError, timeout } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';
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
import { TokenService } from './token.service';

type RuntimeEnvironment = typeof environment & {
  nativeApiGatewayUrl?: string;
  nativeAuthServiceUrl?: string;
};

interface ApiRequestOptions {
  timeoutMs?: number;
}

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private readonly runtimeEnvironment: RuntimeEnvironment = environment;
  private readonly requestTimeoutMs = 15000;
  private apiUrl = this.resolveBaseUrl(
    this.runtimeEnvironment.apiGatewayUrl,
    this.runtimeEnvironment.nativeApiGatewayUrl
  );
  private authUrl = this.resolveBaseUrl(
    this.runtimeEnvironment.authServiceUrl || this.runtimeEnvironment.apiGatewayUrl,
    this.runtimeEnvironment.nativeAuthServiceUrl || this.runtimeEnvironment.nativeApiGatewayUrl
  );

  constructor(
    private http: HttpClient,
    private tokenService: TokenService
  ) {}

  getBaseUrl(): string {
    return this.apiUrl;
  }

  login(credentials: LoginRequest): Observable<AuthResponse> {
    return this.withNetworkHandling(
      this.http.post<AuthResponse>(`${this.authUrl}/api/auth/signin`, credentials)
    );
  }

  signup(userData: SignupRequest): Observable<SignupResponse> {
    return this.withNetworkHandling(
      this.http.post<SignupResponse>(`${this.authUrl}/api/auth/signup`, userData)
    );
  }

  refreshAccessToken(): Observable<AuthResponse> {
    const refreshToken = this.tokenService.getRefreshToken();
    const headers = new HttpHeaders({ Authorization: `Bearer ${refreshToken}` });
    return this.withNetworkHandling(
      this.http.post<AuthResponse>(`${this.authUrl}/api/auth/refresh`, {}, { headers })
    );
  }

  validateAccessToken(): Observable<AuthValidationResponse> {
    return this.withNetworkHandling(
      this.http.post<AuthValidationResponse>(
        `${this.authUrl}/api/auth/validate`, {}, { headers: this.getAuthHeaders() }
      )
    );
  }

  getCurrentUserProfile(): Observable<UserProfileResponse> {
    return this.withNetworkHandling(
      this.http.get<UserProfileResponse>(`${this.authUrl}/api/auth/me`, { headers: this.getAuthHeaders() })
    );
  }

  updateCurrentUserProfile(payload: UpdateUserProfileRequest): Observable<UserProfileResponse> {
    return this.withNetworkHandling(
      this.http.put<UserProfileResponse>(`${this.authUrl}/api/auth/me`, payload, { headers: this.getAuthHeaders() })
    );
  }

  updateCurrentUserPassword(payload: UpdatePasswordRequest): Observable<{ message: string }> {
    return this.withNetworkHandling(
      this.http.put<{ message: string }>(`${this.authUrl}/api/auth/me/password`, payload, { headers: this.getAuthHeaders() })
    );
  }

  forgotPassword(payload: ForgotPasswordRequest): Observable<ForgotPasswordResponse> {
    return this.withNetworkHandling(
      this.http.post<ForgotPasswordResponse>(`${this.authUrl}/api/auth/forgot-password`, payload)
    );
  }

  resetPassword(payload: ResetPasswordRequest): Observable<ResetPasswordResponse> {
    return this.withNetworkHandling(
      this.http.post<ResetPasswordResponse>(`${this.authUrl}/api/auth/reset-password`, payload)
    );
  }

  getPlaces(): Observable<unknown> {
    return this.withNetworkHandling(this.http.get(`${this.apiUrl}/api/morocco-ai/places`));
  }

  getPlaceById(id: string): Observable<unknown> {
    return this.withNetworkHandling(
      this.http.get(`${this.apiUrl}/api/morocco-ai/places/by-place-id/${encodeURIComponent(id)}`)
    );
  }

  updatePlaceByPlaceId(placeId: string, payload: unknown): Observable<unknown> {
    return this.withNetworkHandling(
      this.http.put(
        `${this.apiUrl}/api/morocco-ai/places/by-place-id/${encodeURIComponent(placeId)}`,
        payload,
        { headers: this.getAuthHeaders() }
      )
    );
  }

  get(endpoint: string, options: ApiRequestOptions = {}): Observable<unknown> {
    return this.withNetworkHandling(
      this.http.get(`${this.apiUrl}${endpoint}`, { headers: this.getAuthHeaders() }),
      options.timeoutMs
    );
  }

  post(endpoint: string, data: unknown, options: ApiRequestOptions = {}): Observable<unknown> {
    return this.withNetworkHandling(
      this.http.post(`${this.apiUrl}${endpoint}`, data, { headers: this.getAuthHeaders() }),
      options.timeoutMs
    );
  }

  postFormData(endpoint: string, data: FormData, options: ApiRequestOptions = {}): Observable<unknown> {
    return this.withNetworkHandling(
      this.http.post(`${this.apiUrl}${endpoint}`, data, { headers: this.getAuthHeaders(false) }),
      options.timeoutMs
    );
  }

  put(endpoint: string, data: unknown): Observable<unknown> {
    return this.withNetworkHandling(
      this.http.put(`${this.apiUrl}${endpoint}`, data, { headers: this.getAuthHeaders() })
    );
  }

  delete(endpoint: string): Observable<unknown> {
    return this.withNetworkHandling(
      this.http.delete(`${this.apiUrl}${endpoint}`, { headers: this.getAuthHeaders() })
    );
  }

  private getAuthHeaders(includeJsonContentType = true): HttpHeaders {
    const token = this.tokenService.getAccessToken();
    let headers = new HttpHeaders();
    if (includeJsonContentType) {
      headers = headers.set('Content-Type', 'application/json');
    }
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    return headers;
  }

  private handleError(error: unknown) {
    if (error instanceof TimeoutError || (error as { name?: string })?.name === 'TimeoutError') {
      return throwError(() => this.createServerUnavailableError());
    }
    if ((error as { status?: number })?.status === 0) {
      return throwError(() => this.createServerUnavailableError());
    }
    const httpError = error as { error?: unknown; status?: number; message?: string };
    return throwError(() => httpError.error || {
      status: httpError?.status,
      message: httpError?.message || 'Une erreur est survenue lors de l appel API.'
    });
  }

  private withNetworkHandling<T>(request$: Observable<T>, timeoutMs = this.requestTimeoutMs): Observable<T> {
    return request$.pipe(
      timeout(timeoutMs),
      catchError((error) => this.handleError(error))
    );
  }

  private createServerUnavailableError() {
    return {
      status: 0,
      message: 'Impossible de joindre le serveur. Verifiez votre connexion ou relancez les services.'
    };
  }

  private resolveBaseUrl(configuredUrl: string, nativeUrl?: string): string {
    const normalizedUrl = this.normalizeUrl(configuredUrl);
    const normalizedNativeUrl = nativeUrl ? this.normalizeUrl(nativeUrl) : '';
    try {
      if (Capacitor.isNativePlatform()) {
        return normalizedNativeUrl || normalizedUrl;
      }
      if (environment.production) {
        return normalizedUrl;
      }
      return normalizedNativeUrl || normalizedUrl;
    } catch {
      return normalizedNativeUrl || normalizedUrl;
    }
  }

  private normalizeUrl(url: string): string {
    return url.replace(/\/+$/, '');
  }
}
