import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { Place } from '../data/tourism.data';
import { ApiService } from './api.service';
import { FavoritesService } from './favorites.service';
import { PlaceCatalogService } from './place-catalog.service';
import { TokenService } from './token.service';

describe('FavoritesService', () => {
  let service: FavoritesService;
  let apiServiceSpy: jasmine.SpyObj<ApiService>;
  let tokenServiceSpy: jasmine.SpyObj<TokenService>;
  let placeCatalogServiceSpy: jasmine.SpyObj<PlaceCatalogService>;

  function createPlace(overrides: Partial<Place> = {}): Place {
    return {
      id: 'place-1',
      name: 'Kasbah Oudayas',
      location: 'Rabat',
      rating: 4.2,
      reviewsLabel: 'Rabat',
      reviewsCount: 100,
      category: 'Culture',
      badge: 'Rabat',
      theme: 'theme-rabat',
      icon: 'business-outline',
      spotlight: 'Un monument historique.',
      shortDescription: 'Un monument historique.',
      longDescription: 'Un monument historique remarquable de Rabat.',
      address: 'Kasbah, Rabat',
      hours: '09:00 - 18:00',
      starsLabel: '****',
      highlights: ['Culture', 'Histoire'],
      types: ['culture'],
      ...overrides,
    };
  }

  beforeEach(() => {
    apiServiceSpy = jasmine.createSpyObj<ApiService>('ApiService', [
      'getCurrentUserProfile', 'get', 'post', 'delete', 'getPlaceById',
    ]);
    tokenServiceSpy = jasmine.createSpyObj<TokenService>('TokenService', ['isAuthenticated']);
    placeCatalogServiceSpy = jasmine.createSpyObj<PlaceCatalogService>('PlaceCatalogService', ['getPlaces']);

    tokenServiceSpy.isAuthenticated.and.returnValue(false);

    TestBed.configureTestingModule({
      providers: [
        FavoritesService,
        { provide: ApiService, useValue: apiServiceSpy },
        { provide: TokenService, useValue: tokenServiceSpy },
        { provide: PlaceCatalogService, useValue: placeCatalogServiceSpy },
      ],
    });

    service = TestBed.inject(FavoritesService);
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should start with an empty favorites list', () => {
    expect(service.getSnapshot()).toEqual([]);
    expect(service.isFavorite('place-1')).toBeFalse();
  });

  it('should add a place to favorites on first toggle', () => {
    const place = createPlace();

    service.toggle(place);

    expect(service.isFavorite('place-1')).toBeTrue();
    expect(service.getSnapshot().length).toBe(1);
  });

  it('should remove a place from favorites on second toggle', () => {
    const place = createPlace();
    service.toggle(place);

    service.toggle(place);

    expect(service.isFavorite('place-1')).toBeFalse();
    expect(service.getSnapshot()).toEqual([]);
  });

  it('should prepend new favorites to the beginning of the list', () => {
    service.toggle(createPlace({ id: 'p1', name: 'Lieu A' }));
    service.toggle(createPlace({ id: 'p2', name: 'Lieu B' }));

    expect(service.getSnapshot()[0].id).toBe('p2');
    expect(service.getSnapshot()[1].id).toBe('p1');
  });

  it('should clear all favorites and reset the user state', () => {
    service.toggle(createPlace({ id: 'p1' }));
    service.toggle(createPlace({ id: 'p2' }));

    service.clearFavorites();

    expect(service.getSnapshot()).toEqual([]);
    expect(service.isFavorite('p1')).toBeFalse();
  });

  it('should emit the updated list through favorites$', (done) => {
    const place = createPlace();
    const emissions: Place[][] = [];

    service.favorites$.subscribe((favorites) => {
      emissions.push([...favorites]);
      if (emissions.length === 2) {
        expect(emissions[0]).toEqual([]);
        expect(emissions[1][0].id).toBe('place-1');
        done();
      }
    });

    service.toggle(place);
  });

  it('should toggle multiple distinct places independently', () => {
    const p1 = createPlace({ id: 'p1' });
    const p2 = createPlace({ id: 'p2' });
    const p3 = createPlace({ id: 'p3' });

    service.toggle(p1);
    service.toggle(p2);
    service.toggle(p3);
    service.toggle(p2);

    expect(service.isFavorite('p1')).toBeTrue();
    expect(service.isFavorite('p2')).toBeFalse();
    expect(service.isFavorite('p3')).toBeTrue();
    expect(service.getSnapshot().length).toBe(2);
  });
});
