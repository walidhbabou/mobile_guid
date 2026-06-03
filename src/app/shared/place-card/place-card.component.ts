import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { RouterModule } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { Place } from '../../data/tourism.data';
import { parsePhotoUrls } from '../utils/photo-urls.util';

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
  standalone: true,
  imports: [CommonModule, IonicModule, RouterModule],
})
export class PlaceCardComponent implements OnChanges {
  @Input() place!: Place;
  @Input() distanceKm?: number;
  @Input() selected = false;
  @Input() favorite = false;
  @Input() meta?: PlaceCardMeta;

  @Output() selectPlace = new EventEmitter<Place>();
  @Output() toggleFavorite = new EventEmitter<Place>();
  @Output() viewOnMap = new EventEmitter<Place>();
  @Output() openRoute = new EventEmitter<Place>();

  readonly FALLBACK_IMAGE = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="rgba(255,255,255,0.18)" d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-1.1 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>')}`;
  private failedImageUrls = new Set<string>();
  imageLoaded = false;

  constructor() {}

  ngOnChanges(changes: SimpleChanges) {
    if (changes['place']) {
      this.imageLoaded = false;
      this.failedImageUrls.clear();
    }
  }

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

  handleImageError(event?: Event) {
    const img = event?.target as HTMLImageElement | undefined;
    const failedUrl = img?.currentSrc || img?.src;

    if (!failedUrl || failedUrl.startsWith('data:')) {
      return;
    }

    this.imageLoaded = false;
    this.failedImageUrls.add(failedUrl);

    const nextSrc = this.getImageSrc();
    if (img && nextSrc !== failedUrl) {
      img.src = nextSrc;
    }
  }

  onImageLoad() {
    this.imageLoaded = true;
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

  getImageSrc(): string {
    const seen = new Set<string>();
    const candidates: string[] = [];

    const push = (url?: string) => {
      const trimmed = url?.trim();
      if (trimmed && !seen.has(trimmed)) {
        seen.add(trimmed);
        candidates.push(trimmed);
      }
    };

    push(this.place.imageUrl);
    push(this.place.photo_url);
    for (const url of parsePhotoUrls(this.place.photo_urls)) push(url);
    push(this.place.fallbackImageUrl);

    return candidates.find(url => !this.failedImageUrls.has(url)) ?? this.FALLBACK_IMAGE;
  }
}

