import { Location } from '@angular/common';
import { AfterViewInit, Component, ElementRef, NgZone, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import * as L from 'leaflet';
import { Place, Review } from '../data/tourism.data';
import { CoreDataService } from '../services/core-data.service';
import { FavoritesService } from '../services/favorites.service';
import { PlaceCatalogService } from '../services/place-catalog.service';
import { parsePhotoUrls } from '../shared/utils/photo-urls.util';

@Component({
  selector: 'app-place-detail',
  templateUrl: './place-detail.page.html',
  styleUrls: ['./place-detail.page.scss'],
  standalone: false,
})
export class PlaceDetailPage implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('placeMap', { static: false }) private placeMapElement?: ElementRef<HTMLDivElement>;

  place: Place | null = null;
  reviews: Review[] = [];
  photoGallery: string[] = [];
  audioWave: number[] = [];
  isFavorite = false;
  favoriteMessage = '';
  isAudioPlaying = false;
  audioStatusMessage = '';
  reviewRating = 5;
  reviewComment = '';
  reviewMessage = '';
  isSubmittingReview = false;
  isMapLoading = false;
  mapErrorMessage = '';
  private lastTrackedPlaceId: string | null = null;
  private failedDetailImageUrls = new Set<string>();
  readonly FALLBACK_IMAGE = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="rgba(100,116,139,0.25)" d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-1.1 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>')}`;
  private activeUtterance: SpeechSynthesisUtterance | null = null;
  private detailMap: L.Map | null = null;
  private detailMarker: L.Marker | null = null;
  private viewInitialized = false;

  constructor(
    private route: ActivatedRoute,
    private location: Location,
    private router: Router,
    private coreDataService: CoreDataService,
    private favoritesService: FavoritesService,
    private placeCatalogService: PlaceCatalogService,
    private ngZone: NgZone
  ) {}

  ngOnInit() {
    this.route.paramMap.subscribe((params) => {
      this.loadPlace(params.get('id') ?? '');
    });
  }

  ngAfterViewInit() {
    this.viewInitialized = true;
    void this.initializeDetailMap();
  }

  ngOnDestroy() {
    this.stopAudioGuide(true);
    this.detailMarker?.remove();
    this.detailMap?.remove();
  }

  goBack() {
    if (window.history.length > 1) {
      this.location.back();
      return;
    }

    this.router.navigate(['/tabs/home']);
  }

  toggleFavorite() {
    if (!this.place) {
      return;
    }

    this.favoritesService.toggle(this.place);
    this.isFavorite = this.favoritesService.isFavorite(this.place.id);
    this.favoriteMessage = this.isFavorite
      ? 'Lieu ajoute a vos favoris.'
      : 'Lieu retire de vos favoris.';
  }

  toggleAudioGuide() {
    if (!this.place) {
      return;
    }

    if (!this.supportsSpeechSynthesis()) {
      this.audioStatusMessage = this.buildAudioNarration(this.place);
      return;
    }

    if (this.isAudioPlaying) {
      this.stopAudioGuide();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(this.buildAudioNarration(this.place));
    const lang = this.resolveSpeechLanguage(utterance.text);
    const voice = this.pickVoice(lang);

    utterance.lang = lang;
    utterance.rate = 0.96;
    utterance.pitch = 1;

    if (voice) {
      utterance.voice = voice;
    }

    utterance.onstart = () => {
      this.isAudioPlaying = true;
      this.audioStatusMessage = `Lecture audio de ${this.place?.name || 'ce lieu'} en cours.`;
    };

    utterance.onend = () => {
      if (this.activeUtterance !== utterance) {
        return;
      }

      this.activeUtterance = null;
      this.isAudioPlaying = false;
      this.audioStatusMessage = 'Lecture audio terminee.';
    };

    utterance.onerror = () => {
      if (this.activeUtterance !== utterance) {
        return;
      }

      this.activeUtterance = null;
      this.isAudioPlaying = false;
      this.audioStatusMessage = 'La lecture audio n a pas pu demarrer sur cet appareil.';
    };

    this.stopAudioGuide(true);
    this.activeUtterance = utterance;
    window.speechSynthesis.speak(utterance);
  }

  setReviewRating(rating: number) {
    this.reviewRating = rating;
  }

  submitReview() {
    if (!this.place || this.isSubmittingReview) {
      return;
    }

    const normalizedComment = this.reviewComment.trim();

    if (!normalizedComment) {
      this.reviewMessage = 'Ajoutez un commentaire avant d enregistrer votre avis.';
      return;
    }

    this.isSubmittingReview = true;
    this.reviewMessage = '';

    this.coreDataService.savePlaceReview(this.place, this.reviewRating, normalizedComment).subscribe({
      next: () => {
        this.isSubmittingReview = false;
        this.reviewMessage = this.hasExistingOwnReview()
          ? 'Votre avis a ete mis a jour.'
          : 'Votre avis a ete enregistre.';

        if (this.place) {
          this.loadReviews(this.place);
        }
      },
      error: (error: unknown) => {
        this.isSubmittingReview = false;
        this.reviewMessage = this.resolveErrorMessage(error, 'L avis n a pas pu etre enregistre.');
      },
    });
  }

  hasExistingOwnReview(): boolean {
    return this.reviews.some((review: Review) => review.isOwnReview);
  }

  getDetailImageSrc(place: Place): string {
    const seen = new Set<string>();
    const candidates: string[] = [];

    const push = (url?: string) => {
      const trimmed = url?.trim();
      if (trimmed && !seen.has(trimmed)) {
        seen.add(trimmed);
        candidates.push(trimmed);
      }
    };

    push(place.imageUrl);
    push(place.photo_url);
    for (const url of parsePhotoUrls(place.photo_urls)) push(url);
    push(place.fallbackImageUrl);

    return candidates.find(url => !this.failedDetailImageUrls.has(url)) ?? this.FALLBACK_IMAGE;
  }

  handlePlaceImageError(event: Event) {
    const img = event?.target as HTMLImageElement | undefined;
    const failedUrl = img?.currentSrc || img?.src;

    if (!failedUrl || failedUrl.startsWith('data:')) {
      return;
    }

    this.failedDetailImageUrls.add(failedUrl);

    if (this.place && img) {
      const nextSrc = this.getDetailImageSrc(this.place);
      if (nextSrc !== failedUrl) {
        img.src = nextSrc;
      }
    }
  }

  handleGalleryImageError(event: Event) {
    const img = event.target as HTMLImageElement;
    const item = img?.closest('.photo-gallery__item') as HTMLElement | null;
    if (item) {
      item.style.display = 'none';
    }
  }

  private buildPhotoGallery(place: Place | null): string[] {
    if (!place) return [];
    const seen = new Set<string>();
    const photos: string[] = [];
    const push = (url?: string) => {
      const trimmed = url?.trim();
      if (trimmed && !seen.has(trimmed)) {
        seen.add(trimmed);
        photos.push(trimmed);
      }
    };
    push(place.photo_url);
    for (const url of parsePhotoUrls(place.photo_urls)) push(url);
    if (!place.photo_url && !place.photo_urls?.length) push(place.imageUrl);
    return photos;
  }

  hasCoordinates(place: Place | null): boolean {
    return !!place && typeof place.latitude === 'number' && typeof place.longitude === 'number';
  }

  getAudioDurationLabel(place: Place): string {
    const words = this.buildAudioNarration(place).split(/\s+/).filter((segment: string) => segment.length > 0).length;
    const totalSeconds = Math.max(20, Math.round((words / 150) * 60));
    const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const seconds = (totalSeconds % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  }

  buildMapQueryParams(place: Place): Record<string, string> {
    const params: Record<string, string> = {
      placeId: place.id,
      name: place.name,
    };

    if (place.location.trim()) {
      params['location'] = place.location.trim();
    }

    if (place.address.trim()) {
      params['address'] = place.address.trim();
    }

    if (typeof place.latitude === 'number') {
      params['latitude'] = String(place.latitude);
    }

    if (typeof place.longitude === 'number') {
      params['longitude'] = String(place.longitude);
    }

    if (place.category.trim()) {
      params['category'] = place.category.trim();
    }

    if (place.googleMapsUrl?.trim()) {
      params['googleMapsUrl'] = place.googleMapsUrl.trim();
    }

    return params;
  }

  private loadPlace(placeId: string) {
    this.stopAudioGuide(true);
    this.resetViewState();

    this.placeCatalogService.getPlaceById(placeId).subscribe({
      next: (place: Place | null) => {
        this.place = place;
        this.photoGallery = this.buildPhotoGallery(place);
        this.audioWave = place ? this.placeCatalogService.buildAudioWave(place) : [];
        void this.initializeDetailMap();

        if (place) {
          this.placeCatalogService.trackPlaceVisit(place.id);
          this.loadFavoriteState(place);
          this.loadReviews(place);
          this.trackBackendVisit(place);
        }
      },
      error: (error: unknown) => {
        this.place = null;
        this.reviewMessage = this.resolveErrorMessage(error, 'Impossible de charger cette fiche pour le moment.');
      },
    });
  }

  private resetViewState() {
    this.place = null;
    this.reviews = [];
    this.photoGallery = [];
    this.failedDetailImageUrls.clear();
    this.audioWave = [];
    this.isFavorite = false;
    this.favoriteMessage = '';
    this.reviewRating = 5;
    this.reviewComment = '';
    this.reviewMessage = '';
    this.isSubmittingReview = false;
    this.audioStatusMessage = '';
    this.isMapLoading = false;
    this.mapErrorMessage = '';
    this.clearDetailMarker();
  }

  private loadFavoriteState(place: Place) {
    this.isFavorite = this.favoritesService.isFavorite(place.id);
  }

  private loadReviews(place: Place) {
    this.coreDataService.getPlaceReviews(place.backendId).subscribe((reviews: Review[]) => {
      this.reviews = reviews;
      this.prefillOwnReview();

      if (this.place) {
        this.place.reviewsCount = reviews.length;
      }
    });
  }

  private prefillOwnReview() {
    const ownReview = this.reviews.find((review: Review) => review.isOwnReview);

    if (!ownReview) {
      return;
    }

    this.reviewRating = ownReview.ratingValue && ownReview.ratingValue >= 1
      ? ownReview.ratingValue
      : 5;
    this.reviewComment = ownReview.comment;
  }

  private trackBackendVisit(place: Place) {
    if (this.lastTrackedPlaceId === place.id) {
      return;
    }

    this.lastTrackedPlaceId = place.id;
    this.coreDataService.recordPlaceVisit(place).subscribe();
  }

  private stopAudioGuide(silent = false) {
    this.activeUtterance = null;

    if (this.supportsSpeechSynthesis()) {
      window.speechSynthesis.cancel();
    }

    this.isAudioPlaying = false;

    if (!silent) {
      this.audioStatusMessage = 'Lecture audio arretee.';
    }
  }

  private supportsSpeechSynthesis(): boolean {
    return typeof window !== 'undefined'
      && 'speechSynthesis' in window
      && typeof SpeechSynthesisUtterance !== 'undefined';
  }

  private resolveSpeechLanguage(text: string): string {
    return /[\u0600-\u06FF]/.test(text) ? 'ar-MA' : 'fr-FR';
  }

  private pickVoice(language: string): SpeechSynthesisVoice | undefined {
    if (!this.supportsSpeechSynthesis()) {
      return undefined;
    }

    const voices = window.speechSynthesis.getVoices() || [];
    const languagePrefix = language.split('-')[0].toLowerCase();

    return voices.find((voice: SpeechSynthesisVoice) => voice.lang.toLowerCase().startsWith(language.toLowerCase()))
      || voices.find((voice: SpeechSynthesisVoice) => voice.lang.toLowerCase().startsWith(languagePrefix))
      || voices.find((voice: SpeechSynthesisVoice) => voice.lang.toLowerCase().startsWith('fr'))
      || voices[0];
  }

  private buildAudioNarration(place: Place): string {
    const narrationSegments = [
      `Voici la description de ${place.name}.`,
      `${place.name} se trouve a ${place.location}.`,
      place.longDescription,
      place.address ? `Adresse: ${place.address}.` : '',
      place.rating > 0 ? `La note actuelle est ${place.rating.toFixed(1)} sur 5.` : '',
    ];

    return narrationSegments
      .filter((segment: string) => segment.trim().length > 0)
      .join(' ');
  }

  private resolveErrorMessage(error: unknown, fallback: string): string {
    const apiError = error as { error?: string; message?: string };

    return apiError?.error || apiError?.message || fallback;
  }

  private async initializeDetailMap() {
    if (!this.viewInitialized || !this.placeMapElement?.nativeElement) {
      return;
    }

    if (!this.detailMap) {
      this.isMapLoading = true;

      try {
        const mapElement = this.placeMapElement.nativeElement;

        this.ngZone.runOutsideAngular(() => {
          this.detailMap = L.map(mapElement, {
            center: [31.7917, -7.0926],
            zoom: 6,
            zoomControl: true,
          });

          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap contributors',
          }).addTo(this.detailMap as L.Map);
        });

        this.mapErrorMessage = '';
      } catch {
        this.mapErrorMessage = 'La carte Leaflet ne peut pas etre chargee pour le moment.';
      } finally {
        this.isMapLoading = false;
      }
    }

    this.syncDetailMap();

    window.setTimeout(() => {
      this.detailMap?.invalidateSize();
      this.syncDetailMap();
    }, 120);
  }

  private syncDetailMap() {
    if (!this.detailMap) {
      return;
    }

    this.clearDetailMarker();

    if (!this.hasCoordinates(this.place)) {
      this.detailMap.setView([31.7917, -7.0926], 6);
      return;
    }

    const latitude = this.place?.latitude as number;
    const longitude = this.place?.longitude as number;

    this.detailMarker = L.marker([latitude, longitude])
      .addTo(this.detailMap)
      .bindPopup(`<strong>${this.place?.name ?? 'Lieu'}</strong><br>${this.place?.location ?? ''}`);

    this.detailMap.setView([latitude, longitude], 14);
    this.detailMarker.openPopup();
  }

  private clearDetailMarker() {
    this.detailMarker?.remove();
    this.detailMarker = null;
  }
}
