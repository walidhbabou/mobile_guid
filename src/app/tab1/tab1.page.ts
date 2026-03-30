import { Component } from '@angular/core';
import { HOME_PLACES, QUICK_FILTERS } from '../data/tourism.data';

@Component({
  selector: 'app-tab1',
  templateUrl: 'tab1.page.html',
  styleUrls: ['tab1.page.scss'],
  standalone: false,
})
export class Tab1Page {
  userName = 'Sophie';
  readonly featuredPlaces = HOME_PLACES;
  readonly quickFilters = QUICK_FILTERS;

  ionViewWillEnter() {
    this.userName = localStorage.getItem('userName') || 'Sophie';
  }
}
