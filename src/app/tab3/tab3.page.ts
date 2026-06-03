import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { Place } from '../data/tourism.data';
import { FavoritesService } from '../services/favorites.service';

@Component({
  selector: 'app-tab3',
  templateUrl: 'tab3.page.html',
  styleUrls: ['tab3.page.scss'],
  standalone: false,
})
export class Tab3Page implements OnInit, OnDestroy {
  favorites: Place[] = [];
  selectedCategory = 'Tout';
  private sub?: Subscription;

  constructor(
    private favoritesService: FavoritesService,
    private router: Router
  ) {}

  ngOnInit() {
    this.sub = this.favoritesService.favorites$.subscribe(places => {
      this.favorites = places;
    });
  }

  ionViewWillEnter() {
    this.favorites = this.favoritesService.getSnapshot();
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }

  get categories(): string[] {
    const cats = this.favorites.map(p => p.category).filter(Boolean);
    return Array.from(new Set(cats));
  }

  get filteredFavorites(): Place[] {
    if (this.selectedCategory === 'Tout') return this.favorites;
    return this.favorites.filter(p => p.category === this.selectedCategory);
  }

  selectCategory(cat: string) {
    this.selectedCategory = cat;
  }

  onRemoveFavorite(place: Place) {
    this.favoritesService.toggle(place);
  }

  onSelectPlace(place: Place) {
    void this.router.navigate(['/tabs/place', place.id]);
  }

  onViewOnMap(place: Place) {
    void this.router.navigate(['/tabs/map'], {
      queryParams: {
        placeId: place.id,
        name: place.name,
        ...(typeof place.latitude === 'number' ? { latitude: String(place.latitude) } : {}),
        ...(typeof place.longitude === 'number' ? { longitude: String(place.longitude) } : {}),
        ...(place.photo_url ? { photo_url: place.photo_url } : {}),
      },
    });
  }

  onOpenRoute(place: Place) {
    this.onViewOnMap(place);
  }

  trackById(index: number, place: Place) {
    return place.id || index;
  }
}
