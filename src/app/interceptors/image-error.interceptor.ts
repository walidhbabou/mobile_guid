import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

/**
 * Interceptor to handle image loading errors from Google Maps API.
 * Logs detailed information for debugging image loading issues.
 */
@Injectable()
export class ImageErrorInterceptor implements HttpInterceptor {
  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    // Only intercept Google Maps API photo requests
    if (!req.url.includes('maps.googleapis.com/maps/api/place/photo')) {
      return next.handle(req);
    }

    return next.handle(req).pipe(
      catchError((error: unknown) => {
        const httpError = error as HttpErrorResponse;
        console.error('[ImageError] Failed to load Google Places image:', {
          url: req.url,
          status: httpError?.status,
          statusText: httpError?.statusText,
          message: httpError?.message,
        });
        return throwError(() => error);
      })
    );
  }
}
