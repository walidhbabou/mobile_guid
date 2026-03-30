import { Component } from '@angular/core';
import { PROFILE_ACTIONS, PROFILE_STATS } from '../data/tourism.data';

@Component({
  selector: 'app-tab5',
  templateUrl: 'tab5.page.html',
  styleUrls: ['tab5.page.scss'],
  standalone: false,
})
export class Tab5Page {
  userName = 'Sophie Dubois';
  userEmail = 'sophie@guide.ma';
  readonly profileStats = PROFILE_STATS;
  readonly profileActions = PROFILE_ACTIONS;
  readonly profileBadges = ['Culture', 'Famille', 'Audio guide'];

  ionViewWillEnter() {
    this.userName = localStorage.getItem('userName') || 'Sophie Dubois';
    this.userEmail = localStorage.getItem('userEmail') || 'sophie@guide.ma';
  }

  logout() {
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('userName');
    localStorage.removeItem('userEmail');
  }
}
