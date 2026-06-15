import { Component, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { Place } from '../data/tourism.data';
import { CompareService } from '../services/compare.service';

@Component({
  selector: 'app-place-compare',
  templateUrl: 'place-compare.page.html',
  styleUrls: ['place-compare.page.scss'],
  standalone: false,
})
export class PlaceComparePage implements OnDestroy {
  places: Place[] = [];
  private sub?: Subscription;

  readonly FALLBACK_IMG = `data:image/svg+xml,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" fill="#E0F2FE"/><path fill="#0EA5E9" d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-1.1 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>'
  )}`;

  readonly rows: Array<{ key: string; label: string; icon: string }> = [
    { key: 'category',  label: 'Catégorie',    icon: 'grid-outline' },
    { key: 'rating',    label: 'Note',          icon: 'star-outline' },
    { key: 'location',  label: 'Ville',         icon: 'location-outline' },
    { key: 'hours',     label: 'Horaires',      icon: 'time-outline' },
    { key: 'address',   label: 'Adresse',       icon: 'map-outline' },
    { key: 'highlights',label: 'Points forts',  icon: 'sparkles-outline' },
  ];

  constructor(
    private compareService: CompareService,
    private router: Router,
  ) {
    this.sub = this.compareService.places$.subscribe(p => (this.places = p));
  }

  ngOnDestroy() { this.sub?.unsubscribe(); }

  getImage(place: Place): string {
    return place.photo_url || place.imageUrl || place.fallbackImageUrl
      || (place.photo_urls && place.photo_urls[0])
      || this.FALLBACK_IMG;
  }

  getStars(rating: number): string {
    if (!rating) return '—';
    const full = Math.round(rating);
    return '★'.repeat(full) + '☆'.repeat(Math.max(0, 5 - full));
  }

  getCellValue(place: Place, key: string): string {
    switch (key) {
      case 'category':  return place.category  || '—';
      case 'rating':    return place.rating ? `${this.getStars(place.rating)}  ${place.rating.toFixed(1)}` : '—';
      case 'location':  return place.city || place.location || '—';
      case 'hours':     return place.hours || '—';
      case 'address':   return place.address || '—';
      case 'highlights':return place.highlights?.slice(0, 3).join(' · ') || '—';
      default:          return '—';
    }
  }

  isBest(key: string, place: Place): boolean {
    if (key !== 'rating' || this.places.length < 2) return false;
    const max = Math.max(...this.places.map(p => p.rating || 0));
    return max > 0 && (place.rating || 0) === max;
  }

  removePlace(place: Place): void {
    this.compareService.remove(place.id);
    if (this.places.length === 0) void this.router.navigate(['/tabs/home']);
  }

  clearAll(): void {
    this.compareService.clear();
    void this.router.navigate(['/tabs/home']);
  }

  goToDetail(place: Place): void {
    void this.router.navigate(['/tabs/place', place.id]);
  }

  goBack(): void {
    history.back();
  }
}
