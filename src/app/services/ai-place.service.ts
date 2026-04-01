import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map, switchMap, take } from 'rxjs/operators';
import { AiPlaceSearchResult } from '../models/ai-place.model';
import { Place } from '../data/tourism.data';
import { ApiService } from './api.service';
import { PlaceCatalogService } from './place-catalog.service';

@Injectable({
  providedIn: 'root'
})
export class AiPlaceService {
  constructor(
    private apiService: ApiService,
    private placeCatalogService: PlaceCatalogService
  ) {}

  searchPlaces(query: string): Observable<AiPlaceSearchResult[]> {
    const normalizedQuery = query.trim();

    if (!normalizedQuery) {
      return of([]);
    }

    const payload = {
      query: normalizedQuery,
      question: normalizedQuery,
    };

    const attempts = [
      () => this.apiService.post('/api/ai/search', payload),
      () => this.apiService.get(`/api/ai/search?query=${encodeURIComponent(normalizedQuery)}`),
    ];

    return this.placeCatalogService.getPlaces().pipe(
      take(1),
      switchMap((places: Place[]) => this.tryRequest(attempts).pipe(
        map((response: unknown) => {
          const aiResults = this.normalizeResponse(response, places);
          return aiResults.length > 0 ? aiResults : this.buildFallbackResults(normalizedQuery, places);
        }),
        catchError(() => of(this.buildFallbackResults(normalizedQuery, places)))
      ))
    );
  }

  private tryRequest(attempts: Array<() => Observable<unknown>>, index = 0): Observable<unknown> {
    if (index >= attempts.length) {
      return throwError(() => new Error('Aucun endpoint ai-place-service disponible.'));
    }

    return attempts[index]().pipe(
      catchError(() => this.tryRequest(attempts, index + 1))
    );
  }

  private normalizeResponse(response: unknown, places: Place[]): AiPlaceSearchResult[] {
    const rawResults = this.extractResultArray(response);

    return rawResults
      .map((item: unknown, index: number) => this.normalizeItem(item, index, places))
      .filter((item): item is AiPlaceSearchResult => item !== null)
      .slice(0, 6);
  }

  private extractResultArray(response: unknown): unknown[] {
    if (Array.isArray(response)) {
      return response;
    }

    if (!response || typeof response !== 'object') {
      return [];
    }

    const data = response as Record<string, unknown>;
    const candidateArrays = [
      data['results'],
      data['places'],
      data['recommendations'],
      data['data'],
      data['items'],
    ];

    return candidateArrays.find(Array.isArray) as unknown[] ?? [];
  }

  private normalizeItem(item: unknown, index: number, places: Place[]): AiPlaceSearchResult | null {
    if (!item || typeof item !== 'object') {
      return null;
    }

    const record = item as Record<string, unknown>;
    const name = this.pickString(record, ['name', 'placeName', 'title']);

    if (!name) {
      return null;
    }

    const location = this.pickString(record, ['location', 'city', 'address']) || 'Maroc';
    const category = this.pickString(record, ['category', 'type', 'tag']) || 'Suggestion';
    const description = this.pickString(record, ['description', 'reason', 'summary', 'recommendation', 'shortDescription'])
      || 'Suggestion trouvee par ai-place-service selon votre besoin.';
    const rating = this.pickNumber(record, ['rating', 'score']);
    const imageUrl = this.pickString(record, ['photo_url', 'photoUrl', 'imageUrl', 'image', 'thumbnail']);
    const externalId = this.pickIdentifier(record, ['place_id', 'placeId', 'id']);
    const routeMatch = this.findLocalMatch(externalId, name, location, category, places);
    const visualTheme = routeMatch?.theme || this.pickTheme(category, location, name);
    const visualBadge = routeMatch?.badge || category;
    const visualIcon = routeMatch?.icon || this.pickIcon(category);

    return {
      id: externalId || routeMatch?.id || `ai-place-${index}`,
      name,
      location,
      category,
      description,
      rating,
      imageUrl,
      reviewsLabel: routeMatch?.reviewsLabel,
      routeId: routeMatch?.id || externalId,
      theme: visualTheme,
      visualBadge,
      visualIcon,
      source: 'ai',
    };
  }

  private buildFallbackResults(query: string, places: Place[]): AiPlaceSearchResult[] {
    const normalizedTerms = this.normalizeText(query)
      .split(' ')
      .filter((term) => term.length > 1);

    return places
      .map((place: Place) => ({
        place,
        score: this.scorePlace(place, normalizedTerms),
      }))
      .filter((item: { place: Place; score: number }) => item.score > 0)
      .sort((left: { place: Place; score: number }, right: { place: Place; score: number }) => right.score - left.score)
      .slice(0, 6)
      .map((item: { place: Place; score: number }) => ({
        place: item.place,
      }))
      .map(({ place }: { place: Place }) => ({
        id: place.id,
        name: place.name,
        location: place.location,
        category: place.category,
        description: `Resultat local proche de votre recherche: ${place.shortDescription}`,
        rating: place.rating,
        reviewsLabel: place.reviewsLabel,
        routeId: place.id,
        theme: place.theme,
        visualBadge: place.badge,
        visualIcon: place.icon,
        source: 'fallback' as const,
      }));
  }

  private scorePlace(place: Place, terms: string[]): number {
    const haystack = this.normalizeText([
      place.name,
      place.location,
      place.category,
      place.shortDescription,
      place.longDescription,
      ...place.highlights,
    ].join(' '));

    return terms.reduce((score, term) => score + (haystack.includes(term) ? 1 : 0), 0);
  }

  private findLocalMatch(
    placeId: string | undefined,
    name: string,
    location: string,
    category: string,
    places: Place[]
  ): Place | undefined {
    if (placeId) {
      const idMatch = places.find((place: Place) => place.id === placeId);

      if (idMatch) {
        return idMatch;
      }
    }

    const normalizedName = this.normalizeText(name);
    const normalizedLocation = this.normalizeText(location);
    const normalizedCategory = this.normalizeText(category);

    return places.find((place: Place) => {
      const placeName = this.normalizeText(place.name);
      const placeLocation = this.normalizeText(place.location);
      const placeCategory = this.normalizeText(place.category);

      return placeName.includes(normalizedName)
        || normalizedName.includes(placeName)
        || placeLocation.includes(normalizedLocation)
        || normalizedLocation.includes(placeLocation)
        || placeCategory === normalizedCategory;
    });
  }

  private pickString(record: Record<string, unknown>, keys: string[]): string | undefined {
    const value = keys
      .map((key) => record[key])
      .find((candidate) => typeof candidate === 'string' && candidate.trim().length > 0);

    return typeof value === 'string' ? value.trim() : undefined;
  }

  private pickIdentifier(record: Record<string, unknown>, keys: string[]): string | undefined {
    const value = keys
      .map((key) => record[key])
      .find((candidate) => typeof candidate === 'string' || typeof candidate === 'number');

    if (typeof value === 'number') {
      return String(value);
    }

    return typeof value === 'string' ? value.trim() : undefined;
  }

  private pickNumber(record: Record<string, unknown>, keys: string[]): number | undefined {
    const value = keys
      .map((key) => record[key])
      .find((candidate) => typeof candidate === 'number' || typeof candidate === 'string');

    if (typeof value === 'number') {
      return value;
    }

    if (typeof value === 'string') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : undefined;
    }

    return undefined;
  }

  private pickTheme(category: string, location: string, name: string): string {
    const text = this.normalizeText(`${category} ${location} ${name}`);

    if (text.includes('plage') || text.includes('ocean') || text.includes('beach')) {
      return 'theme-agadir';
    }

    if (text.includes('chefchaouen')) {
      return 'theme-chefchaouen';
    }

    if (text.includes('marrakech')) {
      return 'theme-marrakech';
    }

    if (text.includes('zoo') || text.includes('famille') || text.includes('animal')) {
      return 'theme-zoo';
    }

    return 'theme-rabat';
  }

  private pickIcon(category: string): string {
    const text = this.normalizeText(category);

    if (text.includes('plage') || text.includes('ocean')) {
      return 'water-outline';
    }

    if (text.includes('cafe')) {
      return 'cafe-outline';
    }

    if (text.includes('restaurant')) {
      return 'restaurant-outline';
    }

    if (text.includes('famille') || text.includes('zoo')) {
      return 'paw-outline';
    }

    if (text.includes('culture')) {
      return 'business-outline';
    }

    return 'sparkles-outline';
  }

  private normalizeText(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }
}
