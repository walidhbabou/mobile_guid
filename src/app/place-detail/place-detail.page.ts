import { Location } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Place, Review } from '../data/tourism.data';
import { CoreDataService } from '../services/core-data.service';
import { PlaceCatalogService } from '../services/place-catalog.service';

interface PlaceEditForm {
  name: string;
  location: string;
  category: string;
  address: string;
  description: string;
  imageUrl: string;
}

@Component({
  selector: 'app-place-detail',
  templateUrl: './place-detail.page.html',
  styleUrls: ['./place-detail.page.scss'],
  standalone: false,
})
export class PlaceDetailPage implements OnInit, OnDestroy {
  place: Place | null = null;
  reviews: Review[] = [];
  audioWave: number[] = [];
  isFavorite = false;
  isFavoriteLoading = false;
  favoriteMessage = '';
  isAudioPlaying = false;
  audioStatusMessage = '';
  isEditing = false;
  isSaving = false;
  saveMessage = '';
  reviewRating = 5;
  reviewComment = '';
  reviewMessage = '';
  isSubmittingReview = false;
  editForm: PlaceEditForm = this.buildEmptyEditForm();
  private lastTrackedPlaceId: string | null = null;
  private activeUtterance: SpeechSynthesisUtterance | null = null;

  constructor(
    private route: ActivatedRoute,
    private location: Location,
    private router: Router,
    private coreDataService: CoreDataService,
    private placeCatalogService: PlaceCatalogService
  ) {}

  ngOnInit() {
    this.route.paramMap.subscribe((params) => {
      this.loadPlace(params.get('id') ?? '');
    });
  }

  ngOnDestroy() {
    this.stopAudioGuide(true);
  }

  goBack() {
    if (window.history.length > 1) {
      this.location.back();
      return;
    }

    this.router.navigate(['/tabs/home']);
  }

  toggleFavorite() {
    if (!this.place || this.isFavoriteLoading) {
      return;
    }

    this.favoriteMessage = '';
    this.isFavoriteLoading = true;

    this.coreDataService.toggleFavorite(this.place).subscribe({
      next: (isFavorite: boolean) => {
        this.isFavorite = isFavorite;
        this.favoriteMessage = isFavorite
          ? 'Lieu ajoute a vos favoris.'
          : 'Lieu retire de vos favoris.';
        this.isFavoriteLoading = false;
      },
      error: () => {
        this.favoriteMessage = 'Ce lieu ne peut pas encore etre ajoute aux favoris.';
        this.isFavoriteLoading = false;
      },
    });
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

  startEditing() {
    if (!this.place) {
      return;
    }

    this.isEditing = true;
    this.saveMessage = '';
    this.resetEditForm(this.place);
  }

  cancelEditing() {
    this.isEditing = false;
    this.saveMessage = '';

    if (this.place) {
      this.resetEditForm(this.place);
    }
  }

  savePlaceChanges() {
    if (!this.place || this.isSaving) {
      return;
    }

    const changes = this.buildEditedPlace();

    if (!changes.name || !changes.address || !changes.longDescription) {
      this.saveMessage = 'Le nom, la description et l adresse sont obligatoires.';
      return;
    }

    this.isSaving = true;
    this.saveMessage = '';

    this.placeCatalogService.updatePlace(this.place, changes).subscribe((updatedPlace: Place | null) => {
      this.isSaving = false;

      if (!updatedPlace) {
        this.saveMessage = 'La sauvegarde n a pas abouti. Verifiez que les services de l application sont disponibles.';
        return;
      }

      this.place = updatedPlace;
      this.audioWave = this.placeCatalogService.buildAudioWave(updatedPlace);
      this.resetEditForm(updatedPlace);
      this.isEditing = false;
      this.saveMessage = 'Les informations du lieu ont ete mises a jour.';
    });
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

  handlePlaceImageError() {
    if (!this.place) {
      return;
    }

    this.place.imageUrl = this.place.fallbackImageUrl && this.place.imageUrl !== this.place.fallbackImageUrl
      ? this.place.fallbackImageUrl
      : undefined;
  }

  canEditCurrentPlace(place: Place): boolean {
    return !!((place.externalPlaceId || '').trim() || (place.backendId && place.id.trim()));
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
        this.audioWave = place ? this.placeCatalogService.buildAudioWave(place) : [];
        this.editForm = place ? this.buildEditForm(place) : this.buildEmptyEditForm();

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
    this.audioWave = [];
    this.isFavorite = false;
    this.favoriteMessage = '';
    this.isEditing = false;
    this.isSaving = false;
    this.saveMessage = '';
    this.reviewRating = 5;
    this.reviewComment = '';
    this.reviewMessage = '';
    this.isSubmittingReview = false;
    this.audioStatusMessage = '';
    this.editForm = this.buildEmptyEditForm();
  }

  private loadFavoriteState(place: Place) {
    this.coreDataService.isFavoritePlace(place.backendId).subscribe((isFavorite: boolean) => {
      this.isFavorite = isFavorite;
    });
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

  private buildEditedPlace(): Partial<Place> {
    const normalizedImageUrl = this.editForm.imageUrl.trim();

    return {
      name: this.editForm.name.trim(),
      location: this.editForm.location.trim(),
      category: this.editForm.category.trim(),
      address: this.editForm.address.trim(),
      longDescription: this.editForm.description.trim(),
      imageUrl: normalizedImageUrl || this.place?.fallbackImageUrl,
    };
  }

  private resetEditForm(place: Place) {
    this.editForm = this.buildEditForm(place);
  }

  private buildEditForm(place: Place): PlaceEditForm {
    return {
      name: place.name,
      location: place.location,
      category: place.category,
      address: place.address,
      description: place.longDescription,
      imageUrl: place.imageUrl && place.imageUrl !== place.fallbackImageUrl ? place.imageUrl : '',
    };
  }

  private buildEmptyEditForm(): PlaceEditForm {
    return {
      name: '',
      location: '',
      category: '',
      address: '',
      description: '',
      imageUrl: '',
    };
  }

  private resolveErrorMessage(error: unknown, fallback: string): string {
    const apiError = error as { error?: string; message?: string };

    return apiError?.error || apiError?.message || fallback;
  }
}
