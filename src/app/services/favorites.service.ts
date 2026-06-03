import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Place } from '../data/tourism.data';
import { UserProfileResponse } from '../models/auth.model';
import { ApiService } from './api.service';
import { PlaceCatalogService } from './place-catalog.service';
import { TokenService } from './token.service';

interface BackendFavorite {
  id: number;
  userId: number;
  placeId: number;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class FavoritesService {
  private readonly storageKey = 'favoritePlaces';
  private readonly backendMapKey = 'favoriteBackendIdMap';
  private readonly subject = new BehaviorSubject<Place[]>(this.load());
  private backendIdMap: Map<string, number> = this.loadBackendIdMap();
  private userId: number | null = null;

  constructor(
    private apiService: ApiService,
    private tokenService: TokenService,
    private placeCatalogService: PlaceCatalogService
  ) {
    if (this.tokenService.isAuthenticated()) {
      this.initUserId();
    }
  }

  get favorites$(): Observable<Place[]> {
    return this.subject.asObservable();
  }

  getSnapshot(): Place[] {
    return this.subject.value;
  }

  isFavorite(placeId: string): boolean {
    return this.subject.value.some(p => p.id === placeId);
  }

  toggle(place: Place): void {
    const current = this.subject.value;
    const exists = current.some(p => p.id === place.id);
    const next = exists
      ? current.filter(p => p.id !== place.id)
      : [{ ...place }, ...current];
    this.subject.next(next);
    this.save(next);

    if (exists) {
      this.removeFromBackend(place.id);
    } else {
      this.addToBackend(place);
    }
  }

  private initUserId(): void {
    this.apiService.getCurrentUserProfile().subscribe({
      next: (profile: UserProfileResponse) => {
        this.userId = profile.id;
        try { localStorage.setItem('userId', String(profile.id)); } catch {}
        this.syncFromBackend();
      },
      error: () => {}
    });
  }

  private syncFromBackend(): void {
    if (!this.userId) return;

    (this.apiService.get(`/api/favorites/user/${this.userId}`) as Observable<BackendFavorite[]>).subscribe({
      next: (favorites: BackendFavorite[]) => {
        if (!Array.isArray(favorites) || favorites.length === 0) return;

        // Load all catalog places to match by backendId and populate local list
        this.placeCatalogService.getPlaces().subscribe({
          next: (allPlaces: Place[]) => {
            const current = [...this.subject.value];
            let changed = false;

            favorites.forEach(fav => {
              const catalogPlace = allPlaces.find(p => p.backendId === fav.placeId);
              const localPlace = current.find(p => p.backendId === fav.placeId);
              const place = catalogPlace || localPlace;

              if (place) {
                this.backendIdMap.set(place.id, fav.id);
                if (!current.some(p => p.id === place.id)) {
                  current.push({ ...place });
                  changed = true;
                }
              }
            });

            if (changed) {
              this.subject.next(current);
              this.save(current);
            }
            this.saveBackendIdMap();
          },
          error: () => {
            // Fallback: just map existing local favorites
            const current = this.subject.value;
            favorites.forEach(fav => {
              const place = current.find(p => p.backendId === fav.placeId);
              if (place) this.backendIdMap.set(place.id, fav.id);
            });
            this.saveBackendIdMap();
          }
        });
      },
      error: () => {}
    });
  }

  private addToBackend(place: Place): void {
    const userId = this.userId ?? this.readStoredUserId();
    if (!userId) return;

    if (place.backendId) {
      this.postFavorite(userId, place.backendId, place.id);
      return;
    }

    // backendId manquant (cas des résultats IA) : on le résout via l'API
    (this.apiService.getPlaceById(place.id) as Observable<{ id?: number }>).subscribe({
      next: (backendPlace) => {
        const numericId = backendPlace?.id;
        if (!numericId) return;

        // Mettre en cache le backendId pour les opérations futures
        const current = this.subject.value;
        const idx = current.findIndex(p => p.id === place.id);
        if (idx >= 0) {
          current[idx] = { ...current[idx], backendId: numericId };
          this.subject.next([...current]);
          this.save(current);
        }

        this.postFavorite(userId, numericId, place.id);
      },
      error: () => {}
    });
  }

  private postFavorite(userId: number, backendPlaceId: number, frontendPlaceId: string): void {
    (this.apiService.post('/api/favorites', {
      userId,
      placeId: backendPlaceId
    }) as Observable<BackendFavorite>).subscribe({
      next: (fav: BackendFavorite) => {
        if (fav?.id) {
          this.backendIdMap.set(frontendPlaceId, fav.id);
          this.saveBackendIdMap();
        }
      },
      error: () => {}
    });
  }

  private removeFromBackend(placeId: string): void {
    const backendFavId = this.backendIdMap.get(placeId);
    if (!backendFavId) return;

    this.apiService.delete(`/api/favorites/${backendFavId}`).subscribe({
      next: () => {
        this.backendIdMap.delete(placeId);
        this.saveBackendIdMap();
      },
      error: () => {}
    });
  }

  private load(): Place[] {
    try {
      if (typeof localStorage === 'undefined') return [];
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed)
        ? parsed.filter((p): p is Place => !!p && typeof (p as Place).id === 'string')
        : [];
    } catch {
      return [];
    }
  }

  private save(places: Place[]): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(this.storageKey, JSON.stringify(places));
      }
    } catch {}
  }

  private loadBackendIdMap(): Map<string, number> {
    try {
      if (typeof localStorage === 'undefined') return new Map();
      const raw = localStorage.getItem(this.backendMapKey);
      if (!raw) return new Map();
      const obj = JSON.parse(raw) as Record<string, number>;
      return new Map(Object.entries(obj).map(([k, v]) => [k, Number(v)]));
    } catch {
      return new Map();
    }
  }

  private readStoredUserId(): number | null {
    try {
      if (typeof localStorage === 'undefined') return null;
      const raw = localStorage.getItem('userId');
      if (!raw) return null;
      const n = Number(raw);
      return Number.isFinite(n) && n > 0 ? n : null;
    } catch {
      return null;
    }
  }

  private saveBackendIdMap(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        const obj: Record<string, number> = {};
        this.backendIdMap.forEach((v, k) => { obj[k] = v; });
        localStorage.setItem(this.backendMapKey, JSON.stringify(obj));
      }
    } catch {}
  }
}
