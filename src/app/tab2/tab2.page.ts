import { Component } from '@angular/core';
import { MAP_FILTERS, MAP_MARKERS, MAP_PLACES, Place, getPlaceById } from '../data/tourism.data';

@Component({
  selector: 'app-tab2',
  templateUrl: 'tab2.page.html',
  styleUrls: ['tab2.page.scss'],
  standalone: false,
})
export class Tab2Page {
  readonly filters = MAP_FILTERS;
  readonly markers = MAP_MARKERS.map((marker) => ({
    ...marker,
    place: getPlaceById(marker.placeId),
  }));

  selectedFilter = this.filters[0];
  selectedPlace: Place = MAP_PLACES[1];

  selectFilter(filter: string) {
    this.selectedFilter = filter;
  }

  selectPlace(place: Place) {
    this.selectedPlace = place;
  }
}
