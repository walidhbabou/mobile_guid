import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map, switchMap, take } from 'rxjs/operators';
import { AiGuideCard, AiPlaceSearchExperience, AiPlaceSearchResult } from '../models/ai-place.model';
import { RecommendationsResponseApi } from '../models/recommendation.model';
import { Place } from '../data/tourism.data';
import { ApiService } from './api.service';
import { ImageProxyService } from './image-proxy.service';
import { PlaceCatalogService } from './place-catalog.service';
import { TokenService } from './token.service';

export interface AiSearchRequestOptions {
  userLatitude?: number;
  userLongitude?: number;
  language?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AiPlaceService {
  private readonly aiRequestTimeoutMs = 30000;
  private readonly audioRequestTimeoutMs = 90000;
  private readonly defaultResultLimit = 10;
  private readonly supportedCityTokens = [
    'agadir',
    'asilah',
    'beni mellal',
    'casablanca',
    'chefchaouen',
    'dakhla',
    'el jadida',
    'essaouira',
    'fes',
    'fez',
    'ifrane',
    'kenitra',
    'larache',
    'marrakech',
    'meknes',
    'mohammedia',
    'nador',
    'ouarzazate',
    'oujda',
    'rabat',
    'sale',
    'safi',
    'tanger',
    'tangier',
    'temara',
    'tetouan',
  ];

  constructor(
    private apiService: ApiService,
    private imageProxyService: ImageProxyService,
    private placeCatalogService: PlaceCatalogService,
    private tokenService: TokenService
  ) {}

  getRecommendations(lat: number, lon: number): Observable<RecommendationsResponseApi> {
    const safeLat = Number(lat);
    const safeLon = Number(lon);

    if (!Number.isFinite(safeLat) || !Number.isFinite(safeLon)) {
      return throwError(() => new Error('Coordonnees invalides pour les recommandations.'));
    }

    if (!this.tokenService.getAccessToken()) {
      return of({
        userId: '',
        latitude: safeLat,
        longitude: safeLon,
        recommendations: [],
      });
    }

    const endpoint = `/api/ai/recommendations?lat=${encodeURIComponent(String(safeLat))}&lon=${encodeURIComponent(String(safeLon))}`;
    return this.apiService.get(endpoint, { timeoutMs: 20000 }) as Observable<RecommendationsResponseApi>;
  }

  search(query: string, options: AiSearchRequestOptions = {}): Observable<AiPlaceSearchExperience> {
    const normalizedQuery = query.trim();
    const remoteQuery = this.buildRemoteQuery(normalizedQuery, options);

    if (!normalizedQuery) {
      return of(this.buildEmptyExperience());
    }

    const attempts = [
      () => this.apiService.post(
        '/api/morocco-ai/search',
        this.buildTextPayload(remoteQuery, options),
        { timeoutMs: this.aiRequestTimeoutMs }
      ),
      () => this.apiService.post(
        '/api/ai/search',
        this.buildTextPayload(remoteQuery, options),
        { timeoutMs: this.aiRequestTimeoutMs }
      ),
      () => this.apiService.get(
        this.buildSearchEndpoint('/api/morocco-ai/search', remoteQuery, options),
        { timeoutMs: this.aiRequestTimeoutMs }
      ),
      () => this.apiService.get(
        this.buildSearchEndpoint('/api/ai/search', remoteQuery, options),
        { timeoutMs: this.aiRequestTimeoutMs }
      ),
    ];

    return this.placeCatalogService.getPlaces().pipe(
      take(1),
      switchMap((places: Place[]) => this.tryRequest(attempts).pipe(
        map((response: unknown) => this.normalizeExperience(response, places, normalizedQuery, options)),
        catchError(() => of(this.buildFallbackExperience(normalizedQuery, places, options)))
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
        this.buildAudioFormData(audio, options, normalizedLanguage),
        { timeoutMs: this.audioRequestTimeoutMs }
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
      return throwError(() => lastError ?? new Error('Aucun service de recherche disponible pour le moment.'));
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

    return status === 404 || status === 403 || status >= 500;
  }

  private normalizeExperience(
    response: unknown,
    places: Place[],
    fallbackQuery?: string,
    options: AiSearchRequestOptions = {}
  ): AiPlaceSearchExperience {
    const records = this.collectResponseRecords(this.parseJsonResponse(response));
    const resultLimit = this.resolveResultLimit(records);
    const nearMe = this.pickBooleanFromRecords(records, ['near_me', 'nearMe']) ?? false;
    const rawAiResults = this.extractResultArray(records)
      .map((item: unknown, index: number) => this.normalizeItem(item, index, places, options))
      .filter((item): item is AiPlaceSearchResult => item !== null);
    const prioritizedAiResults = this.prioritizeAiResults(rawAiResults, fallbackQuery, options, nearMe);
    const aiResults = prioritizedAiResults.slice(0, resultLimit);
    const positionSortApplied = this.didResultOrderChange(rawAiResults.slice(0, resultLimit), aiResults);

    if (aiResults.length > 0) {
      return {
        results: aiResults,
        source: 'ai',
        assistantReply: this.resolveAssistantReply(records, aiResults, options, nearMe, positionSortApplied),
        message: this.pickStringFromRecords(records, ['message']),
        positionNote: this.buildPositionNote(aiResults, options, nearMe, positionSortApplied),
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
      return this.buildFallbackExperience(fallbackQuery, places, options, records, resultLimit);
    }

    return {
      ...this.buildEmptyExperience(),
      assistantReply: this.pickStringFromRecords(records, ['assistant_reply', 'assistantReply']),
      message: this.pickStringFromRecords(records, ['message']),
      positionNote: this.buildPositionNote([], options, nearMe, positionSortApplied),
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

  private normalizeItem(
    item: unknown,
    index: number,
    places: Place[],
    options: AiSearchRequestOptions = {}
  ): AiPlaceSearchResult | null {
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
      || 'Suggestion trouvee selon votre envie du moment.';
    const rating = this.pickNumber(record, ['rating', 'score']);
    const latitude = this.pickNumber(record, ['latitude', 'lat']);
    const longitude = this.pickNumber(record, ['longitude', 'lng', 'lon']);
    const distanceKm = this.calculateDistanceKm(
      options.userLatitude,
      options.userLongitude,
      latitude,
      longitude
    );
    const fallbackImageUrl = this.placeCatalogService.buildFallbackImageUrl({
      name,
      address: address || location,
      latitude,
      longitude,
    });
    const imageUrl = this.resolveImageUrl(record) || fallbackImageUrl;
    const googleMapsUrl = this.pickString(record, ['google_maps_url', 'googleMapsUrl']);
    const types = this.pickStringArray(record, ['types']);
    const externalId = this.pickIdentifier(record, ['place_id', 'placeId', 'id']);
    const routeMatch = this.findLocalMatch(externalId, name, location, category, places);
    const visualTheme = routeMatch?.theme || this.pickTheme(category, location, name);
    const visualBadge = routeMatch?.badge || category;
    const visualIcon = routeMatch?.icon || this.pickIcon(category);

    // Extract photo URLs directly from JSON and sanitize them
    const photo_url = this.sanitizeImageUrl(this.pickString(record, ['photo_url', 'photoUrl']));
    const photo_urls = this.pickStringArray(record, ['photo_urls', 'photoUrls', 'images', 'imageUrls'])
      .map((url: string) => this.sanitizeImageUrl(url))
      .filter((url: string | undefined): url is string => !!url);

    return {
      id: externalId || routeMatch?.id || `ai-place-${index}`,
      name,
      location,
      category,
      description,
      address,
      rating,
      imageUrl,
      fallbackImageUrl,
      photo_url,
      photo_urls,
      latitude,
      longitude,
      googleMapsUrl,
      types,
      reviewsLabel: routeMatch?.reviewsLabel,
      routeId: routeMatch?.id || externalId,
      theme: visualTheme,
      visualBadge,
      visualIcon,
      distanceKm,
      source: 'ai',
    };
  }

  private buildFallbackExperience(
    query: string,
    places: Place[],
    options: AiSearchRequestOptions = {},
    records: Record<string, unknown>[] = [],
    resultLimit = this.defaultResultLimit
  ): AiPlaceSearchExperience {
    const fallbackResults = this.buildFallbackResults(query, places, options, resultLimit);

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
      positionNote: this.buildPositionNote(fallbackResults, options, false, false),
      resultsCount: fallbackResults.length,
      suggestedQuestions: this.pickStringArrayFromRecords(records, ['suggested_questions', 'suggestedQuestions']).slice(0, 6),
      guideCards: this.pickGuideCards(records).slice(0, 3),
    };
  }

  private buildFallbackResults(
    query: string,
    places: Place[],
    options: AiSearchRequestOptions = {},
    resultLimit = this.defaultResultLimit
  ): AiPlaceSearchResult[] {
    const normalizedTerms = this.buildSearchTerms(query);

    return places
      .map((place: Place) => {
        const textScore = this.scorePlace(place, normalizedTerms);
        const distanceKm = this.calculateDistanceKm(
          options.userLatitude,
          options.userLongitude,
          place.latitude,
          place.longitude
        );
        const proximityScore = this.scoreDistance(distanceKm);
        const totalScore = (textScore * 100) + proximityScore;

        return {
          place,
          textScore,
          distanceKm,
          totalScore,
        };
      })
      .filter((item: { textScore: number; distanceKm?: number; totalScore: number }) => {
        if (item.textScore > 0) {
          return true;
        }

        return typeof item.distanceKm === 'number' && item.distanceKm <= 25 && item.totalScore > 0;
      })
      .sort((
        left: { distanceKm?: number; totalScore: number },
        right: { distanceKm?: number; totalScore: number }
      ) => {
        const scoreDelta = right.totalScore - left.totalScore;

        if (scoreDelta !== 0) {
          return scoreDelta;
        }

        const leftDistance = left.distanceKm ?? Number.POSITIVE_INFINITY;
        const rightDistance = right.distanceKm ?? Number.POSITIVE_INFINITY;
        return leftDistance - rightDistance;
      })
      .slice(0, resultLimit)
      .map((item: { place: Place; distanceKm?: number }) => ({
        place: item.place,
        distanceKm: item.distanceKm,
      }))
      .map(({ place, distanceKm }: { place: Place; distanceKm?: number }) => ({
        id: place.id,
        name: place.name,
        location: place.location,
        category: place.category,
        description: `Resultat local proche de votre recherche: ${place.shortDescription}`,
        address: place.address,
        rating: place.rating,
        imageUrl: place.imageUrl,
        fallbackImageUrl: place.fallbackImageUrl,
        photo_url: place.photo_url,
        photo_urls: place.photo_urls,
        latitude: place.latitude,
        longitude: place.longitude,
        googleMapsUrl: place.googleMapsUrl,
        types: place.types,
        reviewsLabel: place.reviewsLabel,
        routeId: place.id,
        theme: place.theme,
        visualBadge: place.badge,
        visualIcon: place.icon,
        distanceKm,
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

  private resolveResultLimit(records: Record<string, unknown>[]): number {
    const requestedLimit = this.pickNumberFromRecords(records, ['result_limit', 'resultLimit']);

    if (typeof requestedLimit !== 'number' || !Number.isFinite(requestedLimit)) {
      return this.defaultResultLimit;
    }

    const normalizedLimit = Math.floor(requestedLimit);
    return Math.min(20, Math.max(1, normalizedLimit));
  }

  private scorePlace(place: Place, terms: string[]): number {
    if (!terms.length) {
      return 0;
    }

    const weightedFields = [
      { value: place.name, weight: 5 },
      { value: place.location, weight: 4 },
      { value: place.category, weight: 4 },
      { value: place.shortDescription, weight: 2 },
      { value: place.longDescription, weight: 1 },
      ...(place.highlights ?? []).map((highlight: string) => ({ value: highlight, weight: 2 })),
      ...(place.types ?? []).map((type: string) => ({ value: type, weight: 2 })),
    ];

    return terms.reduce((score: number, term: string) => {
      return score + weightedFields.reduce((fieldScore: number, field) => {
        const normalizedValue = this.normalizeText(field.value);
        return fieldScore + (normalizedValue.includes(term) ? field.weight : 0);
      }, 0);
    }, 0);
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

      const nameMatch = placeName.includes(normalizedName) || normalizedName.includes(placeName);
      const locationMatch = placeLocation.includes(normalizedLocation) || normalizedLocation.includes(placeLocation);
      const categoryMatch = placeCategory === normalizedCategory;

      if (nameMatch) {
        return true;
      }

      return locationMatch && categoryMatch;
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

  private buildSearchEndpoint(
    baseEndpoint: string,
    query: string,
    options: AiSearchRequestOptions
  ): string {
    const params = new URLSearchParams({
      query,
    });

    if (typeof options.userLatitude === 'number') {
      params.set('user_latitude', String(options.userLatitude));
    }

    if (typeof options.userLongitude === 'number') {
      params.set('user_longitude', String(options.userLongitude));
    }

    return `${baseEndpoint}?${params.toString()}`;
  }

  private buildAudioFormData(
    audio: Blob,
    options: AiSearchRequestOptions,
    normalizedLanguage?: string
  ): FormData {
    const formData = new FormData();
    const filename = `voice-query-${Date.now()}.${this.resolveAudioExtension(audio.type)}`;

    formData.append('audio', audio, filename);
    // Send alternate field names for broader backend compatibility.
    formData.append('file', audio, filename);

    if (normalizedLanguage) {
      formData.append('language', normalizedLanguage);
      formData.append('lang', normalizedLanguage);
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

  private pickBooleanFromRecords(records: Record<string, unknown>[], keys: string[]): boolean | undefined {
    return records
      .map((record: Record<string, unknown>) => this.pickBoolean(record, keys))
      .find((value: boolean | undefined) => typeof value === 'boolean');
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
      const timeSlot = this.pickString(record, ['time_slot', 'timeSlot']);
      const durationMinutes = this.pickNumber(record, ['duration_minutes', 'durationMinutes']);
      const budgetMinMad = this.pickNumber(record, ['budget_min_mad', 'budgetMinMad']);
      const budgetMaxMad = this.pickNumber(record, ['budget_max_mad', 'budgetMaxMad']);

      if (!title && !description && !query) {
        return cards;
      }

      cards.push({
        title: title || query || 'Suggestion',
        description: description || 'Essayez cette piste dans la recherche intelligente.',
        query: query || title,
        timeSlot,
        durationMinutes,
        budgetMinMad,
        budgetMaxMad,
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

  private resolveImageUrl(record: Record<string, unknown>): string | undefined {
    const directUrl = this.sanitizeImageUrl(this.pickString(record, ['photo_url', 'photoUrl', 'imageUrl', 'image', 'thumbnail']));

    if (directUrl) {
      return directUrl;
    }

    const arrayUrl = this.pickStringArray(record, ['photo_urls', 'photoUrls', 'images', 'imageUrls'])
      .map((item: string) => item.trim())
      .map((item: string) => this.sanitizeImageUrl(item))
      .filter((item: string | undefined): item is string => !!item)
      .find((item: string) => item.length > 0);

    if (arrayUrl) {
      return arrayUrl;
    }

    return undefined;
  }

  private sanitizeImageUrl(value: string | undefined): string | undefined {
    const rawValue = value?.trim();

    if (!rawValue) {
      return undefined;
    }

    // Reject known invalid static map providers
    if (rawValue.toLowerCase().includes('staticmap.openstreetmap.de') || 
        rawValue.toLowerCase().includes('staticmap.php') ||
        rawValue.toLowerCase().includes('/staticmap')) {
      console.debug('[Image] Rejected static map URL:', rawValue);
      return undefined;
    }

    let normalizedValue = rawValue;

    if (!/^https?:\/\//i.test(normalizedValue)) {
      if (/^\/\//.test(normalizedValue)) {
        normalizedValue = `https:${normalizedValue}`;
      } else if (/^[a-z0-9.-]+\.[a-z]{2,}(\/|$)/i.test(normalizedValue)) {
        normalizedValue = `https://${normalizedValue}`;
      } else {
        console.debug('[Image] Rejected invalid URL format:', rawValue);
        return undefined;
      }
    }

    try {
      const parsedUrl = new URL(normalizedValue);

      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        return undefined;
      }

      if (parsedUrl.hostname.toLowerCase() === 'staticmap.openstreetmap.de') {
        return undefined;
      }

      // Google Places API photo URLs need proxy (server-side API key, CORS blocked)
      if (parsedUrl.hostname.includes('maps.googleapis.com')
          && parsedUrl.pathname.includes('/maps/api/place/photo')) {
        return this.imageProxyService.getImageUrl(parsedUrl.toString()) ?? parsedUrl.toString();
      }

      return parsedUrl.toString();
    } catch (error) {
      console.debug('[Image] Failed to parse URL:', value, error);
      return undefined;
    }
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

  private pickBoolean(record: Record<string, unknown>, keys: string[]): boolean | undefined {
    const value = keys
      .map((key: string) => record[key])
      .find((candidate: unknown) => typeof candidate === 'boolean' || typeof candidate === 'string');

    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'string') {
      const normalizedValue = value.trim().toLowerCase();

      if (normalizedValue === 'true') {
        return true;
      }

      if (normalizedValue === 'false') {
        return false;
      }
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

  private buildRemoteQuery(query: string, options: AiSearchRequestOptions): string {
    if (typeof options.userLatitude !== 'number' || typeof options.userLongitude !== 'number') {
      return query;
    }

    if (this.queryAlreadyRequestsNearbyResults(query) || this.queryContainsSupportedCity(query)) {
      return query;
    }

    return `${query} pres de moi`;
  }

  private queryAlreadyRequestsNearbyResults(query: string): boolean {
    const normalizedQuery = this.normalizeText(query);

    return normalizedQuery.includes('pres de moi')
      || normalizedQuery.includes('proche de moi')
      || normalizedQuery.includes('autour de moi')
      || normalizedQuery.includes('near me')
      || normalizedQuery.includes('nearby');
  }

  private queryContainsSupportedCity(query?: string): boolean {
    if (!query?.trim()) {
      return false;
    }

    const normalizedQuery = this.normalizeText(query);
    return this.supportedCityTokens.some((city: string) => normalizedQuery.includes(city));
  }

  private prioritizeAiResults(
    results: AiPlaceSearchResult[],
    query: string | undefined,
    options: AiSearchRequestOptions,
    nearMe: boolean
  ): AiPlaceSearchResult[] {
    if (!results.length || !this.shouldSortByDistance(query, options, nearMe)) {
      return results;
    }

    const resultsWithDistance = results.filter((result: AiPlaceSearchResult) => typeof result.distanceKm === 'number');

    if (resultsWithDistance.length < 2) {
      return results;
    }

    return [...results].sort((left: AiPlaceSearchResult, right: AiPlaceSearchResult) => {
      const leftDistance = left.distanceKm ?? Number.POSITIVE_INFINITY;
      const rightDistance = right.distanceKm ?? Number.POSITIVE_INFINITY;
      return leftDistance - rightDistance;
    });
  }

  private shouldSortByDistance(
    query: string | undefined,
    options: AiSearchRequestOptions,
    nearMe: boolean
  ): boolean {
    if (typeof options.userLatitude !== 'number' || typeof options.userLongitude !== 'number') {
      return false;
    }

    return nearMe || this.queryContainsSupportedCity(query);
  }

  private didResultOrderChange(
    initialResults: AiPlaceSearchResult[],
    prioritizedResults: AiPlaceSearchResult[]
  ): boolean {
    if (initialResults.length !== prioritizedResults.length) {
      return true;
    }

    return initialResults.some((result: AiPlaceSearchResult, index: number) => result.id !== prioritizedResults[index]?.id);
  }

  private resolveAssistantReply(
    records: Record<string, unknown>[],
    results: AiPlaceSearchResult[],
    options: AiSearchRequestOptions,
    nearMe: boolean,
    positionSortApplied: boolean
  ): string | undefined {
    // Toujours prioritiser le vrai assistant_reply du backend
    const backendReply = this.pickStringFromRecords(records, ['assistant_reply', 'assistantReply']);
    if (backendReply) {
      return backendReply;
    }

    // Fallback : générer une note de distance si les résultats ont été réordonnés
    if (
      positionSortApplied
      && !nearMe
      && typeof options.userLatitude === 'number'
      && typeof options.userLongitude === 'number'
    ) {
      return this.buildDistanceAwareReply(results);
    }

    return undefined;
  }

  private buildDistanceAwareReply(results: AiPlaceSearchResult[]): string | undefined {
    const nearestResults = results
      .filter((result: AiPlaceSearchResult) => typeof result.distanceKm === 'number')
      .slice(0, 3);

    if (!nearestResults.length) {
      return undefined;
    }

    const labels = nearestResults.map((result: AiPlaceSearchResult) => (
      `${result.name} (${(result.distanceKm as number).toFixed(1)} km)`
    ));

    return `Classement ajuste selon votre position actuelle. Les plus proches sont ${labels.join(', ')}.`;
  }

  private buildPositionNote(
    results: AiPlaceSearchResult[],
    options: AiSearchRequestOptions,
    nearMe: boolean,
    positionSortApplied: boolean
  ): string | undefined {
    if (typeof options.userLatitude !== 'number' || typeof options.userLongitude !== 'number') {
      return undefined;
    }

    const hasDistances = results.some((result: AiPlaceSearchResult) => typeof result.distanceKm === 'number');

    if (!hasDistances) {
      return undefined;
    }

    if (nearMe) {
      return 'Resultats tries selon votre position actuelle.';
    }

    if (positionSortApplied) {
      return 'Le classement a ete reajuste avec votre position actuelle.';
    }

    return 'La distance affichee est calculee depuis votre position actuelle.';
  }

  private buildSearchTerms(query: string): string[] {
    const stopWords = new Set([
      'a',
      'au',
      'aux',
      'avec',
      'dans',
      'de',
      'des',
      'du',
      'donne',
      'donner',
      'je',
      'la',
      'le',
      'les',
      'lieu',
      'lieux',
      'ma',
      'mes',
      'moi',
      'mon',
      'place',
      'places',
      'pour',
      'sur',
      'the',
      'trouve',
      'trouver',
      'un',
      'une',
      'veux',
      'want',
    ]);
    const synonymMap: Record<string, string[]> = {
      bar: ['boisson', 'cafe', 'cocktail', 'drink'],
      beach: ['ocean', 'plage'],
      boire: ['bar', 'boisson', 'cafe', 'restaurant'],
      cafe: ['bar', 'boisson', 'coffee', 'drink'],
      coffee: ['boisson', 'cafe', 'drink'],
      culture: ['historique', 'musee', 'museum'],
      drink: ['bar', 'boire', 'boisson', 'cafe', 'cocktail', 'restaurant'],
      drinks: ['bar', 'boire', 'boisson', 'cafe', 'cocktail', 'restaurant'],
      famille: ['family', 'parc', 'zoo'],
      family: ['famille', 'parc', 'zoo'],
      food: ['cafe', 'restaurant', 'snack'],
      manger: ['cafe', 'restaurant', 'snack'],
      musee: ['culture', 'historique', 'museum'],
      museum: ['culture', 'historique', 'musee'],
      plage: ['beach', 'ocean'],
      restaurant: ['bar', 'boisson', 'cafe', 'drink'],
    };

    const baseTerms = this.normalizeText(query)
      .split(/[\s,;:/\\|!?()[\]{}"']+/)
      .filter((term: string) => term.length > 1 && !stopWords.has(term));

    const expandedTerms = baseTerms.reduce((terms: string[], term: string) => {
      terms.push(term, ...(synonymMap[term] ?? []));
      return terms;
    }, []);

    return Array.from(new Set(expandedTerms));
  }

  private calculateDistanceKm(
    userLatitude?: number,
    userLongitude?: number,
    placeLatitude?: number,
    placeLongitude?: number
  ): number | undefined {
    if (
      typeof userLatitude !== 'number'
      || typeof userLongitude !== 'number'
      || typeof placeLatitude !== 'number'
      || typeof placeLongitude !== 'number'
    ) {
      return undefined;
    }

    const earthRadiusKm = 6371;
    const latitudeDelta = this.toRadians(placeLatitude - userLatitude);
    const longitudeDelta = this.toRadians(placeLongitude - userLongitude);
    const startLatitude = this.toRadians(userLatitude);
    const endLatitude = this.toRadians(placeLatitude);
    const a = Math.sin(latitudeDelta / 2) ** 2
      + (Math.cos(startLatitude) * Math.cos(endLatitude) * Math.sin(longitudeDelta / 2) ** 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return earthRadiusKm * c;
  }

  private scoreDistance(distanceKm?: number): number {
    if (typeof distanceKm !== 'number') {
      return 0;
    }

    return Math.max(0, 60 - (Math.min(distanceKm, 30) * 2));
  }

  private toRadians(value: number): number {
    return value * (Math.PI / 180);
  }
}
