import { of, throwError } from 'rxjs';

import { Place } from '../data/tourism.data';
import { AiPlaceSearchExperience } from '../models/ai-place.model';
import { ApiService } from './api.service';
import { AiPlaceService } from './ai-place.service';
import { PlaceCatalogService } from './place-catalog.service';

describe('AiPlaceService', () => {
  let service: AiPlaceService;
  let apiServiceSpy: jasmine.SpyObj<ApiService>;
  let placeCatalogServiceSpy: jasmine.SpyObj<PlaceCatalogService>;

  beforeEach(() => {
    apiServiceSpy = jasmine.createSpyObj<ApiService>('ApiService', ['post', 'get', 'postFormData']);
    placeCatalogServiceSpy = jasmine.createSpyObj<PlaceCatalogService>('PlaceCatalogService', ['getPlaces']);
    service = new AiPlaceService(apiServiceSpy, placeCatalogServiceSpy);
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
