import { Component } from '@angular/core';
import { CoreDataService } from '../services/core-data.service';

@Component({
  selector: 'app-tabs',
  templateUrl: 'tabs.page.html',
  styleUrls: ['tabs.page.scss'],
  standalone: false,
})
export class TabsPage {
  notificationCount = 0;

  constructor(private coreDataService: CoreDataService) {}

  ionViewWillEnter() {
    this.coreDataService.getNotifications().subscribe((notifications) => {
      this.notificationCount = notifications.length;
    });
  }
}
