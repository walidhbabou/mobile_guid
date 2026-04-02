import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map, switchMap, take } from 'rxjs/operators';
import { AiGuideCard, AiPlaceSearchExperience, AiPlaceSearchResult } from '../models/ai-place.model';
import { Place } from '../data/tourism.data';
import { ApiService } from './api.service';
import { PlaceCatalogService } from './place-catalog.service';

export interface AiSearchRequestOptions {
  userLatitude?: number;
  userLongitude?: number;
  language?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AiPlaceService {
  constructor(
    private apiService: ApiService,
    private placeCatalogService: PlaceCatalogService
  ) {}

  search(query: string, options: AiSearchRequestOptions = {}): Observable<AiPlaceSearchExperience> {
    const normalizedQuery = query.trim();

    if (!normalizedQuery) {
      return of(this.buildEmptyExperience());
    }

    const attempts = [
      () => this.apiService.post('/api/morocco-ai/search', this.buildTextPayload(normalizedQuery, options)),
      () => this.apiService.post('/api/ai/search', this.buildTextPayload(normalizedQuery, options)),
      () => this.apiService.get(`/api/ai/search?query=${encodeURIComponent(normalizedQuery)}`),
    ];

    return this.placeCatalogService.getPlaces().pipe(
      take(1),
      switchMap((places: Place[]) => this.tryRequest(attempts).pipe(
        map((response: unknown) => this.normalizeExperience(response, places, normalizedQuery)),
        catchError(() => of(this.buildFallbackExperience(normalizedQuery, places)))
      ))
    );
  }

  searchPlaces(query: string, options: AiSearchRequestOptions = {}): Observable<AiPlaceSearchResult[]> {
    return this.search(query, options).pipe(
      map((experience: AiPlaceSearchExperience) => experience.results)
    );
  }

  searchFromAudio(audio: Blob, options: AiSearchRequestOptions = {}): Observable<AiPlaceSearchExperience> {
    const normalizedLanguage = this.normalizeLanguage(options.language);
    const endpoints = [
      '/api/morocco-ai/search/audio',
      '/api/ai/search/audio',
    ];
    const attempts = endpoints.map((endpoint: string) => (
      () => this.apiService.postFormData(
        endpoint,
        this.buildAudioFormData(audio, options, normalizedLanguage)
      )
    ));

    return this.placeCatalogService.getPlaces().pipe(
      take(1),
      switchMap((places: Place[]) => this.tryRequest(attempts).pipe(
        map((response: unknown) => this.normalizeExperience(response, places)),
      ))
    );
  }

  private tryRequest(
    attempts: Array<() => Observable<unknown>>,
    index = 0,
    lastError?: unknown
  ): Observable<unknown> {
    if (index >= attempts.length) {
      return throwError(() => lastError ?? new Error('Aucun endpoint ai-place-service disponible.'));
    }

    return attempts[index]().pipe(
      catchError((error: unknown) => {
        if (!this.shouldRetryAttempt(error) || index === attempts.length - 1) {
          return throwError(() => error);
        }

        return this.tryRequest(attempts, index + 1, lastError ?? error);
      })
    );
  }

  private shouldRetryAttempt(error: unknown): boolean {
    if (!error || typeof error !== 'object' || !('status' in error)) {
      return true;
    }

    const status = (error as { status?: unknown }).status;

    if (typeof status !== 'number') {
      return true;
    }

    return status === 0 || status === 404 || status >= 500;
  }

  private normalizeExperience(
    response: unknown,
    places: Place[],
    fallbackQuery?: string
  ): AiPlaceSearchExperience {
    const records = this.collectResponseRecords(this.parseJsonResponse(response));
    const aiResults = this.extractResultArray(records)
      .map((item: unknown, index: number) => this.normalizeItem(item, index, places))
      .filter((item): item is AiPlaceSearchResult => item !== null)
      .slice(0, 6);

    if (aiResults.length > 0) {
      return {
        results: aiResults,
        source: 'ai',
        assistantReply: this.pickStringFromRecords(records, ['assistant_reply', 'assistantReply']),
        message: this.pickStringFromRecords(records, ['message']),
        inputMode: this.pickStringFromRecords(records, ['input_mode', 'inputMode']),
        responseMode: this.pickStringFromRecords(records, ['response_mode', 'responseMode']),
        detectedLanguage: this.pickStringFromRecords(records, ['detected_language', 'detectedLanguage']),
        transcribedQuery: this.pickStringFromRecords(records, ['transcribed_query', 'transcribedQuery']),
        audioFilename: this.pickStringFromRecords(records, ['audio_filename', 'audioFilename']),
        city: this.pickStringFromRecords(records, ['city']),
        category: this.pickStringFromRecords(records, ['category']),
        resultsCount: this.pickNumberFromRecords(records, ['results_count', 'resultsCount']) ?? aiResults.length,
        suggestedQuestions: this.pickStringArrayFromRecords(records, ['suggested_questions', 'suggestedQuestions']).slice(0, 6),
        guideCards: this.pickGuideCards(records).slice(0, 3),
      };
    }

    if (fallbackQuery) {
      return this.buildFallbackExperience(fallbackQuery, places, records);
    }

    return {
      ...this.buildEmptyExperience(),
      assistantReply: this.pickStringFromRecords(records, ['assistant_reply', 'assistantReply']),
      message: this.pickStringFromRecords(records, ['message']),
      inputMode: this.pickStringFromRecords(records, ['input_mode', 'inputMode']),
      responseMode: this.pickStringFromRecords(records, ['response_mode', 'responseMode']),
      detectedLanguage: this.pickStringFromRecords(records, ['detected_language', 'detectedLanguage']),
      transcribedQuery: this.pickStringFromRecords(records, ['transcribed_query', 'transcribedQuery']),
      audioFilename: this.pickStringFromRecords(records, ['audio_filename', 'audioFilename']),
      city: this.pickStringFromRecords(records, ['city']),
      category: this.pickStringFromRecords(records, ['category']),
      suggestedQuestions: this.pickStringArrayFromRecords(records, ['suggested_questions', 'suggestedQuestions']).slice(0, 6),
      guideCards: this.pickGuideCards(records).slice(0, 3),
    };
  }

  private extractResultArray(records: Record<string, unknown>[]): unknown[] {
    const candidates = records.reduce((items: unknown[], record: Record<string, unknown>) => {
      items.push(record['results'], record['places'], record['recommendations'], record['data'], record['items']);
      return items;
    }, []);
    const rawArray = candidates.find(Array.isArray);

    return Array.isArray(rawArray) ? rawArray : [];
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

    const address = this.pickString(record, ['address']);
    const location = this.pickString(record, ['location', 'city', 'address']) || 'Maroc';
    const category = this.pickString(record, ['category', 'type', 'tag']) || 'Suggestion';
    const description = this.pickString(record, ['description', 'reason', 'summary', 'recommendation', 'shortDescription'])
      || 'Suggestion trouvee par ai-place-service selon votre besoin.';
    const rating = this.pickNumber(record, ['rating', 'score']);
    const imageUrl = this.pickString(record, ['photo_url', 'photoUrl', 'imageUrl', 'image', 'thumbnail']);
    const latitude = this.pickNumber(record, ['latitude', 'lat']);
    const longitude = this.pickNumber(record, ['longitude', 'lng', 'lon']);
    const googleMapsUrl = this.pickString(record, ['google_maps_url', 'googleMapsUrl']);
    const types = this.pickStringArray(record, ['types']);
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
      address,
      rating,
      imageUrl,
      latitude,
      longitude,
      googleMapsUrl,
      types,
      reviewsLabel: routeMatch?.reviewsLabel,
      routeId: routeMatch?.id || externalId,
      theme: visualTheme,
      visualBadge,
      visualIcon,
      source: 'ai',
    };
  }

  private buildFallbackExperience(
    query: string,
    places: Place[],
    records: Record<string, unknown>[] = []
  ): AiPlaceSearchExperience {
    const fallbackResults = this.buildFallbackResults(query, places);

    return {
      results: fallbackResults,
      source: 'fallback',
      assistantReply: this.pickStringFromRecords(records, ['assistant_reply', 'assistantReply']),
      message: this.pickStringFromRecords(records, ['message']) || 'Suggestions locales proposees a partir du catalogue disponible.',
      inputMode: this.pickStringFromRecords(records, ['input_mode', 'inputMode']),
      responseMode: this.pickStringFromRecords(records, ['response_mode', 'responseMode']),
      detectedLanguage: this.pickStringFromRecords(records, ['detected_language', 'detectedLanguage']),
      transcribedQuery: this.pickStringFromRecords(records, ['transcribed_query', 'transcribedQuery']),
      audioFilename: this.pickStringFromRecords(records, ['audio_filename', 'audioFilename']),
      city: this.pickStringFromRecords(records, ['city']),
      category: this.pickStringFromRecords(records, ['category']),
      resultsCount: fallbackResults.length,
      suggestedQuestions: this.pickStringArrayFromRecords(records, ['suggested_questions', 'suggestedQuestions']).slice(0, 6),
      guideCards: this.pickGuideCards(records).slice(0, 3),
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
        address: place.address,
        rating: place.rating,
        imageUrl: place.imageUrl,
        latitude: place.latitude,
        longitude: place.longitude,
        googleMapsUrl: place.googleMapsUrl,
        types: place.types,
        reviewsLabel: place.reviewsLabel,
        routeId: place.id,
        theme: place.theme,
        visualBadge: place.badge,
        visualIcon: place.icon,
        source: 'fallback' as const,
      }));
  }

  private buildEmptyExperience(): AiPlaceSearchExperience {
    return {
      results: [],
      source: 'ai',
      resultsCount: 0,
      suggestedQuestions: [],
      guideCards: [],
    };
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

  private buildTextPayload(query: string, options: AiSearchRequestOptions): Record<string, unknown> {
    return {
      query,
      question: query,
      ...(typeof options.userLatitude === 'number' ? { user_latitude: options.userLatitude } : {}),
      ...(typeof options.userLongitude === 'number' ? { user_longitude: options.userLongitude } : {}),
    };
  }

  private buildAudioFormData(
    audio: Blob,
    options: AiSearchRequestOptions,
    normalizedLanguage?: string
  ): FormData {
    const formData = new FormData();
    const filename = `voice-query-${Date.now()}.${this.resolveAudioExtension(audio.type)}`;

    formData.append('audio', audio, filename);

    if (normalizedLanguage) {
      formData.append('language', normalizedLanguage);
    }

    if (typeof options.userLatitude === 'number') {
      formData.append('user_latitude', String(options.userLatitude));
    }

    if (typeof options.userLongitude === 'number') {
      formData.append('user_longitude', String(options.userLongitude));
    }

    return formData;
  }

  private normalizeLanguage(language?: string): string | undefined {
    const value = language?.trim();

    if (!value) {
      return undefined;
    }

    return value.split('-')[0]?.toLowerCase() || value.toLowerCase();
  }

  private resolveAudioExtension(mimeType?: string): string {
    const normalizedMimeType = mimeType?.split(';')[0]?.trim().toLowerCase();

    switch (normalizedMimeType) {
      case 'audio/wav':
      case 'audio/x-wav':
        return 'wav';
      case 'audio/mpeg':
        return 'mp3';
      case 'audio/mp4':
        return 'mp4';
      case 'audio/ogg':
        return 'ogg';
      default:
        return 'webm';
    }
  }

  private parseJsonResponse(response: unknown): unknown {
    if (typeof response !== 'string') {
      return response;
    }

    const trimmed = response.trim();

    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
      return response;
    }

    try {
      return JSON.parse(trimmed) as unknown;
    } catch {
      return response;
    }
  }

  private collectResponseRecords(response: unknown, depth = 0): Record<string, unknown>[] {
    if (!response || typeof response !== 'object' || Array.isArray(response) || depth > 3) {
      return [];
    }

    const record = response as Record<string, unknown>;
    const nestedRecords = ['data', 'payload', 'response'].reduce((items: Record<string, unknown>[], key: string) => {
      return [...items, ...this.collectResponseRecords(record[key], depth + 1)];
    }, []);

    return [record, ...nestedRecords];
  }

  private pickStringFromRecords(records: Record<string, unknown>[], keys: string[]): string | undefined {
    return records
      .map((record: Record<string, unknown>) => this.pickString(record, keys))
      .find((value: string | undefined) => typeof value === 'string' && value.trim().length > 0);
  }

  private pickNumberFromRecords(records: Record<string, unknown>[], keys: string[]): number | undefined {
    return records
      .map((record: Record<string, unknown>) => this.pickNumber(record, keys))
      .find((value: number | undefined) => typeof value === 'number');
  }

  private pickStringArrayFromRecords(records: Record<string, unknown>[], keys: string[]): string[] {
    return records
      .map((record: Record<string, unknown>) => this.pickStringArray(record, keys))
      .find((value: string[]) => value.length > 0) ?? [];
  }

  private pickGuideCards(records: Record<string, unknown>[]): AiGuideCard[] {
    const candidates = records.reduce((items: unknown[], record: Record<string, unknown>) => {
      items.push(record['guide_cards'], record['guideCards']);
      return items;
    }, []);
    const value = candidates.find(Array.isArray);

    if (!Array.isArray(value)) {
      return [];
    }

    return value.reduce((cards: AiGuideCard[], item: unknown) => {
      if (!item || typeof item !== 'object') {
        return cards;
      }

      const record = item as Record<string, unknown>;
      const title = this.pickString(record, ['title']);
      const description = this.pickString(record, ['description']);
      const query = this.pickString(record, ['query']);

      if (!title && !description && !query) {
        return cards;
      }

      cards.push({
        title: title || query || 'Suggestion',
        description: description || 'Essayez cette piste dans la recherche intelligente.',
        query: query || title,
      });

      return cards;
    }, []);
  }

  private pickString(record: Record<string, unknown>, keys: string[]): string | undefined {
    const value = keys
      .map((key: string) => record[key])
      .find((candidate: unknown) => typeof candidate === 'string' && candidate.trim().length > 0);

    return typeof value === 'string' ? value.trim() : undefined;
  }

  private pickIdentifier(record: Record<string, unknown>, keys: string[]): string | undefined {
    const value = keys
      .map((key: string) => record[key])
      .find((candidate: unknown) => typeof candidate === 'string' || typeof candidate === 'number');

    if (typeof value === 'number') {
      return String(value);
    }

    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
  }

  private pickNumber(record: Record<string, unknown>, keys: string[]): number | undefined {
    const value = keys
      .map((key: string) => record[key])
      .find((candidate: unknown) => typeof candidate === 'number' || typeof candidate === 'string');

    if (typeof value === 'number') {
      return value;
    }

    if (typeof value === 'string') {
      const parsedValue = Number(value);
      return Number.isFinite(parsedValue) ? parsedValue : undefined;
    }

    return undefined;
  }

  private pickStringArray(record: Record<string, unknown>, keys: string[]): string[] {
    const value = keys
      .map((key: string) => record[key])
      .find((candidate: unknown) => Array.isArray(candidate));

    if (!Array.isArray(value)) {
      return [];
    }

    return value.filter((item: unknown): item is string => typeof item === 'string' && item.trim().length > 0);
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
