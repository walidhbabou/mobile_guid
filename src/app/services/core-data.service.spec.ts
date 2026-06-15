import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { Place } from '../data/tourism.data';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { CoreDataService } from './core-data.service';
import { PlaceCatalogService } from './place-catalog.service';

describe('CoreDataService', () => {
  let service: CoreDataService;
  let apiServiceSpy: jasmine.SpyObj<ApiService>;
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let placeCatalogServiceSpy: jasmine.SpyObj<PlaceCatalogService>;

  function createPlace(overrides: Partial<Place> = {}): Place {
    return {
      id: 'place-1',
      name: 'Musee Batha',
      location: 'Fes',
      rating: 4.5,
      reviewsLabel: 'Fes',
      reviewsCount: 80,
      category: 'Culture',
      badge: 'Fes',
      theme: 'theme-fes',
      icon: 'business-outline',
      spotlight: 'Un musee remarquable.',
      shortDescription: 'Un musee remarquable.',
      longDescription: 'Un musee remarquable dans la medina de Fes.',
      address: 'Medina, Fes',
      hours: '09:00 - 17:00',
      starsLabel: '*****',
      highlights: ['Musee', 'Culture'],
      types: ['museum'],
      backendId: 42,
      ...overrides,
    };
  }

  beforeEach(() => {
    apiServiceSpy = jasmine.createSpyObj<ApiService>('ApiService', ['get', 'post', 'delete']);
    authServiceSpy = jasmine.createSpyObj<AuthService>('AuthService', [
      'isAuthenticated', 'resolveCurrentUserId', 'getStoredUserId',
    ]);
    placeCatalogServiceSpy = jasmine.createSpyObj<PlaceCatalogService>('PlaceCatalogService', ['getPlaces']);

    authServiceSpy.isAuthenticated.and.returnValue(false);
    authServiceSpy.getStoredUserId.and.returnValue(null);

    TestBed.configureTestingModule({
      providers: [
        CoreDataService,
        { provide: ApiService, useValue: apiServiceSpy },
        { provide: AuthService, useValue: authServiceSpy },
        { provide: PlaceCatalogService, useValue: placeCatalogServiceSpy },
      ],
    });

    service = TestBed.inject(CoreDataService);
  });

  describe('getCategoryLabels', () => {
    it('should return unique category labels from the catalog when not authenticated', () => {
      authServiceSpy.isAuthenticated.and.returnValue(false);
      placeCatalogServiceSpy.getPlaces.and.returnValue(of([
        createPlace({ id: 'p1', category: 'Culture' }),
        createPlace({ id: 'p2', category: 'Plage' }),
        createPlace({ id: 'p3', category: 'Culture' }),
      ]));

      service.getCategoryLabels().subscribe((labels: string[]) => {
        expect(labels).toContain('Culture');
        expect(labels).toContain('Plage');
        expect(labels.filter(l => l === 'Culture').length).toBe(1);
      });
    });

    it('should respect the provided limit', () => {
      authServiceSpy.isAuthenticated.and.returnValue(false);
      placeCatalogServiceSpy.getPlaces.and.returnValue(of([
        createPlace({ id: 'p1', category: 'A' }),
        createPlace({ id: 'p2', category: 'B' }),
        createPlace({ id: 'p3', category: 'C' }),
        createPlace({ id: 'p4', category: 'D' }),
      ]));

      service.getCategoryLabels(2).subscribe((labels: string[]) => {
        expect(labels.length).toBeLessThanOrEqual(2);
      });
    });
  });

  describe('getPlaceReviews', () => {
    it('should return an empty list when the user is not authenticated', () => {
      service.getPlaceReviews(42).subscribe((reviews) => {
        expect(reviews).toEqual([]);
      });
    });

    it('should return an empty list for a falsy place identifier', () => {
      authServiceSpy.isAuthenticated.and.returnValue(true);

      service.getPlaceReviews(undefined).subscribe((reviews) => {
        expect(reviews).toEqual([]);
        expect(apiServiceSpy.get).not.toHaveBeenCalled();
      });
    });
  });

  describe('isFavoritePlace', () => {
    it('should return false for a place without a backend id', () => {
      service.isFavoritePlace(undefined).subscribe((result) => {
        expect(result).toBeFalse();
      });
    });
  });

  describe('savePlaceReview', () => {
    it('should reject review submission for a place without a backend id', (done) => {
      const place = createPlace({ backendId: undefined });

      service.savePlaceReview(place, 4, 'Excellent endroit').subscribe({
        next: () => fail('Should not succeed'),
        error: (err: Error) => {
          expect(err.message).toContain('ne peut pas encore recevoir');
          done();
        },
      });
    });

    it('should reject an empty comment', (done) => {
      const place = createPlace();

      service.savePlaceReview(place, 4, '   ').subscribe({
        next: () => fail('Should not succeed'),
        error: (err: Error) => {
          expect(err.message).toContain('commentaire est obligatoire');
          done();
        },
      });
    });

    it('should reject a rating above 5', (done) => {
      const place = createPlace();

      service.savePlaceReview(place, 6, 'Super lieu').subscribe({
        next: () => fail('Should not succeed'),
        error: (err: Error) => {
          expect(err.message).toContain('note doit etre comprise');
          done();
        },
      });
    });

    it('should reject a rating below 1', (done) => {
      const place = createPlace();

      service.savePlaceReview(place, 0, 'Super lieu').subscribe({
        next: () => fail('Should not succeed'),
        error: (err: Error) => {
          expect(err.message).toContain('note doit etre comprise');
          done();
        },
      });
    });
  });

  describe('toggleFavorite', () => {
    it('should reject toggle for a place without a backend id', (done) => {
      const place = createPlace({ backendId: undefined });

      service.toggleFavorite(place).subscribe({
        next: () => fail('Should not succeed'),
        error: (err: Error) => {
          expect(err.message).toContain('Ce lieu n est pas encore disponible');
          done();
        },
      });
    });
  });

  describe('recordPlaceVisit', () => {
    it('should return null when the place has no backend id', () => {
      const place = createPlace({ backendId: undefined });

      service.recordPlaceVisit(place).subscribe((result) => {
        expect(result).toBeNull();
        expect(apiServiceSpy.post).not.toHaveBeenCalled();
      });
    });
  });
});
