import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { NotificationItem, Place, ProfileAction, ProfileStat } from '../data/tourism.data';
import { ApiService } from './api.service';
import { ImageProxyService } from './image-proxy.service';

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

interface PlaceUpdatePayload {
  name: string;
  description: string;
  address: string;
  latitude?: number;
  longitude?: number;
  rating?: number;
  types?: string[];
  photoUrl?: string;
  placeId: string;
  googleMapsUrl?: string;
  city?: string;
  category?: string;
}

@Injectable({
  providedIn: 'root'
})
export class PlaceCatalogService {
  private readonly recentPlacesKey = 'recentPlaceIds';
  private readonly allPlacesLabel = 'Tout';

  constructor(private apiService: ApiService, private imageProxyService: ImageProxyService) {}

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

    return this.apiService.getPlaceById(normalizedId).pipe(
      map((response: unknown) => this.normalizePlace(response)),
      catchError(() => this.getPlaces().pipe(
        map((places: Place[]) => places.find((place: Place) => place.id === normalizedId) ?? null)
      ))
    );
  }

  updatePlace(place: Place, changes: Partial<Place>): Observable<Place | null> {
    const placeId = (place.externalPlaceId || place.id || '').trim();

    if (!placeId) {
      return of(null);
    }

    const payload = this.buildPlaceUpdatePayload(place, changes);

    return this.apiService.updatePlaceByPlaceId(placeId, payload).pipe(
      map((response: unknown) => this.normalizePlace(response)),
      catchError(() => of(null))
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
            title: 'Catalogue disponible',
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
          subtitle: `${places.length} fiches sont deja pretes dans votre application`,
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

  buildFallbackImageUrl(details: Pick<Place, 'name' | 'address' | 'latitude' | 'longitude'>): string | undefined {
    const label = details.name?.trim() || details.address?.trim() || 'Destination';
    const seed = this.slugify(label) || 'morocco';
    return `https://picsum.photos/seed/${seed}/600/400`;
  }

  getStaticMap(lat: number, lng: number): string {
    return this.buildInlinePlaceholderImageUrl({
      label: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
      latitude: lat,
      longitude: lng,
    });
  }

  sanitizeImageUrl(value: string | undefined): string | undefined {
    const rawValue = value?.trim();

    if (!rawValue) {
      return undefined;
    }

    // Allow data URIs and blob URLs
    if (/^(data|blob):/i.test(rawValue)) {
      return rawValue;
    }

    // Reject known invalid static map providers
    if (rawValue.toLowerCase().includes('staticmap.openstreetmap.de') || 
        rawValue.toLowerCase().includes('staticmap.php') ||
        rawValue.toLowerCase().includes('/staticmap')) {
      console.debug('[Image] Rejected static map URL:', rawValue);
      return undefined;
    }

    // Allow local asset paths
    if (/^\/?assets\//i.test(rawValue)) {
      return rawValue.replace(/^\/+/, '');
    }

    let normalizedValue = rawValue;

    // For relative URLs, resolve against base URL
    if (!/^https?:\/\//i.test(normalizedValue)) {
      // Allow protocol-relative URLs (//cdn.example.com/image.jpg)
      if (/^\/\//.test(normalizedValue)) {
        normalizedValue = `https:${normalizedValue}`;
      }
      // Allow URLs without protocol (example.com/image.jpg)
      else if (/^[a-z0-9.-]+\.[a-z]{2,}\//i.test(normalizedValue)) {
        normalizedValue = `https://${normalizedValue}`;
      }
      // Reject relative paths that could point to invalid endpoints
      else if (rawValue.includes('.php') || rawValue.startsWith('/api/') ||
          (rawValue.includes('/') && !rawValue.startsWith('/assets'))) {
        console.debug('[Image] Rejected invalid relative URL:', rawValue);
        return undefined;
      }
      else {
        try {
          return new URL(normalizedValue, this.apiService.getBaseUrl()).toString();
        } catch {
          return undefined;
        }
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

      // Google Places API photo URLs need to go through proxy (CORS / server-side key)
      if (parsedUrl.hostname.includes('maps.googleapis.com') &&
          parsedUrl.pathname.includes('/maps/api/place/photo')) {
        return this.imageProxyService.getImageUrl(parsedUrl.toString()) ?? parsedUrl.toString();
      }

      return parsedUrl.toString();
    } catch {
      return undefined;
    }
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
    const latitude = this.pickNumber(record, ['latitude', 'lat']);
    const longitude = this.pickNumber(record, ['longitude', 'lng', 'lon']);
    const imageUrl = this.pickImageUrl(record);
    const googleMapsUrl = this.pickGoogleMapsUrl(record, name, address, latitude, longitude);
    const backendId = this.pickNumber(record, ['id']);
    const externalPlaceId = this.pickIdentifier(record, ['place_id', 'placeId']);
    
    // Extract photo URLs directly from JSON and sanitize them
    const photo_url = this.sanitizeImageUrl(this.pickString(record, ['photo_url', 'photoUrl']));
    const photo_urls = this.pickStringArray(record, ['photo_urls', 'photoUrls', 'images', 'imageUrls'])
      .map((url: string) => this.sanitizeImageUrl(url))
      .filter((url: string | undefined): url is string => !!url);

    // Build fallback image URL (generates a placeholder if no real image)
    const fallbackImageUrl = this.buildFallbackImageUrl({
      name,
      address,
      latitude,
      longitude,
    });

    return {
      id: externalPlaceId || this.pickIdentifier(record, ['id']) || this.slugify(`${name}-${location}-${index}`),
      backendId,
      externalPlaceId,
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
      imageUrl,
      fallbackImageUrl,
      photo_url,
      photo_urls,
      googleMapsUrl,
      latitude,
      longitude,
      types,
      city: location,
    };
  }

  private extractResultArray(response: unknown): unknown[] {
    if (Array.isArray(response)) {
      return response;
    }

    const records = this.collectResponseRecords(response);

    if (!records.length) {
      return [];
    }

    const candidates = records.reduce((items: unknown[], record: Record<string, unknown>) => {
      items.push(record['results'], record['places'], record['data'], record['items']);
      return items;
    }, []);
    const rawArray = candidates.find(Array.isArray);

    return Array.isArray(rawArray) ? rawArray : [];
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

    if (text.includes('plage') || text.includes('beach') || text.includes('ocean') || text.includes('water')) {
      return text.includes('teal') || text.includes('lagon') ? 'theme-blue-teal' : 'theme-blue-ocean';
    }

    if (text.includes('marrakech')) {
      return 'theme-marrakech';
    }

    if (text.includes('chefchaouen')) {
      return 'theme-chefchaouen';
    }

    if (text.includes('zoo') || text.includes('family') || text.includes('parc') || text.includes('nature') || text.includes('garden')) {
      return 'theme-blue-teal';
    }

    if (text.includes('rabat') || text.includes('capital')) {
      return 'theme-rabat';
    }

    return 'theme-blue-ocean';
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

  private pickImageUrl(record: Record<string, unknown>): string | undefined {
    // Priority 1: Look for direct photo_url from Google Places API
    const directUrl = this.sanitizeImageUrl(this.pickString(record, ['photo_url', 'photoUrl', 'imageUrl', 'image', 'thumbnail']));

    if (directUrl) {
      return directUrl;
    }

    // Priority 2: Look in photo arrays (photo, photos, images)
    return this.pickMediaUrl(record['photo'])
      || this.pickMediaUrl(record['photos'])
      || this.pickMediaUrl(record['images']);
  }

  private pickMediaUrl(value: unknown): string | undefined {
    if (typeof value === 'string' && value.trim().length > 0) {
      return this.sanitizeImageUrl(value);
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        const mediaUrl = this.pickMediaUrl(item);

        if (mediaUrl) {
          return mediaUrl;
        }
      }

      return undefined;
    }

    if (!value || typeof value !== 'object') {
      return undefined;
    }

    const record = value as Record<string, unknown>;
    const directUrl = this.sanitizeImageUrl(
      this.pickString(record, ['photo_url', 'photoUrl', 'imageUrl', 'image', 'thumbnail', 'url', 'src'])
    );

    if (directUrl) {
      return directUrl;
    }

    return this.pickMediaUrl(record['photo'])
      || this.pickMediaUrl(record['thumbnail'])
      || this.pickMediaUrl(record['url'])
      || this.pickMediaUrl(record['src']);
  }

  private pickGoogleMapsUrl(
    record: Record<string, unknown>,
    name: string,
    address: string,
    latitude?: number,
    longitude?: number
  ): string | undefined {
    const directUrl = this.pickString(record, ['google_maps_url', 'googleMapsUrl', 'maps_url', 'mapsUrl']);

    if (directUrl) {
      return directUrl;
    }

    if (typeof latitude === 'number' && typeof longitude === 'number') {
      return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
    }

    const query = [name, address].filter((segment: string) => segment.trim().length > 0).join(', ');

    return query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : undefined;
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

  private buildInlinePlaceholderImageUrl(details: { label: string; latitude?: number; longitude?: number }): string {
    const title = this.escapeSvgText(details.label);
    const subtitle = typeof details.latitude === 'number' && typeof details.longitude === 'number'
      ? `${details.latitude.toFixed(4)}, ${details.longitude.toFixed(4)}`
      : 'Image from JSON';
    const accent = this.pickPlaceholderAccent(details.label);
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400" role="img" aria-labelledby="title desc">
        <title id="title">${title}</title>
        <desc id="desc">${this.escapeSvgText(subtitle)}</desc>
        <defs>
          <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stop-color="#f8fafc" />
            <stop offset="100%" stop-color="#e2e8f0" />
          </linearGradient>
        </defs>
        <rect width="600" height="400" rx="28" fill="url(#bg)" />
        <circle cx="510" cy="86" r="92" fill="${accent}" fill-opacity="0.14" />
        <circle cx="110" cy="320" r="122" fill="${accent}" fill-opacity="0.08" />
        <rect x="56" y="56" width="488" height="288" rx="24" fill="#ffffff" fill-opacity="0.72" stroke="#cbd5e1" stroke-width="2" />
        <text x="82" y="158" fill="#0f172a" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="700">${title}</text>
        <text x="82" y="214" fill="#475569" font-family="Arial, Helvetica, sans-serif" font-size="20">${this.escapeSvgText(subtitle)}</text>
        <text x="82" y="274" fill="#64748b" font-family="Arial, Helvetica, sans-serif" font-size="16">Image fallback generated locally</text>
      </svg>
    `.replace(/\s+/g, ' ').trim();

    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  }

  private pickPlaceholderAccent(value: string): string {
    const palette = ['#0f766e', '#1d4ed8', '#b45309', '#be185d', '#4338ca'];
    const seed = this.slugify(value);
    const index = Array.from(seed).reduce((sum: number, char: string) => sum + char.charCodeAt(0), 0) % palette.length;

    return palette[index];
  }

  private escapeSvgText(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
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

  private buildPlaceUpdatePayload(place: Place, changes: Partial<Place>): PlaceUpdatePayload {
    const nextPlace = {
      ...place,
      ...changes,
    };
    const normalizedImageUrl = nextPlace.imageUrl?.trim();

    return {
      name: nextPlace.name.trim(),
      description: nextPlace.longDescription.trim(),
      address: nextPlace.address.trim(),
      ...(typeof nextPlace.latitude === 'number' ? { latitude: nextPlace.latitude } : {}),
      ...(typeof nextPlace.longitude === 'number' ? { longitude: nextPlace.longitude } : {}),
      ...(typeof nextPlace.rating === 'number' ? { rating: nextPlace.rating } : {}),
      ...(nextPlace.types?.length ? { types: nextPlace.types } : {}),
      ...(normalizedImageUrl && normalizedImageUrl !== nextPlace.fallbackImageUrl ? { photoUrl: normalizedImageUrl } : {}),
      placeId: (nextPlace.externalPlaceId || nextPlace.id).trim(),
      ...(nextPlace.googleMapsUrl?.trim() ? { googleMapsUrl: nextPlace.googleMapsUrl.trim() } : {}),
      ...(nextPlace.location.trim() ? { city: nextPlace.location.trim() } : {}),
      ...(nextPlace.category.trim() ? { category: nextPlace.category.trim() } : {}),
    };
  }
}
