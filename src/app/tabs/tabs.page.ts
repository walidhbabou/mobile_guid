import { animate, style, transition, trigger } from '@angular/animations';
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { Place } from '../data/tourism.data';
import { CompareService } from '../services/compare.service';
import { CoreDataService } from '../services/core-data.service';

@Component({
  selector: 'app-tabs',
  templateUrl: 'tabs.page.html',
  styleUrls: ['tabs.page.scss'],
  standalone: false,
  animations: [
    trigger('barSlide', [
      transition(':enter', [
        style({ transform: 'translateY(100%)', opacity: 0 }),
        animate('280ms cubic-bezier(0.2, 0.8, 0.2, 1)', style({ transform: 'translateY(0)', opacity: 1 })),
      ]),
      transition(':leave', [
        animate('200ms ease-in', style({ transform: 'translateY(100%)', opacity: 0 })),
      ]),
    ]),
  ],
})
export class TabsPage {
  notificationCount = 0;

  constructor(
    private coreDataService: CoreDataService,
    private compareService: CompareService,
    private router: Router,
  ) {}

  ionViewWillEnter() {
    this.coreDataService.getNotifications().subscribe(notifications => {
      this.notificationCount = notifications.length;
    });
  }

  get compareCount(): number { return this.compareService.count; }
  get comparePlaces(): Place[] { return this.compareService.places; }

  getThumb(place: Place): string {
    return place.photo_url || place.imageUrl || place.fallbackImageUrl || '';
  }

  removeFromCompare(place: Place): void {
    this.compareService.remove(place.id);
  }

  goToCompare(): void {
    void this.router.navigate(['/tabs/compare']);
  }
}
