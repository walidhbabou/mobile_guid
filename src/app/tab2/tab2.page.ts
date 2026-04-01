import { Component } from '@angular/core';
import { Place } from '../data/tourism.data';
import { PlaceCatalogService, PlaceMarker } from '../services/place-catalog.service';

@Component({
  selector: 'app-tab2',
  templateUrl: 'tab2.page.html',
  styleUrls: ['tab2.page.scss'],
  standalone: false,
})
export class Tab2Page {
  filters: string[] = [];
  allPlaces: Place[] = [];
  markers: PlaceMarker[] = [];
  selectedFilter = 'Tout';
  selectedPlace: Place | null = null;

  constructor(private placeCatalogService: PlaceCatalogService) {}

  ionViewWillEnter() {
    this.loadMapContent();
  }

  selectFilter(filter: string) {
    this.selectedFilter = filter;
    this.applyFilter();
  }

  selectPlace(place: Place) {
    this.selectedPlace = place;
  }

  private loadMapContent() {
    this.placeCatalogService.getPlaces().subscribe((places: Place[]) => {
      this.allPlaces = places;
      this.filters = this.buildFilters(places);

      if (!this.filters.includes(this.selectedFilter)) {
        this.selectedFilter = this.filters[0] ?? 'Tout';
      }

      this.applyFilter();
    });
  }

  private applyFilter() {
    const filteredPlaces = this.placeCatalogService.filterPlaces(this.allPlaces, this.selectedFilter);
    this.markers = this.placeCatalogService.buildMarkers(filteredPlaces);

    if (!filteredPlaces.length) {
      this.selectedPlace = null;
      return;
    }

    if (!this.selectedPlace || !filteredPlaces.some((place: Place) => place.id === this.selectedPlace?.id)) {
      this.selectedPlace = filteredPlaces[0];
      return;
    }

    this.selectedPlace = filteredPlaces.find((place: Place) => place.id === this.selectedPlace?.id) ?? filteredPlaces[0];
  }

  private buildFilters(places: Place[]): string[] {
    const categories = Array.from(new Set(
      places
        .map((place: Place) => place.category)
        .filter((category: string) => category.trim().length > 0)
    ));

    return ['Tout', ...categories.slice(0, 6)];
  }
}
