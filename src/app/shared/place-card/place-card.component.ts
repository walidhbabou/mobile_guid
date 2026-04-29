import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Place } from '../../data/tourism.data';

export interface PlaceCardMeta {
  tags: string[];
  estimatedBudget: number; // MAD
  avgDurationMinutes: number;
  popularity: number; // 0..1
}

@Component({
  selector: 'app-place-card',
  templateUrl: './place-card.component.html',
  styleUrls: ['./place-card.component.scss'],
  standalone: false,
})
export class PlaceCardComponent {
  @Input() place!: Place;
  @Input() distanceKm?: number;
  @Input() selected = false;
  @Input() favorite = false;
  @Input() meta?: PlaceCardMeta;

  @Output() selectPlace = new EventEmitter<Place>();
  @Output() toggleFavorite = new EventEmitter<Place>();
  @Output() viewOnMap = new EventEmitter<Place>();
  @Output() openRoute = new EventEmitter<Place>();

  onSelect() {
    this.selectPlace.emit(this.place);
  }

  onToggleFavorite(event: Event) {
    event.stopPropagation();
    this.toggleFavorite.emit(this.place);
  }

  onViewOnMap(event: Event) {
    event.stopPropagation();
    this.viewOnMap.emit(this.place);
  }

  onOpenRoute(event: Event) {
    event.stopPropagation();
    this.openRoute.emit(this.place);
  }

  handleImageError() {
    this.place.imageUrl = this.place.fallbackImageUrl && this.place.imageUrl !== this.place.fallbackImageUrl
      ? this.place.fallbackImageUrl
      : undefined;
  }

  get heatColor(): string {
    const value = typeof this.meta?.popularity === 'number' ? this.meta.popularity : 0;
    const p = Math.max(0, Math.min(1, value));
    // Bleu -> Rouge
    const r = Math.round(59 + (239 - 59) * p);
    const g = Math.round(130 + (68 - 130) * p);
    const b = Math.round(246 + (68 - 246) * p);
    return `rgb(${r}, ${g}, ${b})`;
  }

  get popularityLabel(): string {
    const value = this.meta?.popularity;
    if (typeof value !== 'number') {
      return '';
    }
    const percentage = Math.round(Math.max(0, Math.min(1, value)) * 100);
    return `${percentage}%`;
  }
}

