import { Component } from '@angular/core';
import { Place } from '../data/tourism.data';
import { CoreDataService } from '../services/core-data.service';

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

  constructor(private coreDataService: CoreDataService) {}

  ionViewWillEnter() {
    this.coreDataService.getFavoritePlaces().subscribe((favorites) => {
      const places = favorites.map((favorite) => favorite.place);
      this.favoritePlaces = places;
      this.viewedPlacesCount = places.length;
      this.coveredCitiesCount = new Set(places.map((place: Place) => place.location)).size;
    });
  }

  get latestFavorite(): Place | null {
    return this.favoritePlaces[0] ?? null;
  }

  get favoriteCities(): string[] {
    return Array.from(new Set(
      this.favoritePlaces
        .map((place: Place) => place.location)
        .filter((location: string) => location.trim().length > 0)
    )).slice(0, 4);
  }

  handlePlaceImageError(place: Place) {
    place.imageUrl = place.fallbackImageUrl && place.imageUrl !== place.fallbackImageUrl
      ? place.fallbackImageUrl
      : undefined;
  }
}
