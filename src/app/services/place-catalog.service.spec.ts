import { of, throwError } from 'rxjs';

import { Place } from '../data/tourism.data';
import { ApiService } from './api.service';
import { PlaceCatalogService } from './place-catalog.service';

describe('PlaceCatalogService', () => {
  let service: PlaceCatalogService;
  let apiServiceSpy: jasmine.SpyObj<ApiService>;

  beforeEach(() => {
    apiServiceSpy = jasmine.createSpyObj<ApiService>('ApiService', ['getPlaces', 'getPlaceById']);
    service = new PlaceCatalogService(apiServiceSpy);
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  function createPlace(overrides: Partial<Place> = {}): Place {
    return {
      id: 'place-1',
      name: 'Cafe Medina',
      location: 'Fes',
      rating: 4.4,
      reviewsLabel: 'Fes',
      reviewsCount: 120,
      category: 'Cafe',
      badge: 'Fes',
      theme: 'theme-rabat',
      icon: 'cafe-outline',
      spotlight: 'Une adresse locale a tester.',
      shortDescription: 'Une adresse locale a tester.',
      longDescription: 'Une adresse locale a tester pour vos sorties.',
      address: 'Ancienne Medina, Fes',
      hours: '09:00 - 22:00',
      starsLabel: '****',
      highlights: ['Cafe', 'Fes', 'Ancienne Medina'],
      types: ['cafe'],
      ...overrides,
    };
  }

  it('should normalize places returned by the API', () => {
    apiServiceSpy.getPlaces.and.returnValue(of({
      data: {
        results: [
          {
            place_id: 'beach-1',
            name: 'Plage Rouge',
            city: 'agadir',
            rating: '4.6',
            types: ['beach', 'point_of_interest'],
            description: 'Une plage magnifique pour se promener.',
            address: 'Corniche, Agadir',
            latitude: 30.42,
            longitude: -9.6,
          },
        ],
      },
    }));

    service.getPlaces().subscribe((places: Place[]) => {
      expect(places.length).toBe(1);
      expect(places[0].id).toBe('beach-1');
      expect(places[0].location).toBe('Agadir');
      expect(places[0].category).toBe('Beach');
      expect(places[0].theme).toBe('theme-agadir');
      expect(places[0].icon).toBe('water-outline');
      expect(places[0].googleMapsUrl).toBe('https://www.google.com/maps/search/?api=1&query=30.42,-9.6');
    });
  });

  it('should return an empty array when the places endpoint fails', () => {
    apiServiceSpy.getPlaces.and.returnValue(throwError(() => new Error('API down')));

    service.getPlaces().subscribe((places: Place[]) => {
      expect(places).toEqual([]);
    });
  });

  it('should return null for blank identifiers without calling the API', () => {
    service.getPlaceById('   ').subscribe((place: Place | null) => {
      expect(place).toBeNull();
    });

    expect(apiServiceSpy.getPlaceById).not.toHaveBeenCalled();
  });

  it('should fall back to the catalog when the place detail request fails', () => {
    apiServiceSpy.getPlaceById.and.returnValue(throwError(() => new Error('Not found')));
    apiServiceSpy.getPlaces.and.returnValue(of([
      {
        place_id: 'kasbah-1',
        name: 'Kasbah',
        city: 'essaouira',
        category: 'culture',
        description: 'Un lieu historique tres connu.',
      },
    ]));

    service.getPlaceById(' kasbah-1 ').subscribe((place: Place | null) => {
      expect(apiServiceSpy.getPlaceById).toHaveBeenCalledWith('kasbah-1');
      expect(place?.id).toBe('kasbah-1');
      expect(place?.location).toBe('Essaouira');
    });
  });

  it('should filter places with accent-insensitive comparisons', () => {
    const places = [
      createPlace({ id: '1', location: 'Fes', category: 'Cafe', types: ['cafe'] }),
      createPlace({ id: '2', name: 'Plage Bahia', location: 'Agadir', category: 'Plage', types: ['beach'] }),
    ];

    expect(service.filterPlaces(places, 'Tout')).toEqual(places);
    expect(service.filterPlaces(places, 'plage')).toEqual([places[1]]);
    expect(service.filterPlaces(places, 'fes')).toEqual([places[0]]);
  });

  it('should store recent visits without duplicates and keep only 12 ids', () => {
    localStorage.setItem('recentPlaceIds', JSON.stringify([
      '1', '2', '3', '4', '5', '6',
      '7', '8', '9', '10', '11', '12',
    ]));

    service.trackPlaceVisit(' 3 ');

    const storedIds = JSON.parse(localStorage.getItem('recentPlaceIds') ?? '[]') as string[];

    expect(storedIds[0]).toBe('3');
    expect(storedIds.length).toBe(12);
    expect(storedIds.filter((id: string) => id === '3').length).toBe(1);
  });

  it('should build map markers with coordinates kept inside the allowed bounds', () => {
    const markers = service.buildMarkers([
      createPlace({ id: '1', latitude: 33.57, longitude: -7.59 }),
      createPlace({ id: '2', latitude: 35.17, longitude: -5.26 }),
    ]);

    expect(markers.length).toBe(2);
    markers.forEach((marker) => {
      expect(marker.top).toBeGreaterThanOrEqual(12);
      expect(marker.top).toBeLessThanOrEqual(82);
      expect(marker.left).toBeGreaterThanOrEqual(12);
      expect(marker.left).toBeLessThanOrEqual(86);
    });
  });
});
