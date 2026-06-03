import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor,
  HttpErrorResponse,
  HttpClient,
  HttpHeaders,
} from '@angular/common/http';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { catchError, filter, switchMap, take } from 'rxjs/operators';
import { TokenService } from '../services/token.service';
import { environment } from '../../environments/environment';

@Injectable()
export class JwtInterceptor implements HttpInterceptor {
  private isRefreshing = false;
  private refreshTokenSubject = new BehaviorSubject<string | null>(null);

  private readonly publicPaths = [
    '/api/morocco-ai/places',
    '/api/morocco-ai/search',
    '/api/ai/search',
  ];

  private readonly noAuthPaths = [
    '/api/auth/signin',
    '/api/auth/signup',
    '/api/auth/forgot-password',
    '/api/auth/reset-password',
  ];

  constructor(
    private tokenService: TokenService,
    private http: HttpClient
  ) {}

  intercept(
    request: HttpRequest<unknown>,
    next: HttpHandler
  ): Observable<HttpEvent<unknown>> {
    const token = this.tokenService.getAccessToken();
    const isPublicEndpoint = this.publicPaths.some(path => request.url.includes(path));
    const isNoAuthEndpoint = this.noAuthPaths.some(path => request.url.includes(path));

    if (token && !request.headers.has('Authorization') && !isNoAuthEndpoint) {
      if (isPublicEndpoint) {
        if (!this.tokenService.isTokenExpired(token)) {
          request = request.clone({
            setHeaders: { Authorization: `Bearer ${token}` },
          });
        }
      } else {
        request = request.clone({
          setHeaders: { Authorization: `Bearer ${token}` },
        });
      }
    }

    return next.handle(request).pipe(
      catchError((error: HttpErrorResponse) => {
        const isAuthEndpoint = request.url.includes('/api/auth/');

        if (error.status === 401 && !isAuthEndpoint) {
          return this.handleTokenExpired(request, next);
        }

        // Handle backend returning 403 for expired tokens instead of 401
        if (error.status === 403 && !isAuthEndpoint && !isPublicEndpoint) {
          const storedToken = this.tokenService.getAccessToken();
          if (storedToken && this.tokenService.isTokenExpired(storedToken)) {
            return this.handleTokenExpired(request, next);
          }
        }

        if (isPublicEndpoint && error.status === 403) {
          return throwError(() => ({
            status: 403,
            message: 'Accès refusé. Essayez plus tard ou connectez-vous.',
            url: request.url
          }));
        }

        return throwError(() => error);
      })
    );
  }

  private handleTokenExpired(
    request: HttpRequest<unknown>,
    next: HttpHandler
  ): Observable<HttpEvent<unknown>> {
    if (!this.isRefreshing) {
      this.isRefreshing = true;
      this.refreshTokenSubject.next(null);

      const refreshToken = this.tokenService.getRefreshToken();

      if (!refreshToken) {
        this.isRefreshing = false;
        this.tokenService.removeTokens();
        return throwError(() => ({ status: 401, message: 'Session expirée, veuillez vous reconnecter.' }));
      }

      const authUrl = environment.authServiceUrl || environment.apiGatewayUrl;
      const headers = new HttpHeaders({ Authorization: `Bearer ${refreshToken}` });

      return this.http
        .post<{ accessToken: string; refreshToken?: string }>(
          `${authUrl}/api/auth/refresh`,
          {},
          { headers }
        )
        .pipe(
          switchMap((response) => {
            this.isRefreshing = false;
            this.tokenService.saveTokens(response.accessToken, response.refreshToken);
            this.refreshTokenSubject.next(response.accessToken);
            return next.handle(this.cloneWithToken(request, response.accessToken));
          }),
          catchError((err) => {
            this.isRefreshing = false;
            this.tokenService.removeTokens();
            return throwError(() => err);
          })
        );
    }

    return this.refreshTokenSubject.pipe(
      filter((token): token is string => token !== null),
      take(1),
      switchMap((token) => next.handle(this.cloneWithToken(request, token)))
    );
  }

  private cloneWithToken(request: HttpRequest<unknown>, token: string): HttpRequest<unknown> {
    return request.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    });
  }
}
