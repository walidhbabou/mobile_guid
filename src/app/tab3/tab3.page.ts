import { Component } from '@angular/core';
import { FAVORITE_PLACES } from '../data/tourism.data';

@Component({
  selector: 'app-tab3',
  templateUrl: 'tab3.page.html',
  styleUrls: ['tab3.page.scss'],
  standalone: false,
})
export class Tab3Page {
  readonly favoritePlaces = FAVORITE_PLACES;
}
