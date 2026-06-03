import { of, throwError } from 'rxjs';

import { Place } from '../data/tourism.data';
import { AiPlaceSearchExperience } from '../models/ai-place.model';
import { ApiService } from './api.service';
import { AiPlaceService } from './ai-place.service';
import { ImageProxyService } from './image-proxy.service';
import { PlaceCatalogService } from './place-catalog.service';
import { TokenService } from './token.service';

describe('AiPlaceService', () => {
  let service: AiPlaceService;
  let apiServiceSpy: jasmine.SpyObj<ApiService>;
  let imageProxyServiceSpy: jasmine.SpyObj<ImageProxyService>;
  let placeCatalogServiceSpy: jasmine.SpyObj<PlaceCatalogService>;
  let tokenServiceSpy: jasmine.SpyObj<TokenService>;

  beforeEach(() => {
    apiServiceSpy = jasmine.createSpyObj<ApiService>('ApiService', ['post', 'get', 'postFormData']);
    imageProxyServiceSpy = jasmine.createSpyObj<ImageProxyService>('ImageProxyService', ['getImageUrl']);
    placeCatalogServiceSpy = jasmine.createSpyObj<PlaceCatalogService>('PlaceCatalogService', ['getPlaces', 'buildFallbackImageUrl']);
    tokenServiceSpy = jasmine.createSpyObj<TokenService>('TokenService', ['getAccessToken']);
    imageProxyServiceSpy.getImageUrl.and.callFake((url: string | undefined) => url);
    placeCatalogServiceSpy.buildFallbackImageUrl.and.returnValue('https://picsum.photos/seed/morocco/600/400');
    tokenServiceSpy.getAccessToken.and.returnValue('token');
    service = new AiPlaceService(apiServiceSpy, imageProxyServiceSpy, placeCatalogServiceSpy, tokenServiceSpy);
  });

  function createPlace(overrides: Partial<Place> = {}): Place {
    return {
      id: 'place-1',
      name: 'Plage Bahia',
      location: 'Agadir',
      rating: 4.8,
      reviewsLabel: 'Agadir',
      reviewsCount: 200,
      category: 'Plage',
      badge: 'Agadir',
      theme: 'theme-agadir',
      icon: 'water-outline',
      spotlight: 'Une plage tres populaire.',
      shortDescription: 'Une plage tres populaire.',
      longDescription: 'Une plage tres populaire pour les voyageurs.',
      address: 'Corniche, Agadir',
      hours: '08:00 - 20:00',
      starsLabel: '*****',
      highlights: ['Plage', 'Agadir', 'Ocean'],
      imageUrl: 'https://example.com/plage.jpg',
      googleMapsUrl: 'https://maps.example.com/plage',
      latitude: 30.42,
      longitude: -9.6,
      types: ['beach'],
      ...overrides,
    };
  }

  it('should return an empty experience for blank queries', () => {
    service.search('   ').subscribe((experience: AiPlaceSearchExperience) => {
      expect(experience.results).toEqual([]);
      expect(experience.source).toBe('ai');
      expect(experience.resultsCount).toBe(0);
    });

    expect(placeCatalogServiceSpy.getPlaces).not.toHaveBeenCalled();
    expect(apiServiceSpy.post).not.toHaveBeenCalled();
    expect(apiServiceSpy.get).not.toHaveBeenCalled();
  });

  it('should retry the next AI endpoint after a retriable error', () => {
    const localPlace = createPlace();

    placeCatalogServiceSpy.getPlaces.and.returnValue(of([localPlace]));
    apiServiceSpy.post.and.callFake((endpoint: string) => {
      if (endpoint === '/api/morocco-ai/search') {
        return throwError(() => ({ status: 500 }));
      }

      return of({
        assistant_reply: 'Voici une suggestion',
        results: [
          {
            id: 'place-1',
            name: 'Plage Bahia',
            location: 'Agadir',
            category: 'Plage',
            description: 'Parfait pour une balade.',
            rating: 4.9,
          },
        ],
      });
    });

    service.search('plage agadir').subscribe((experience: AiPlaceSearchExperience) => {
      expect(apiServiceSpy.post).toHaveBeenCalledTimes(2);
      expect(experience.source).toBe('ai');
      expect(experience.resultsCount).toBe(1);
      expect(experience.results[0].routeId).toBe(localPlace.id);
      expect(experience.results[0].theme).toBe(localPlace.theme);
      expect(experience.results[0].visualBadge).toBe(localPlace.badge);
      expect(experience.results[0].visualIcon).toBe(localPlace.icon);
    });
  });

  it('should keep up to ten AI results when the backend sends result_limit 10', () => {
    placeCatalogServiceSpy.getPlaces.and.returnValue(of([]));
    apiServiceSpy.post.and.returnValue(of({
      result_limit: 10,
      results_count: 10,
      results: Array.from({ length: 10 }, (_, index: number) => ({
        id: `cafe-${index + 1}`,
        name: `Cafe ${index + 1}`,
        location: 'Rabat',
        category: 'Cafe',
        description: `Suggestion ${index + 1}`,
      })),
    }));

    service.search('cafe rabat').subscribe((experience: AiPlaceSearchExperience) => {
      expect(experience.results.length).toBe(10);
      expect(experience.resultsCount).toBe(10);
      expect(experience.results[9].name).toBe('Cafe 10');
    });
  });

  it('should fall back to the local catalog when every AI endpoint fails', () => {
    const localPlace = createPlace({
      id: 'riad-1',
      name: 'Riad Atlas',
      location: 'Marrakech',
      category: 'Hebergement',
      theme: 'theme-marrakech',
      icon: 'bed-outline',
      badge: 'Marrakech',
      shortDescription: 'Un riad calme au coeur de la medina.',
      longDescription: 'Un riad calme au coeur de la medina de Marrakech.',
      highlights: ['Riad', 'Marrakech', 'Medina'],
    });

    placeCatalogServiceSpy.getPlaces.and.returnValue(of([localPlace]));
    apiServiceSpy.post.and.returnValue(throwError(() => ({ status: 500 })));
    apiServiceSpy.get.and.returnValue(throwError(() => ({ status: 500 })));

    service.search('riad marrakech').subscribe((experience: AiPlaceSearchExperience) => {
      expect(experience.source).toBe('fallback');
      expect(experience.resultsCount).toBe(1);
      expect(experience.results[0].id).toBe('riad-1');
      expect(experience.results[0].routeId).toBe('riad-1');
      expect(experience.results[0].source).toBe('fallback');
    });
  });

  it('should expose only the result list through searchPlaces', () => {
    spyOn(service, 'search').and.returnValue(of({
      results: [
        {
          id: 'place-1',
          name: 'Plage Bahia',
          location: 'Agadir',
          category: 'Plage',
          description: 'Une suggestion.',
          source: 'ai',
        },
      ],
      source: 'ai',
      resultsCount: 1,
      suggestedQuestions: [],
      guideCards: [],
    }));

    service.searchPlaces('plage').subscribe((results) => {
      expect(results.length).toBe(1);
      expect(results[0].name).toBe('Plage Bahia');
    });
  });

  it('should map itinerary guide card metadata', () => {
    placeCatalogServiceSpy.getPlaces.and.returnValue(of([]));

    apiServiceSpy.post.and.returnValue(of({
      assistant_reply: 'Voici un plan',
      results: [
        {
          id: 'p1',
          name: 'Stop 1',
          location: 'Rabat',
          category: 'restaurant',
          latitude: 33.95,
          longitude: -6.86,
        },
      ],
      guide_cards: [
        {
          title: 'Stop 1',
          description: 'Adresse: ...',
          query: 'Stop 1',
          time_slot: 'Matin',
          duration_minutes: 90,
          budget_min_mad: 80,
          budget_max_mad: 250,
        },
      ],
    }));

    service.search('itineraire rabat').subscribe((experience: AiPlaceSearchExperience) => {
      expect(experience.source).toBe('ai');
      expect(experience.guideCards.length).toBe(1);
      expect(experience.guideCards[0].timeSlot).toBe('Matin');
      expect(experience.guideCards[0].durationMinutes).toBe(90);
      expect(experience.guideCards[0].budgetMinMad).toBe(80);
      expect(experience.guideCards[0].budgetMaxMad).toBe(250);
    });
  });

  it('should preserve user coordinates when retrying GET search endpoints', () => {
    const localPlace = createPlace({
      id: 'rabat-cafe',
      name: 'Cafe Rabat',
      location: 'Rabat',
      category: 'Cafe',
      theme: 'theme-rabat',
      icon: 'cafe-outline',
      badge: 'Rabat',
      latitude: 33.95,
      longitude: -6.86,
    });

    placeCatalogServiceSpy.getPlaces.and.returnValue(of([localPlace]));
    apiServiceSpy.post.and.returnValue(throwError(() => ({ status: 404 })));
    apiServiceSpy.get.and.returnValue(of({
      results: [
        {
          id: 'rabat-cafe',
          name: 'Cafe Rabat',
          location: 'Rabat',
          category: 'Cafe',
        },
      ],
    }));

    service.search('drink rabat', {
      userLatitude: 33.95,
      userLongitude: -6.86,
    }).subscribe((experience: AiPlaceSearchExperience) => {
      expect(apiServiceSpy.get).toHaveBeenCalledTimes(1);
      expect(experience.source).toBe('ai');
      expect(experience.results[0].routeId).toBe('rabat-cafe');
    });

    const getEndpoint = apiServiceSpy.get.calls.first().args[0] as string;
    expect(getEndpoint).toContain('/api/morocco-ai/search?');
    expect(getEndpoint).toContain('user_latitude=33.95');
    expect(getEndpoint).toContain('user_longitude=-6.86');
  });

  it('should add a nearby hint for generic searches when coordinates are available', () => {
    placeCatalogServiceSpy.getPlaces.and.returnValue(of([]));
    apiServiceSpy.post.and.returnValue(of({
      results: [
        {
          id: 'nearby-spa',
          name: 'Nearby Spa',
          location: 'Rabat',
          category: 'Spa',
          latitude: 33.95,
          longitude: -6.86,
        },
      ],
    }));

    service.search('spa relaxant', {
      userLatitude: 33.95,
      userLongitude: -6.86,
    }).subscribe();

    const firstPayload = apiServiceSpy.post.calls.first().args[1] as Record<string, unknown>;
    expect(firstPayload['query']).toBe('spa relaxant pres de moi');
    expect(firstPayload['question']).toBe('spa relaxant pres de moi');
  });

  it('should sort location-specific AI results by distance and expose a position note', () => {
    placeCatalogServiceSpy.getPlaces.and.returnValue(of([]));
    apiServiceSpy.post.and.returnValue(of({
      assistant_reply: 'Classement distant',
      near_me: false,
      results: [
        {
          id: 'far-spa',
          name: 'Far Spa',
          location: 'Rabat',
          category: 'Spa',
          latitude: 34.02,
          longitude: -6.82,
        },
        {
          id: 'near-spa',
          name: 'Near Spa',
          location: 'Rabat',
          category: 'Spa',
          latitude: 33.951,
          longitude: -6.865,
        },
      ],
    }));

    service.search('spa rabat', {
      userLatitude: 33.95,
      userLongitude: -6.86,
    }).subscribe((experience: AiPlaceSearchExperience) => {
      expect(experience.results[0].id).toBe('near-spa');
      expect(experience.results[0].distanceKm).toBeDefined();
      expect(experience.positionNote).toContain('position actuelle');
      expect(experience.assistantReply).toContain('Near Spa');
    });
  });

  it('should stop retrying AI endpoints after a network timeout-style error', () => {
    const localPlace = createPlace({
      id: 'local-spa',
      name: 'Local Spa',
      location: 'Rabat',
      category: 'Spa',
      latitude: 33.951,
      longitude: -6.865,
    });

    placeCatalogServiceSpy.getPlaces.and.returnValue(of([localPlace]));
    apiServiceSpy.post.and.returnValue(throwError(() => ({ status: 0 })));

    service.search('spa rabat', {
      userLatitude: 33.95,
      userLongitude: -6.86,
    }).subscribe((experience: AiPlaceSearchExperience) => {
      expect(experience.source).toBe('fallback');
      expect(experience.results[0].id).toBe('local-spa');
    });

    expect(apiServiceSpy.post).toHaveBeenCalledTimes(1);
    expect(apiServiceSpy.get).not.toHaveBeenCalled();
  });

  it('should prioritize nearby local places in fallback mode when coordinates are available', () => {
    const nearbyPlace = createPlace({
      id: 'nearby-cafe',
      name: 'Cafe Oudayas',
      location: 'Rabat',
      category: 'Cafe',
      theme: 'theme-rabat',
      icon: 'cafe-outline',
      badge: 'Rabat',
      latitude: 33.951,
      longitude: -6.865,
    });
    const farPlace = createPlace({
      id: 'far-cafe',
      name: 'Cafe Marina',
      location: 'Casablanca',
      category: 'Cafe',
      theme: 'theme-rabat',
      icon: 'cafe-outline',
      badge: 'Casablanca',
      latitude: 33.573,
      longitude: -7.589,
    });

    placeCatalogServiceSpy.getPlaces.and.returnValue(of([farPlace, nearbyPlace]));
    apiServiceSpy.post.and.returnValue(throwError(() => ({ status: 500 })));
    apiServiceSpy.get.and.returnValue(throwError(() => ({ status: 500 })));

    service.search('drink', {
      userLatitude: 33.95,
      userLongitude: -6.86,
    }).subscribe((experience: AiPlaceSearchExperience) => {
      expect(experience.source).toBe('fallback');
      expect(experience.resultsCount).toBe(2);
      expect(experience.results[0].id).toBe('nearby-cafe');
      expect(experience.results[1].id).toBe('far-cafe');
    });
  });

  it('should build form-data for audio search and retry on a 404 response', () => {
    const localPlace = createPlace({
      id: 'blue-city',
      name: 'Blue Medina',
      location: 'Chefchaouen',
      category: 'Culture',
      theme: 'theme-chefchaouen',
      icon: 'business-outline',
      badge: 'Chefchaouen',
    });
    const payloads: FormData[] = [];
    const audio = new Blob(['voice sample'], { type: 'audio/mpeg' });

    placeCatalogServiceSpy.getPlaces.and.returnValue(of([localPlace]));
    apiServiceSpy.postFormData.and.callFake((endpoint: string, payload: FormData) => {
      payloads.push(payload);

      if (endpoint === '/api/morocco-ai/search/audio') {
        return throwError(() => ({ status: 404 }));
      }

      return of({
        input_mode: 'audio',
        detected_language: 'fr',
        results: [
          {
            placeId: 'blue-city',
            name: 'Blue Medina',
            location: 'Chefchaouen',
            category: 'Culture',
          },
        ],
      });
    });

    service.searchFromAudio(audio, {
      language: 'FR-MA',
      userLatitude: 35.17,
      userLongitude: -5.26,
    }).subscribe((experience: AiPlaceSearchExperience) => {
      const firstPayload = payloads[0];
      const audioEntry = firstPayload.get('audio') as File;

      expect(apiServiceSpy.postFormData).toHaveBeenCalledTimes(2);
      expect(firstPayload.get('language')).toBe('fr');
      expect(firstPayload.get('user_latitude')).toBe('35.17');
      expect(firstPayload.get('user_longitude')).toBe('-5.26');
      expect(audioEntry.name.endsWith('.mp3')).toBeTrue();
      expect(experience.inputMode).toBe('audio');
      expect(experience.detectedLanguage).toBe('fr');
      expect(experience.results[0].routeId).toBe('blue-city');
    });
  });
});
