import { Component } from '@angular/core';
import { Place } from '../data/tourism.data';
import { PlaceCatalogService } from '../services/place-catalog.service';

@Component({
  selector: 'app-tab3',
  templateUrl: 'tab3.page.html',
  styleUrls: ['tab3.page.scss'],
  standalone: false,
})
export class Tab3Page {
  favoritePlaces: Place[] = [];
  viewedPlacesCount = 0;
  coveredCitiesCount = 0;

  constructor(private placeCatalogService: PlaceCatalogService) {}

  ionViewWillEnter() {
    this.placeCatalogService.getRecentPlaces().subscribe((places: Place[]) => {
      this.favoritePlaces = places;
      this.viewedPlacesCount = places.length;
      this.coveredCitiesCount = new Set(places.map((place: Place) => place.location)).size;
    });
  }
}
