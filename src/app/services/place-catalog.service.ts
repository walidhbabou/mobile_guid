import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { NotificationItem, Place, ProfileAction, ProfileStat } from '../data/tourism.data';
import { ApiService } from './api.service';

export interface PlaceMarker {
  place: Place;
  top: number;
  left: number;
}

export interface ProfileOverview {
  stats: ProfileStat[];
  actions: ProfileAction[];
  badges: string[];
}

@Injectable({
  providedIn: 'root'
})
export class PlaceCatalogService {
  private readonly recentPlacesKey = 'recentPlaceIds';
  private readonly allPlacesLabel = 'Tout';

  constructor(private apiService: ApiService) {}

  getPlaces(): Observable<Place[]> {
    return this.apiService.getPlaces().pipe(
      map((response: unknown) => this.normalizePlacesResponse(response)),
      catchError(() => of([]))
    );
  }

  getPlaceById(placeId: string): Observable<Place | null> {
    const normalizedId = placeId.trim();

    if (!normalizedId) {
      return of(null);
    }

    return this.apiService.get(`/api/places/by-place-id/${encodeURIComponent(normalizedId)}`).pipe(
      map((response: unknown) => this.normalizePlace(response)),
      catchError(() => this.getPlaces().pipe(
        map((places: Place[]) => places.find((place: Place) => place.id === normalizedId) ?? null)
      ))
    );
  }

  getFeaturedPlaces(limit = 4): Observable<Place[]> {
    return this.getPlaces().pipe(
      map((places: Place[]) => this.sortPlaces(places).slice(0, limit))
    );
  }

  getQuickFilters(limit = 6): Observable<string[]> {
    return this.getPlaces().pipe(
      map((places: Place[]) => this.buildFilterLabels(places, false, limit))
    );
  }

  getMapFilters(limit = 7): Observable<string[]> {
    return this.getPlaces().pipe(
      map((places: Place[]) => this.buildFilterLabels(places, true, limit))
    );
  }

  getRecentPlaces(limit = 6): Observable<Place[]> {
    return this.getPlaces().pipe(
      map((places: Place[]) => {
        const recentPlaces = this.resolveRecentPlaces(places);
        return (recentPlaces.length > 0 ? recentPlaces : this.sortPlaces(places)).slice(0, limit);
      })
    );
  }

  getNotifications(): Observable<NotificationItem[]> {
    return this.getPlaces().pipe(
      map((places: Place[]) => {
        const recentPlaces = this.resolveRecentPlaces(places);
        const featuredPlaces = this.sortPlaces(places);
        const notifications: NotificationItem[] = [];

        if (recentPlaces[0]) {
          notifications.push({
            icon: 'time-outline',
            title: 'Derniere consultation',
            description: `${recentPlaces[0].name} reste disponible avec sa fiche detaillee et la carte.`,
            time: 'Maintenant',
            tone: 'primary',
          });
        }

        if (featuredPlaces[0]) {
          notifications.push({
            icon: 'sparkles-outline',
            title: 'Suggestion du moment',
            description: `${featuredPlaces[0].name} fait partie des lieux les mieux notes a ${featuredPlaces[0].location}.`,
            time: 'Aujourd hui',
            tone: 'secondary',
          });
        }

        if (places.length > 0) {
          notifications.push({
            icon: 'compass-outline',
            title: 'Catalogue synchronise',
            description: `${places.length} lieux dynamiques sont disponibles dans l application.`,
            time: 'Mis a jour',
            tone: 'success',
          });
        }

        return notifications;
      })
    );
  }

  getProfileOverview(): Observable<ProfileOverview> {
    return this.getPlaces().pipe(
      map((places: Place[]) => {
        const recentPlaces = this.resolveRecentPlaces(places);
        const recentSource = recentPlaces.length > 0 ? recentPlaces : this.sortPlaces(places);
        const topPlace = this.sortPlaces(places)[0];
        const stats: ProfileStat[] = [
          {
            label: 'Consultations',
            value: String(recentPlaces.length),
          },
          {
            label: 'Villes',
            value: String(this.getUniqueValues(places.map((place: Place) => place.location)).length),
          },
          {
            label: 'Categories',
            value: String(this.getUniqueValues(places.map((place: Place) => place.category)).length),
          },
        ];
        const actions: ProfileAction[] = [];

        if (recentPlaces[0]) {
          actions.push({
            icon: 'time-outline',
            title: 'Dernier lieu consulte',
            subtitle: `${recentPlaces[0].name} a ${recentPlaces[0].location}`,
          });
        }

        if (topPlace) {
          actions.push({
            icon: 'star-outline',
            title: 'Meilleure note actuelle',
            subtitle: `${topPlace.name} - ${topPlace.rating.toFixed(1)} / 5`,
          });
        }

        actions.push({
          icon: 'map-outline',
          title: 'Catalogue disponible',
          subtitle: `${places.length} fiches synchronisees depuis l API`,
        });

        return {
          stats,
          actions,
          badges: this.getUniqueValues(recentSource.map((place: Place) => place.category)).slice(0, 3),
        };
      })
    );
  }

  filterPlaces(places: Place[], filter: string): Place[] {
    if (!filter || filter === this.allPlacesLabel) {
      return places;
    }

    const normalizedFilter = this.normalizeText(filter);

    return places.filter((place: Place) => {
      const haystack = this.normalizeText([
        place.category,
        place.location,
        ...(place.types ?? []),
      ].join(' '));

      return haystack.includes(normalizedFilter);
    });
  }

  buildMarkers(places: Place[]): PlaceMarker[] {
    if (!places.length) {
      return [];
    }

    const placesWithCoordinates = places.filter((place: Place) => this.hasCoordinates(place));
    const sourcePlaces = placesWithCoordinates.length > 0 ? placesWithCoordinates : places;
    const latitudes = sourcePlaces.map((place: Place) => place.latitude ?? 0);
    const longitudes = sourcePlaces.map((place: Place) => place.longitude ?? 0);
    const minLatitude = Math.min(...latitudes);
    const maxLatitude = Math.max(...latitudes);
    const minLongitude = Math.min(...longitudes);
    const maxLongitude = Math.max(...longitudes);
    const latitudeSpan = maxLatitude - minLatitude || 1;
    const longitudeSpan = maxLongitude - minLongitude || 1;

    return sourcePlaces.map((place: Place, index: number) => {
      const latitude = place.latitude ?? minLatitude;
      const longitude = place.longitude ?? minLongitude;
      const top = 18 + (1 - ((latitude - minLatitude) / latitudeSpan)) * 56 + (index % 3) * 2;
      const left = 16 + ((longitude - minLongitude) / longitudeSpan) * 68 + (index % 2) * 2;

      return {
        place,
        top: this.clamp(top, 12, 82),
        left: this.clamp(left, 12, 86),
      };
    });
  }

  buildAudioWave(place: Place): number[] {
    const seed = `${place.id}${place.name}${place.location}${place.rating || 0}`;

    return Array.from({ length: 12 }, (_value: unknown, index: number) => {
      const charCode = seed.charCodeAt(index % seed.length);
      return 18 + ((charCode + (index * 11)) % 38);
    });
  }

  trackPlaceVisit(placeId: string): void {
    const normalizedId = placeId.trim();

    if (!normalizedId) {
      return;
    }

    const nextPlaceIds = [
      normalizedId,
      ...this.readRecentPlaceIds().filter((storedId: string) => storedId !== normalizedId),
    ].slice(0, 12);

    localStorage.setItem(this.recentPlacesKey, JSON.stringify(nextPlaceIds));
  }

  private normalizePlacesResponse(response: unknown): Place[] {
    const rawPlaces = this.extractResultArray(response);

    return rawPlaces
      .map((item: unknown, index: number) => this.normalizePlace(item, index))
      .filter((place: Place | null): place is Place => place !== null);
  }

  private normalizePlace(item: unknown, index = 0): Place | null {
    if (!item || typeof item !== 'object') {
      return null;
    }

    const record = item as Record<string, unknown>;
    const name = this.pickString(record, ['name', 'title']);

    if (!name) {
      return null;
    }

    const types = this.pickStringArray(record, ['types']);
    const location = this.buildLocation(record);
    const category = this.buildCategory(record, types);
    const description = this.pickString(record, ['description', 'summary'])
      || `Decouvrez ${name} a ${location}.`;
    const address = this.pickString(record, ['address']) || location;
    const rating = this.pickNumber(record, ['rating', 'score']) ?? 0;

    return {
      id: this.pickIdentifier(record, ['place_id', 'placeId', 'id']) || this.slugify(`${name}-${location}-${index}`),
      name,
      location,
      rating,
      reviewsLabel: location,
      reviewsCount: 0,
      category,
      badge: this.buildBadge(category, location),
      theme: this.pickTheme(category, location, name, types),
      icon: this.pickIcon(category, types),
      spotlight: description,
      shortDescription: this.truncate(description, 110),
      longDescription: description,
      address,
      hours: 'Consultez Google Maps pour les horaires du jour',
      starsLabel: this.buildStarsLabel(rating),
      highlights: this.buildHighlights(types, location, address),
      imageUrl: this.pickString(record, ['photo_url', 'photoUrl', 'imageUrl', 'image']),
      googleMapsUrl: this.pickString(record, ['google_maps_url', 'googleMapsUrl']),
      latitude: this.pickNumber(record, ['latitude', 'lat']),
      longitude: this.pickNumber(record, ['longitude', 'lng', 'lon']),
      types,
      city: location,
    };
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
      data['data'],
      data['items'],
    ];
    const rawArray = candidateArrays.find(Array.isArray);

    return Array.isArray(rawArray) ? rawArray : [];
  }

  private buildLocation(record: Record<string, unknown>): string {
    const city = this.pickString(record, ['city']);

    if (city) {
      return this.toTitleCase(city);
    }

    const address = this.pickString(record, ['address']);

    if (!address) {
      return 'Maroc';
    }

    const segments = address.split(',').map((segment: string) => segment.trim()).filter(Boolean);
    return segments[segments.length - 1] || 'Maroc';
  }

  private buildCategory(record: Record<string, unknown>, types: string[]): string {
    const category = this.pickString(record, ['category', 'type']);

    if (category) {
      return this.toTitleCase(category.replace(/[_-]+/g, ' '));
    }

    const semanticType = types.find((type: string) => !['point_of_interest', 'establishment', 'food', 'store'].includes(type));

    return this.toTitleCase((semanticType || 'lieu').replace(/[_-]+/g, ' '));
  }

  private buildBadge(category: string, location: string): string {
    const compactLocation = location.trim();
    return compactLocation.length > 0 ? compactLocation : category;
  }

  private buildHighlights(types: string[], location: string, address: string): string[] {
    const dynamicHighlights = [
      ...types.map((type: string) => this.toTitleCase(type.replace(/[_-]+/g, ' '))),
      this.toTitleCase(location),
      address,
    ];

    return this.getUniqueValues(dynamicHighlights).slice(0, 4);
  }

  private buildStarsLabel(rating: number): string {
    if (!Number.isFinite(rating) || rating <= 0) {
      return 'Nouveau';
    }

    const fullStars = Math.max(1, Math.min(5, Math.round(rating)));
    return '★'.repeat(fullStars);
  }

  private buildFilterLabels(places: Place[], includeAllLabel: boolean, limit: number): string[] {
    const categories = this.getUniqueValues(places.map((place: Place) => place.category));
    const filters = categories.slice(0, includeAllLabel ? Math.max(0, limit - 1) : limit);

    return includeAllLabel ? [this.allPlacesLabel, ...filters] : filters;
  }

  private resolveRecentPlaces(places: Place[]): Place[] {
    return this.readRecentPlaceIds()
      .map((placeId: string) => places.find((place: Place) => place.id === placeId) ?? null)
      .filter((place: Place | null): place is Place => place !== null);
  }

  private readRecentPlaceIds(): string[] {
    const storedValue = localStorage.getItem(this.recentPlacesKey);

    if (!storedValue) {
      return [];
    }

    try {
      const parsedValue = JSON.parse(storedValue) as unknown;
      return Array.isArray(parsedValue)
        ? parsedValue.filter((item: unknown): item is string => typeof item === 'string')
        : [];
    } catch {
      return [];
    }
  }

  private sortPlaces(places: Place[]): Place[] {
    return [...places].sort((left: Place, right: Place) => {
      const ratingDelta = right.rating - left.rating;

      if (ratingDelta !== 0) {
        return ratingDelta;
      }

      return left.name.localeCompare(right.name);
    });
  }

  private pickTheme(category: string, location: string, name: string, types: string[]): string {
    const text = this.normalizeText(`${category} ${location} ${name} ${types.join(' ')}`);

    if (text.includes('plage') || text.includes('beach') || text.includes('ocean')) {
      return 'theme-agadir';
    }

    if (text.includes('marrakech')) {
      return 'theme-marrakech';
    }

    if (text.includes('chefchaouen')) {
      return 'theme-chefchaouen';
    }

    if (text.includes('zoo') || text.includes('family') || text.includes('parc')) {
      return 'theme-zoo';
    }

    return 'theme-rabat';
  }

  private pickIcon(category: string, types: string[]): string {
    const text = this.normalizeText(`${category} ${types.join(' ')}`);

    if (text.includes('plage') || text.includes('beach') || text.includes('ocean')) {
      return 'water-outline';
    }

    if (text.includes('cafe')) {
      return 'cafe-outline';
    }

    if (text.includes('restaurant')) {
      return 'restaurant-outline';
    }

    if (text.includes('hotel') || text.includes('lodging')) {
      return 'bed-outline';
    }

    if (text.includes('park') || text.includes('parc')) {
      return 'leaf-outline';
    }

    return 'compass-outline';
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

  private getUniqueValues(values: string[]): string[] {
    return Array.from(new Set(values.filter((value: string) => value.trim().length > 0)));
  }

  private truncate(value: string, limit: number): string {
    return value.length <= limit ? value : `${value.slice(0, limit - 3).trim()}...`;
  }

  private toTitleCase(value: string): string {
    return value
      .split(' ')
      .filter((segment: string) => segment.length > 0)
      .map((segment: string) => `${segment[0].toUpperCase()}${segment.slice(1)}`)
      .join(' ');
  }

  private normalizeText(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  private slugify(value: string): string {
    return this.normalizeText(value)
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private hasCoordinates(place: Place): boolean {
    return typeof place.latitude === 'number' && typeof place.longitude === 'number';
  }

  private clamp(value: number, minimum: number, maximum: number): number {
    return Math.min(maximum, Math.max(minimum, value));
  }
}
