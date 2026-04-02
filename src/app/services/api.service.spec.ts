import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../environments/environment';
import { ApiService } from './api.service';
import { TokenService } from './token.service';

describe('ApiService', () => {
  let service: ApiService;
  let httpMock: HttpTestingController;
  let tokenServiceSpy: jasmine.SpyObj<TokenService>;

  beforeEach(() => {
    tokenServiceSpy = jasmine.createSpyObj<TokenService>('TokenService', [
      'getAccessToken',
      'getRefreshToken',
    ]);

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        ApiService,
        { provide: TokenService, useValue: tokenServiceSpy },
      ],
    });

    service = TestBed.inject(ApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should call the signin endpoint during login', () => {
    const response = {
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    };

    service.login({ username: 'yassine', password: 'secret' }).subscribe((result) => {
      expect(result).toEqual(response);
    });

    const request = httpMock.expectOne(`${environment.authServiceUrl}/api/auth/signin`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ username: 'yassine', password: 'secret' });
    request.flush(response);
  });

  it('should send the refresh token as a bearer token', () => {
    tokenServiceSpy.getRefreshToken.and.returnValue('refresh-token');

    service.refreshAccessToken().subscribe();

    const request = httpMock.expectOne(`${environment.authServiceUrl}/api/auth/refresh`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({});
    expect(request.request.headers.get('Authorization')).toBe('Bearer refresh-token');
    request.flush({ accessToken: 'new-access', refreshToken: 'refresh-token' });
  });

  it('should attach auth headers to generic GET requests', () => {
    tokenServiceSpy.getAccessToken.and.returnValue('access-token');

    service.get('/api/core/profile').subscribe();

    const request = httpMock.expectOne(`${environment.apiGatewayUrl}/api/core/profile`);
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('Authorization')).toBe('Bearer access-token');
    expect(request.request.headers.get('Content-Type')).toBe('application/json');
    request.flush({});
  });

  it('should avoid forcing the Content-Type header for form-data uploads', () => {
    const formData = new FormData();

    tokenServiceSpy.getAccessToken.and.returnValue('access-token');
    formData.append('file', new Blob(['demo']), 'demo.txt');

    service.postFormData('/api/files', formData).subscribe();

    const request = httpMock.expectOne(`${environment.apiGatewayUrl}/api/files`);
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('Authorization')).toBe('Bearer access-token');
    expect(request.request.headers.has('Content-Type')).toBeFalse();
    request.flush({});
  });

  it('should encode place identifiers before calling the detail endpoint', () => {
    const placeId = 'place id/ete';

    service.getPlaceById(placeId).subscribe();

    const request = httpMock.expectOne(
      `${environment.apiGatewayUrl}/api/morocco-ai/places/by-place-id/${encodeURIComponent(placeId)}`
    );
    expect(request.request.method).toBe('GET');
    request.flush({});
  });

  it('should expose backend validation errors to the caller', () => {
    const consoleSpy = spyOn(console, 'error');

    service.signup({
      username: 'yassine',
      email: 'yassine@example.com',
      password: 'secret',
    }).subscribe({
      next: () => fail('The signup request should fail'),
      error: (error) => {
        expect(error).toEqual({ message: 'Email deja utilise' });
      },
    });

    const request = httpMock.expectOne(`${environment.authServiceUrl}/api/auth/signup`);
    request.flush(
      { message: 'Email deja utilise' },
      { status: 400, statusText: 'Bad Request' }
    );

    expect(consoleSpy).toHaveBeenCalled();
  });
});
