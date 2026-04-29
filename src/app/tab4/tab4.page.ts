import { Component } from '@angular/core';
import { NotificationItem } from '../data/tourism.data';
import { CoreDataService } from '../services/core-data.service';

@Component({
  selector: 'app-tab4',
  templateUrl: 'tab4.page.html',
  styleUrls: ['tab4.page.scss'],
  standalone: false,
})
export class Tab4Page {
  notifications: NotificationItem[] = [];

  constructor(private coreDataService: CoreDataService) {}

  ionViewWillEnter() {
    this.coreDataService.getNotifications().subscribe((notifications: NotificationItem[]) => {
      this.notifications = notifications;
    });
  }

  get latestNotification(): NotificationItem | null {
    return this.notifications[0] ?? null;
  }

  get otherNotifications(): NotificationItem[] {
    return this.notifications.slice(1);
  }

  get notificationCount(): number {
    return this.notifications.length;
  }
}
