import { Component } from '@angular/core';
import { ProfileAction, ProfileStat } from '../data/tourism.data';
import { AuthService } from '../services/auth.service';
import { PlaceCatalogService } from '../services/place-catalog.service';

@Component({
  selector: 'app-tab5',
  templateUrl: 'tab5.page.html',
  styleUrls: ['tab5.page.scss'],
  standalone: false,
})
export class Tab5Page {
  userName = 'Sophie Dubois';
  userEmail = 'sophie@guide.ma';
  userInitial = 'S';
  profileStats: ProfileStat[] = [];
  profileActions: ProfileAction[] = [];
  profileBadges: string[] = [];

  constructor(
    private authService: AuthService,
    private placeCatalogService: PlaceCatalogService
  ) {}

  ionViewWillEnter() {
    this.userName = localStorage.getItem('userName') || 'Sophie Dubois';
    this.userEmail = localStorage.getItem('userEmail') || 'sophie@guide.ma';
    this.userInitial = this.userName.charAt(0).toUpperCase() || 'S';
    this.loadProfileOverview();
  }

  logout() {
    this.authService.logout();
  }

  private loadProfileOverview() {
    this.placeCatalogService.getProfileOverview().subscribe((overview) => {
      this.profileStats = overview.stats;
      this.profileActions = overview.actions;
      this.profileBadges = overview.badges;
    });
  }
}
