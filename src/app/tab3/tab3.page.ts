import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { Place } from '../data/tourism.data';
import { CompareService } from '../services/compare.service';
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
  searchQuery = '';
  private sub?: Subscription;

  constructor(
    private favoritesService: FavoritesService,
    private compareService: CompareService,
    private router: Router,
  ) {}

  isInCompare(place: Place): boolean {
    return this.compareService.isSelected(place.id);
  }

  onToggleCompare(place: Place): void {
    this.compareService.toggle(place);
  }

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

  get displayedFavorites(): Place[] {
    const base = this.filteredFavorites;
    const q = this.searchQuery.trim().toLowerCase();
    if (!q) return base;
    return base.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.category || '').toLowerCase().includes(q) ||
      (p.location || '').toLowerCase().includes(q)
    );
  }

  selectCategory(cat: string) {
    this.selectedCategory = cat;
  }

  onSearchInput(event: Event) {
    this.searchQuery = (event.target as HTMLInputElement).value;
  }

  getCategoryKey(category: string): string {
    const c = (category || '').toLowerCase();
    if (c.includes('patrimoine') || c.includes('monument') || c.includes('historique')) return 'patrimoine';
    if (c.includes('café') || c.includes('cafe') || c.includes('coffee') || c.includes('thé')) return 'cafe';
    if (c.includes('parc') || c.includes('jardin') || c.includes('nature')) return 'parc';
    if (c.includes('restaurant') || c.includes('cuisine') || c.includes('gastronomie')) return 'restaurant';
    return 'default';
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
