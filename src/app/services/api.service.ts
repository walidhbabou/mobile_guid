import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { LoginRequest, SignupRequest, AuthResponse, SignupResponse } from '../models/auth.model';
import { TokenService } from './token.service';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private apiUrl = environment.apiGatewayUrl;
  private authUrl = environment.authServiceUrl || environment.apiGatewayUrl;

  constructor(
    private http: HttpClient,
    private tokenService: TokenService
  ) {}

  // ==================== AUTHENTIFICATION ====================
  login(credentials: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(
      `${this.authUrl}/api/auth/signin`,
      credentials
    ).pipe(
      catchError(this.handleError)
    );
  }

  signup(userData: SignupRequest): Observable<SignupResponse> {
    return this.http.post<SignupResponse>(
      `${this.authUrl}/api/auth/signup`,
      userData
    ).pipe(
      catchError(this.handleError)
    );
  }

  refreshAccessToken(): Observable<AuthResponse> {
    const refreshToken = this.tokenService.getRefreshToken();
    const headers = new HttpHeaders({
      Authorization: `Bearer ${refreshToken}`
    });

    return this.http.post<AuthResponse>(
      `${this.authUrl}/api/auth/refresh`,
      {},
      { headers }
    ).pipe(
      catchError(this.handleError)
    );
  }

  // ==================== PLACES ====================
  getPlaces(): Observable<any> {
    return this.http.get(`${this.apiUrl}/api/places`, {
      headers: this.getAuthHeaders()
    });
  }

  getPlaceById(id: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/api/places/${id}`, {
      headers: this.getAuthHeaders()
    });
  }

  // ==================== CORE SERVICES ====================
  getCoreData(endpoint: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/api/core/${endpoint}`, {
      headers: this.getAuthHeaders()
    });
  }

  // ==================== AI SERVICES ====================
  getAiData(endpoint: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/api/ai/${endpoint}`, {
      headers: this.getAuthHeaders()
    });
  }

  // ==================== MOROCCO AI ====================
  getMoroccoAiData(endpoint: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/api/morocco-ai/${endpoint}`, {
      headers: this.getAuthHeaders()
    });
  }

  // ==================== REQUÊTES GÉNÉRIQUES ====================
  get(endpoint: string): Observable<any> {
    return this.http.get(`${this.apiUrl}${endpoint}`, {
      headers: this.getAuthHeaders()
    });
  }

  post(endpoint: string, data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}${endpoint}`, data, {
      headers: this.getAuthHeaders()
    });
  }

  put(endpoint: string, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}${endpoint}`, data, {
      headers: this.getAuthHeaders()
    });
  }

  delete(endpoint: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}${endpoint}`, {
      headers: this.getAuthHeaders()
    });
  }

  // ==================== GESTION DES HEADERS ====================
  private getAuthHeaders(): HttpHeaders {
    const token = this.tokenService.getAccessToken();
    let headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });

    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }

    return headers;
  }

  private handleError(error: any) {
    console.error('API Error:', error);
    return throwError(() => error.error || error);
  }
}

