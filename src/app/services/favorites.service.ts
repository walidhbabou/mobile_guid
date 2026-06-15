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
  private readonly subject = new BehaviorSubject<Place[]>([]);
  private backendIdMap: Map<string, number> = new Map();
  private userId: number | null = null;

  constructor(
    private apiService: ApiService,
    private tokenService: TokenService,
    private placeCatalogService: PlaceCatalogService
  ) {
    // Restaure immediatement depuis le cache local (userId deja stocke d'une
    // session precedente) pour ne pas dependre de l'appel profil async.
    this.userId = this.readStoredUserId();
    if (this.userId) {
      const stored = this.load(this.userId);
      if (stored.length > 0) {
        this.subject.next(stored);
      }
      this.backendIdMap = this.loadBackendIdMap(this.userId);
    }

    if (this.tokenService.isAuthenticated()) {
      this.initUserId();
    }
  }

  /** Identifiant utilisateur courant, avec repli sur le cache local. */
  private resolveUserId(): number | null {
    return this.userId ?? this.readStoredUserId();
  }

  private storageKey(userId: number): string {
    return `favoritePlaces_${userId}`;
  }

  private backendMapKey(userId: number): string {
    return `favoriteBackendIdMap_${userId}`;
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

  clearFavorites(): void {
    this.subject.next([]);
    this.backendIdMap = new Map();
    this.userId = null;
  }

  private initUserId(): void {
    this.apiService.getCurrentUserProfile().subscribe({
      next: (profile: UserProfileResponse) => {
        this.userId = profile.id;
        try { localStorage.setItem('userId', String(profile.id)); } catch {}
        const stored = this.load(profile.id);
        if (stored.length > 0) {
          this.subject.next(stored);
          this.backendIdMap = this.loadBackendIdMap(profile.id);
        }
        this.syncFromBackend();
      },
      error: () => {}
    });
  }

  private syncFromBackend(): void {
    const userId = this.resolveUserId();
    if (!userId) return;

    (this.apiService.get(`/api/favorites/user/${userId}`) as Observable<BackendFavorite[]>).subscribe({
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

  private load(userId: number): Place[] {
    try {
      if (typeof localStorage === 'undefined') return [];
      const raw = localStorage.getItem(this.storageKey(userId));
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
    const userId = this.resolveUserId();
    if (!userId) return;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(this.storageKey(userId), JSON.stringify(places));
      }
    } catch {}
  }

  private loadBackendIdMap(userId: number): Map<string, number> {
    try {
      if (typeof localStorage === 'undefined') return new Map();
      const raw = localStorage.getItem(this.backendMapKey(userId));
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
    const userId = this.resolveUserId();
    if (!userId) return;
    try {
      if (typeof localStorage !== 'undefined') {
        const obj: Record<string, number> = {};
        this.backendIdMap.forEach((v, k) => { obj[k] = v; });
        localStorage.setItem(this.backendMapKey(userId), JSON.stringify(obj));
      }
    } catch {}
  }
}
