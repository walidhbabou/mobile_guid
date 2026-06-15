import { Injectable } from '@angular/core';
import { Observable, combineLatest, forkJoin, of, throwError } from 'rxjs';
import { catchError, map, switchMap, take } from 'rxjs/operators';
import { NotificationItem, Place, ProfileAction, ProfileStat, Review } from '../data/tourism.data';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { PlaceCatalogService } from './place-catalog.service';

export interface FavoriteRecord {
  id: number;
  userId: number;
  placeId: number;
  createdAt?: string;
}

export interface HistoryRecord {
  id: number;
  userId: number;
  placeId: number;
  action?: string;
  visitedAt?: string;
}

export interface ReviewRecord {
  id: number;
  userId: number;
  placeId: number;
  comment: string;
  rating: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CategoryRecord {
  id: number;
  name: string;
  description?: string;
}

export interface FavoritePlaceRecord {
  relationId: number;
  createdAt?: string;
  place: Place;
}

export interface HistoryPlaceRecord {
  relationId: number;
  action?: string;
  visitedAt?: string;
  place: Place;
}

export interface ProfileOverview {
  stats: ProfileStat[];
  actions: ProfileAction[];
  badges: string[];
}

@Injectable({
  providedIn: 'root'
})
export class CoreDataService {
  constructor(
    private apiService: ApiService,
    private authService: AuthService,
    private placeCatalogService: PlaceCatalogService
  ) {}

  getCategoryLabels(limit = 6): Observable<string[]> {
    return combineLatest([
      this.getCategories(),
      this.placeCatalogService.getPlaces(),
    ]).pipe(
      map(([categories, places]: [CategoryRecord[], Place[]]) => {
        const backendCategories = categories
          .map((category: CategoryRecord) => category.name?.trim())
          .filter((name: string | undefined): name is string => !!name);

        if (backendCategories.length > 0) {
          return backendCategories.slice(0, limit);
        }

        return Array.from(new Set(
          places
            .map((place: Place) => place.category.trim())
            .filter((category: string) => category.length > 0)
        )).slice(0, limit);
      })
    );
  }

  getFavoritePlaces(): Observable<FavoritePlaceRecord[]> {
    return forkJoin({
      favorites: this.getFavorites(),
      places: this.placeCatalogService.getPlaces(),
    }).pipe(
      map(({ favorites, places }: { favorites: FavoriteRecord[]; places: Place[] }) => {
        return favorites.reduce((items: FavoritePlaceRecord[], favorite: FavoriteRecord) => {
            const place = this.findPlaceByBackendId(places, favorite.placeId);

            if (!place) {
              return items;
            }

            items.push({
              relationId: favorite.id,
              createdAt: favorite.createdAt,
              place,
            });

            return items;
          }, []);
      })
    );
  }

  getHistoryPlaces(limit = 12): Observable<HistoryPlaceRecord[]> {
    return forkJoin({
      history: this.getHistory(),
      places: this.placeCatalogService.getPlaces(),
    }).pipe(
      map(({ history, places }: { history: HistoryRecord[]; places: Place[] }) => {
        return history.reduce((items: HistoryPlaceRecord[], entry: HistoryRecord) => {
            const place = this.findPlaceByBackendId(places, entry.placeId);

            if (!place) {
              return items;
            }

            items.push({
              relationId: entry.id,
              action: entry.action,
              visitedAt: entry.visitedAt,
              place,
            });

            return items;
          }, []).slice(0, limit);
      })
    );
  }

  getPlaceReviews(placeBackendId?: number): Observable<Review[]> {
    if (!this.hasValidSession() || !this.isValidIdentifier(placeBackendId)) {
      return of([]);
    }

    return this.apiService.get(`/api/core/reviews/place/${placeBackendId}`).pipe(
      map((response: unknown) => this.normalizeReviewList(response)),
      catchError(() => of([]))
    );
  }

  savePlaceReview(place: Place, rating: number, comment: string): Observable<ReviewRecord> {
    if (!this.isValidIdentifier(place.backendId)) {
      return throwError(() => new Error('Ce lieu ne peut pas encore recevoir d avis.'));
    }

    const normalizedComment = comment.trim();

    if (!normalizedComment) {
      return throwError(() => new Error('Le commentaire est obligatoire.'));
    }

    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return throwError(() => new Error('La note doit etre comprise entre 1 et 5.'));
    }

    return this.withCurrentUserId((userId: number) => this.apiService.post('/api/core/reviews', {
      userId,
      placeId: place.backendId,
      comment: normalizedComment,
      rating,
    })).pipe(
      map((response: unknown) => {
        const review = this.normalizeReviewRecord(response);

        if (!review) {
          throw new Error('La sauvegarde de l avis a echoue.');
        }

        return review;
      })
    );
  }

  isFavoritePlace(placeBackendId?: number): Observable<boolean> {
    if (!this.isValidIdentifier(placeBackendId)) {
      return of(false);
    }

    return this.getFavorites().pipe(
      map((favorites: FavoriteRecord[]) => favorites.some((favorite: FavoriteRecord) => favorite.placeId === placeBackendId))
    );
  }

  toggleFavorite(place: Place): Observable<boolean> {
    if (!this.isValidIdentifier(place.backendId)) {
      return throwError(() => new Error('Ce lieu n est pas encore disponible pour les favoris.'));
    }

    return this.getFavorites().pipe(
      take(1),
      switchMap((favorites: FavoriteRecord[]) => {
        const existingFavorite = favorites.find((favorite: FavoriteRecord) => favorite.placeId === place.backendId);

        if (existingFavorite) {
          return this.apiService.delete(`/api/core/favorites/${existingFavorite.id}`).pipe(
            map(() => false)
          );
        }

        return this.withCurrentUserId((userId: number) => this.apiService.post('/api/core/favorites', {
          userId,
          placeId: place.backendId,
        })).pipe(
          map(() => true)
        );
      })
    );
  }

  recordPlaceVisit(place: Place, action = 'view'): Observable<HistoryRecord | null> {
    if (!this.isValidIdentifier(place.backendId)) {
      return of(null);
    }

    return this.withCurrentUserId((userId: number) => this.apiService.post('/api/core/history', {
      userId,
      placeId: place.backendId,
      action,
    })).pipe(
      map((response: unknown) => this.normalizeHistoryRecord(response)),
      catchError(() => of(null))
    );
  }

  getNotifications(): Observable<NotificationItem[]> {
    return forkJoin({
      favorites: this.getFavoritePlaces(),
      history: this.getHistoryPlaces(30),
    }).pipe(
      map(({ favorites, history }) => {
        const items: Array<{ notif: NotificationItem; date?: string }> = [];

        favorites.forEach(fav => {
          items.push({
            notif: {
              icon: 'heart-outline',
              title: 'Lieu enregistre',
              description: `${fav.place.name} a ete ajoute a vos favoris.`,
              time: this.formatRelativeTime(fav.createdAt) || 'Recent',
              tone: 'primary',
            },
            date: fav.createdAt,
          });
        });

        history.forEach(entry => {
          items.push({
            notif: {
              icon: 'time-outline',
              title: 'Lieu visite',
              description: `${entry.place.name} a ete consulte.`,
              time: this.formatRelativeTime(entry.visitedAt) || 'Recent',
              tone: 'secondary',
            },
            date: entry.visitedAt,
          });
        });

        items.sort((a, b) => this.compareDates(b.date, a.date));

        return items.map(i => i.notif);
      }),
      catchError(() => of([]))
    );
  }

  getProfileOverview(): Observable<ProfileOverview> {
    return forkJoin({
      favorites: this.getFavoritePlaces(),
      history: this.getHistoryPlaces(12),
      categories: this.getCategories(),
      places: this.placeCatalogService.getPlaces(),
    }).pipe(
      map(({ favorites, history, categories, places }) => {
        const favoritePlaces = favorites.map((item: FavoritePlaceRecord) => item.place);
        const historyPlaces = history.map((item: HistoryPlaceRecord) => item.place);
        const distinctPlaces = this.uniquePlaces([...favoritePlaces, ...historyPlaces]);
        const distinctCities = Array.from(new Set(distinctPlaces.map((place: Place) => place.location)));
        const stats: ProfileStat[] = [
          {
            label: 'Favoris',
            value: String(favorites.length),
          },
          {
            label: 'Historique',
            value: String(history.length),
          },
          {
            label: 'Categories',
            value: String(categories.length || new Set(places.map((place: Place) => place.category)).size),
          },
        ];
        const actions: ProfileAction[] = [];

        if (favoritePlaces[0]) {
          actions.push({
            icon: 'heart-outline',
            title: 'Dernier favori',
            subtitle: `${favoritePlaces[0].name} à ${favoritePlaces[0].location}`,
            link: '/tabs/favorites',
          });
        }

        if (historyPlaces[0]) {
          actions.push({
            icon: 'time-outline',
            title: 'Dernière visite',
            subtitle: `${historyPlaces[0].name} — disponible dans votre parcours récent`,
            link: '/tabs/home',
          });
        }

        actions.push({
          icon: 'earth-outline',
          title: 'Villes explorées',
          subtitle: `${distinctCities.length} villes différentes dans votre univers de voyage`,
          link: '/tabs/map',
        });

        return {
          stats,
          actions,
          badges: this.buildProfileBadges(categories, distinctPlaces, places),
        };
      })
    );
  }

  private getFavorites(): Observable<FavoriteRecord[]> {
    return this.withCurrentUserId((userId: number) => this.apiService.get(`/api/core/favorites/user/${userId}`)).pipe(
      map((response: unknown) => this.normalizeFavoriteList(response)),
      catchError(() => of([]))
    );
  }

  private getHistory(): Observable<HistoryRecord[]> {
    return this.withCurrentUserId((userId: number) => this.apiService.get(`/api/core/history/user/${userId}`)).pipe(
      map((response: unknown) => this.normalizeHistoryList(response)),
      catchError(() => of([]))
    );
  }

  private getCategories(): Observable<CategoryRecord[]> {
    if (!this.hasValidSession()) {
      return of([]);
    }

    return this.apiService.get('/api/core/categories').pipe(
      map((response: unknown) => this.normalizeCategoryList(response)),
      catchError(() => of([]))
    );
  }

  private withCurrentUserId<T>(work: (userId: number) => Observable<T>): Observable<T> {
    if (!this.hasValidSession()) {
      return throwError(() => new Error('Utilisateur non authentifie.'));
    }

    return this.authService.resolveCurrentUserId().pipe(
      take(1),
      switchMap((userId: number | null) => {
        if (!this.isValidIdentifier(userId)) {
          return throwError(() => new Error('Utilisateur non authentifie.'));
        }

        return work(userId);
      })
    );
  }

  private hasValidSession(): boolean {
    return this.authService.isAuthenticated();
  }

  private normalizeFavoriteList(response: unknown): FavoriteRecord[] {
    if (!Array.isArray(response)) {
      return [];
    }

    return response
      .map((item: unknown) => this.normalizeFavoriteRecord(item))
      .filter((item: FavoriteRecord | null): item is FavoriteRecord => item !== null)
      .sort((left: FavoriteRecord, right: FavoriteRecord) => this.compareDates(right.createdAt, left.createdAt));
  }

  private normalizeHistoryList(response: unknown): HistoryRecord[] {
    if (!Array.isArray(response)) {
      return [];
    }

    return response
      .map((item: unknown) => this.normalizeHistoryRecord(item))
      .filter((item: HistoryRecord | null): item is HistoryRecord => item !== null)
      .sort((left: HistoryRecord, right: HistoryRecord) => this.compareDates(right.visitedAt, left.visitedAt));
  }

  private normalizeCategoryList(response: unknown): CategoryRecord[] {
    if (!Array.isArray(response)) {
      return [];
    }

    return response.reduce((categories: CategoryRecord[], item: unknown) => {
      if (!item || typeof item !== 'object') {
        return categories;
      }

      const record = item as Record<string, unknown>;
      const id = this.readNumber(record['id']);
      const name = this.readString(record['name']);

      if (!this.isValidIdentifier(id) || !name) {
        return categories;
      }

      categories.push({
        id,
        name,
        description: this.readString(record['description']),
      });

      return categories;
    }, []);
  }

  private normalizeFavoriteRecord(item: unknown): FavoriteRecord | null {
    if (!item || typeof item !== 'object') {
      return null;
    }

    const record = item as Record<string, unknown>;
    const id = this.readNumber(record['id']);
    const userId = this.readNumber(record['userId']);
    const placeId = this.readNumber(record['placeId']);

    if (!this.isValidIdentifier(id) || !this.isValidIdentifier(userId) || !this.isValidIdentifier(placeId)) {
      return null;
    }

    return {
      id,
      userId,
      placeId,
      createdAt: this.readString(record['createdAt']),
    };
  }

  private normalizeHistoryRecord(item: unknown): HistoryRecord | null {
    if (!item || typeof item !== 'object') {
      return null;
    }

    const record = item as Record<string, unknown>;
    const id = this.readNumber(record['id']);
    const userId = this.readNumber(record['userId']);
    const placeId = this.readNumber(record['placeId']);

    if (!this.isValidIdentifier(id) || !this.isValidIdentifier(userId) || !this.isValidIdentifier(placeId)) {
      return null;
    }

    return {
      id,
      userId,
      placeId,
      action: this.readString(record['action']),
      visitedAt: this.readString(record['visitedAt']),
    };
  }

  private normalizeReviewList(response: unknown): Review[] {
    if (!Array.isArray(response)) {
      return [];
    }

    return response
      .map((item: unknown) => this.normalizeReviewRecord(item))
      .filter((review: ReviewRecord | null): review is ReviewRecord => review !== null)
      .sort((left: ReviewRecord, right: ReviewRecord) => this.compareDates(right.updatedAt || right.createdAt, left.updatedAt || left.createdAt))
      .map((review: ReviewRecord, index: number) => this.mapReviewRecordToCard(review, index));
  }

  private findPlaceByBackendId(places: Place[], placeBackendId: number): Place | undefined {
    return places.find((place: Place) => place.backendId === placeBackendId);
  }

  private uniquePlaces(places: Place[]): Place[] {
    const seenIds = new Set<string>();

    return places.filter((place: Place) => {
      if (seenIds.has(place.id)) {
        return false;
      }

      seenIds.add(place.id);
      return true;
    });
  }

  private buildProfileBadges(categories: CategoryRecord[], distinctPlaces: Place[], places: Place[]): string[] {
    const categoryBadges = categories
      .map((category: CategoryRecord) => category.name)
      .filter((name: string) => name.trim().length > 0);

    if (categoryBadges.length > 0) {
      return categoryBadges.slice(0, 3);
    }

    const sourcePlaces = distinctPlaces.length > 0 ? distinctPlaces : places;
    return Array.from(new Set(sourcePlaces.map((place: Place) => place.category))).slice(0, 3);
  }

  private buildAuthorLabel(userId: number | null | undefined, index: number): string {
    if (this.isValidIdentifier(userId)) {
      return `Voyageur ${userId}`;
    }

    return `Voyageur ${index + 1}`;
  }

  private buildStarsLabel(rating: number): string {
    if (!Number.isFinite(rating) || rating <= 0) {
      return 'Nouveau';
    }

    return '\u2605'.repeat(Math.max(1, Math.min(5, Math.round(rating))));
  }

  private formatRelativeTime(value?: string): string | undefined {
    if (!value) {
      return undefined;
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return undefined;
    }

    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
    });
  }

  private readString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
  }

  private readNumber(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string' && value.trim().length > 0) {
      const parsedValue = Number(value);
      return Number.isFinite(parsedValue) ? parsedValue : undefined;
    }

    return undefined;
  }

  private isValidIdentifier(value?: number | null): value is number {
    return typeof value === 'number' && Number.isFinite(value) && value > 0;
  }

  private compareDates(left?: string, right?: string): number {
    const leftTimestamp = left ? new Date(left).getTime() : 0;
    const rightTimestamp = right ? new Date(right).getTime() : 0;

    return leftTimestamp - rightTimestamp;
  }

  private normalizeReviewRecord(item: unknown): ReviewRecord | null {
    if (!item || typeof item !== 'object') {
      return null;
    }

    const record = item as Record<string, unknown>;
    const id = this.readNumber(record['id']);
    const userId = this.readNumber(record['userId']);
    const placeId = this.readNumber(record['placeId']);
    const comment = this.readString(record['comment']);
    const rating = this.readNumber(record['rating']);

    if (
      !this.isValidIdentifier(id)
      || !this.isValidIdentifier(userId)
      || !this.isValidIdentifier(placeId)
      || !comment
      || typeof rating !== 'number'
    ) {
      return null;
    }

    return {
      id,
      userId,
      placeId,
      comment,
      rating,
      createdAt: this.readString(record['createdAt']),
      updatedAt: this.readString(record['updatedAt']),
    };
  }

  private mapReviewRecordToCard(review: ReviewRecord, index: number): Review {
    const currentUserId = this.authService.getStoredUserId();
    const isOwnReview = this.isValidIdentifier(currentUserId) && currentUserId === review.userId;
    const authorLabel = isOwnReview ? 'Vous' : this.buildAuthorLabel(review.userId, index);
    const roleLabel = isOwnReview ? 'Votre avis' : 'Avis voyageur';

    return {
      id: review.id,
      userId: review.userId,
      author: authorLabel,
      role: roleLabel,
      ratingLabel: this.buildStarsLabel(review.rating),
      ratingValue: review.rating,
      comment: review.comment,
      likes: 0,
      replies: 0,
      avatar: authorLabel.charAt(0).toUpperCase(),
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
      isOwnReview,
    };
  }
}
