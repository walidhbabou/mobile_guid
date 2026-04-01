import { Component } from '@angular/core';
import { NotificationItem } from '../data/tourism.data';
import { PlaceCatalogService } from '../services/place-catalog.service';

@Component({
  selector: 'app-tab4',
  templateUrl: 'tab4.page.html',
  styleUrls: ['tab4.page.scss'],
  standalone: false,
})
export class Tab4Page {
  notifications: NotificationItem[] = [];

  constructor(private placeCatalogService: PlaceCatalogService) {}

  ionViewWillEnter() {
    this.placeCatalogService.getNotifications().subscribe((notifications: NotificationItem[]) => {
      this.notifications = notifications;
    });
  }
}
