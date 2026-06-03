import { Component, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { Place } from '../data/tourism.data';
import { AiGuideCard, AiPlaceSearchExperience, AiPlaceSearchResult } from '../models/ai-place.model';
import { AiPlaceService } from '../services/ai-place.service';
import { CoreDataService } from '../services/core-data.service';
import { FavoritesService } from '../services/favorites.service';
import { PlaceCatalogService } from '../services/place-catalog.service';
import { UserLocationService } from '../services/user-location.service';
import { parsePhotoUrls } from '../shared/utils/photo-urls.util';

interface MapQueryParams {
  placeId?: string;
  name?: string;
  location?: string;
  address?: string;
  latitude?: string;
  longitude?: string;
  category?: string;
  googleMapsUrl?: string;
  imageUrl?: string;
  fallbackImageUrl?: string;
  photo_url?: string;
  photo_urls?: string;
}

@Component({
  selector: 'app-tab1',
  templateUrl: 'tab1.page.html',
  styleUrls: ['tab1.page.scss'],
  standalone: false,
})
export class Tab1Page implements OnDestroy {
  userName = 'Sophie';
  searchQuery = '';
  isSearching = false;
  isRecordingAudio = false;
  hasSearched = false;
  audioSearchMessage = '';
  searchLocationMessage = '';
  searchResults: AiPlaceSearchResult[] = [];
  searchMode: 'ai' | 'fallback' | 'idle' = 'idle';
  searchExperience: AiPlaceSearchExperience | null = null;
  isNarrationExpanded = false;
  featuredPlaces: Place[] = [];
  quickFilters: string[] = [];
  selectedQuickFilter = 'Tout';
  highlightPlace: Place | null = null;
  notificationCount = 0;
  readonly defaultSuggestedPrompts = [
    'plage calme a Agadir',
    'sortie famille a Rabat',
    'ville culturelle pour photos',
    'lieu romantique au coucher de soleil',
  ];
  readonly FALLBACK_IMAGE = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="rgba(255,255,255,0.18)" d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-1.1 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>')}`;
  highlightImageLoaded = false;
  private favoriteIds = new Set<string>();
  private favSub?: Subscription;
  private failedImageUrls = new Set<string>();
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private audioStream: MediaStream | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private speechRecognition: any | null = null;

  constructor(
    private aiPlaceService: AiPlaceService,
    private placeCatalogService: PlaceCatalogService,
    private coreDataService: CoreDataService,
    private userLocationService: UserLocationService,
    private favoritesService: FavoritesService,
    private router: Router
  ) {}

  ionViewWillEnter() {
    this.userName = localStorage.getItem('userName') || 'Sophie';
    this.loadHomeContent();
    this.favSub = this.favoritesService.favorites$.subscribe(places => {
      this.favoriteIds = new Set(places.map(p => p.id));
    });
  }

  ionViewWillLeave() {
    this.favSub?.unsubscribe();
  }

  ngOnDestroy() {
    this.favSub?.unsubscribe();
    this.resetAudioCapture();
  }

  get userInitial(): string {
    return this.userName.charAt(0).toUpperCase() || 'U';
  }

  get canUseAudioSearch(): boolean {
    if (typeof window === 'undefined') return false;
    const hasSpeechApi = !!(
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    );
    const hasMediaRecorder = typeof navigator !== 'undefined'
      && !!navigator.mediaDevices?.getUserMedia
      && typeof MediaRecorder !== 'undefined';
    return hasSpeechApi || hasMediaRecorder;
  }

  private get speechRecognitionClass(): any | null {
    if (typeof window === 'undefined') return null;
    return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
  }

  get homeStats(): Array<{ value: string; label: string }> {
    return [
      {
        value: String(this.featuredPlaces.length).padStart(2, '0'),
        label: 'escales fortes',
      },
      {
        value: String(this.quickFilters.length).padStart(2, '0'),
        label: 'ambiances en vue',
      },
      {
        value: String(this.notificationCount).padStart(2, '0'),
        label: 'alertes utiles',
      },
    ];
  }

  get featuredCities(): string[] {
    return Array.from(new Set(
      this.featuredPlaces
        .map((place: Place) => place.location)
        .filter((location: string) => location.trim().length > 0)
    )).slice(0, 3);
  }

  get spotlightPlace(): Place | null {
    return this.highlightPlace ?? this.featuredPlaces[0] ?? null;
  }

  get homeSelectionSummary(): string {
    if (this.hasSearched) {
      return this.searchResultSummary;
    }

    if (this.featuredPlaces.length) {
      return `${this.featuredPlaces.length} résultats · ajustés selon votre position`;
    }

    return 'Suggestions locales ajustées selon votre position';
  }

  get previewHighlights(): string[] {
    if (this.searchResults.length) {
      return this.searchResults.slice(0, 2).map((result: AiPlaceSearchResult) => {
        if (typeof result.distanceKm === 'number') {
          return `${result.name} (${result.distanceKm.toFixed(1)} km)`;
        }

        return `${result.name}${result.location ? ` · ${result.location}` : ''}`;
      });
    }

    return this.featuredPlaces.slice(0, 2).map((place: Place) => {
      return `${place.name}${place.location ? ` · ${place.location}` : ''}`;
    });
  }

  get resultSectionTitle(): string {
    return this.searchMode === 'ai' ? 'Selection sur mesure' : 'Suggestions proches';
  }

  get searchResultSummary(): string {
    if (!this.hasSearched) {
      return '';
    }

    if (this.searchResults.length === 0) {
      return 'Aucune adresse n a encore ete trouvee pour cette envie. Essayez une formulation plus simple ou plus locale.';
    }

    return this.searchMode === 'ai'
      ? `${this.displayedResultsCount} proposition(s) composee(s) pour votre demande.`
      : `${this.displayedResultsCount} piste(s) locales proches de votre recherche sont affichees.`;
  }

  get displayedResultsCount(): number {
    const experienceCount = this.searchExperience?.resultsCount;

    if (typeof experienceCount === 'number' && Number.isFinite(experienceCount) && experienceCount > 0) {
      return Math.max(experienceCount, this.searchResults.length);
    }

    return this.searchResults.length;
  }

  get searchExperienceTitle(): string {
    const city = this.searchExperience?.city?.trim();
    const category = this.searchExperience?.category?.trim();

    if (city && category) {
      return `${category} a ${city}`;
    }

    if (category) {
      return category;
    }

    if (city) {
      return city;
    }

    return 'Resultats de recherche';
  }

  get searchNarration(): string {
    return this.searchExperience?.assistantReply || this.searchExperience?.message || '';
  }

  get displayedNarration(): string {
    if (this.isNarrationExpanded || this.searchNarration.length <= 220) {
      return this.searchNarration;
    }
    return this.searchNarration.slice(0, 220).trim() + '…';
  }

  async searchWithAi() {
    const query = this.searchQuery.trim();

    if (!query) {
      this.clearSearch();
      return;
    }

    this.isSearching = true;
    this.hasSearched = true;
    this.audioSearchMessage = '';
    this.searchLocationMessage = 'Verification de votre position pour affiner la recherche...';

    const locationOptions = await this.resolveSearchLocationOptions();

    this.aiPlaceService.search(query, locationOptions).subscribe({
      next: (experience: AiPlaceSearchExperience) => {
        this.highlightImageLoaded = false;
        this.searchExperience = experience;
        this.searchResults = experience.results;
        this.searchMode = experience.source;
        this.isSearching = false;
        this.searchLocationMessage = ''; // Clear loading message on success
      },
      error: (error: any) => {
        console.error('Search error:', error);
        this.searchExperience = null;
        this.searchResults = [];
        this.searchMode = 'fallback';
        this.isSearching = false;
        
        // Show error message to user
        if (error?.status === 403) {
          this.searchLocationMessage = 'Accès refusé au serveur. Veuillez réessayer dans quelques instants.';
        } else if (error?.status === 0 || error?.status === 'SERVER_UNAVAILABLE') {
          this.searchLocationMessage = 'Impossible de connecter au serveur. Vérifiez votre connexion internet.';
        } else {
          this.searchLocationMessage = 'Erreur lors de la recherche. Veuillez réessayer.';
        }
        
        // Clear message after 5 seconds
        setTimeout(() => {
          this.searchLocationMessage = '';
        }, 5000);
      },
    });
  }

  async toggleAudioSearch() {
    if (this.isRecordingAudio) {
      this.stopAudioRecording();
      return;
    }

    if (this.isSearching) {
      return;
    }

    await this.startAudioRecording();
  }

  useSuggestedPrompt(prompt: string) {
    this.searchQuery = prompt;
    void this.searchWithAi();
  }

  useQuickFilter(filter: string) {
    this.selectedQuickFilter = filter;

    if (filter === 'Tout') {
      this.clearSearch();
      return;
    }

    this.searchQuery = filter;
    void this.searchWithAi();
  }

  clearSearch() {
    this.searchQuery = '';
    this.searchExperience = null;
    this.searchResults = [];
    this.hasSearched = false;
    this.searchMode = 'idle';
    this.isSearching = false;
    this.audioSearchMessage = '';
    this.searchLocationMessage = '';
    this.selectedQuickFilter = 'Tout';
    this.highlightImageLoaded = false;
    this.isNarrationExpanded = false;
    this.failedImageUrls.clear();
    this.resetAudioCapture();
  }

  onHighlightImageLoad() {
    this.highlightImageLoaded = true;
  }

  handleImageError(
    event: Event,
    entity?: { imageUrl?: string; photo_url?: string; photo_urls?: string[] | string; fallbackImageUrl?: string }
  ) {
    const img = event.target as HTMLImageElement;
    const failedUrl = img?.currentSrc || img?.src;

    if (!failedUrl || failedUrl.startsWith('data:')) {
      return;
    }

    this.highlightImageLoaded = false;
    this.failedImageUrls.add(failedUrl);

    const nextSrc = this.getImageSrc(entity);
    if (nextSrc !== failedUrl) {
      img.src = nextSrc;
    }
  }

  useGuideCard(card: AiGuideCard) {
    this.searchQuery = card.query || card.title;
    void this.searchWithAi();
  }

  buildMapQueryParamsForResult(result: AiPlaceSearchResult): MapQueryParams {
    return this.buildMapQueryParams({
      placeId: result.routeId || result.id,
      name: result.name,
      location: result.location,
      address: result.address,
      latitude: result.latitude,
      longitude: result.longitude,
      category: result.category,
      googleMapsUrl: result.googleMapsUrl,
      imageUrl: result.imageUrl,
      fallbackImageUrl: result.fallbackImageUrl,
      photo_url: result.photo_url,
      photo_urls: result.photo_urls ? JSON.stringify(result.photo_urls) : undefined,
    });
  }

  buildMapQueryParamsForPlace(place: Place): MapQueryParams {
    return this.buildMapQueryParams({
      placeId: place.id,
      name: place.name,
      location: place.location,
      address: place.address,
      category: place.category,
      imageUrl: place.imageUrl,
      fallbackImageUrl: place.fallbackImageUrl,
      googleMapsUrl: place.googleMapsUrl,
      latitude: place.latitude,
      longitude: place.longitude,
      photo_url: place.photo_url,
      photo_urls: place.photo_urls ? JSON.stringify(place.photo_urls) : undefined,
    });
  }

  toPlaceCardPlace(result: AiPlaceSearchResult): Place {
    const imageUrl = result.imageUrl || result.photo_url || (result.photo_urls && result.photo_urls.length > 0 ? result.photo_urls[0] : undefined);

    return {
      id: result.routeId || result.id,
      name: result.name,
      location: result.location,
      rating: result.rating || 0,
      reviewsLabel: result.reviewsLabel || '',
      reviewsCount: 0,
      category: result.category,
      badge: result.visualBadge || 'Suggestion',
      theme: result.theme || 'theme-agadir',
      icon: result.visualIcon || 'sparkles-outline',
      spotlight: result.source === 'ai' ? 'IA' : 'Local',
      shortDescription: result.description || '',
      longDescription: result.description || '',
      address: result.address || result.location,
      hours: '',
      starsLabel: '★★★★★',
      highlights: [],
      imageUrl,
      fallbackImageUrl: result.fallbackImageUrl,
      photo_url: result.photo_url,
      photo_urls: result.photo_urls,
      googleMapsUrl: result.googleMapsUrl,
      latitude: result.latitude,
      longitude: result.longitude,
      types: result.types,
      city: result.location,
    };
  }

  onSearchResultSelect(result: AiPlaceSearchResult) {
    const placeId = result.routeId || result.id;
    void this.router.navigate(['/tabs/place', placeId]);
  }

  onSearchResultMap(result: AiPlaceSearchResult) {
    void this.router.navigate(['/tabs/map'], {
      queryParams: this.buildMapQueryParamsForResult(result),
    });
  }

  onSearchResultRoute(result: AiPlaceSearchResult) {
    void this.router.navigate(['/tabs/map'], {
      queryParams: this.buildMapQueryParamsForResult(result),
    });
  }

  isFavorite(placeId: string): boolean {
    return this.favoriteIds.has(placeId);
  }

  onToggleFavoriteResult(result: AiPlaceSearchResult) {
    this.favoritesService.toggle(this.toPlaceCardPlace(result));
  }

  onToggleFavoritePlace(place: Place) {
    this.favoritesService.toggle(place);
  }

  mainCardFavId(entity: AiPlaceSearchResult | Place, isResult: boolean): string {
    if (isResult) {
      const r = entity as AiPlaceSearchResult;
      return r.routeId || r.id;
    }
    return entity.id;
  }

  onToggleMainCard(entity: AiPlaceSearchResult | Place, isResult: boolean) {
    if (isResult) {
      this.onToggleFavoriteResult(entity as AiPlaceSearchResult);
    } else {
      this.onToggleFavoritePlace(entity as Place);
    }
  }

  mainCardRoute(entity: AiPlaceSearchResult | Place, isResult: boolean): string[] {
    if (isResult) {
      const r = entity as AiPlaceSearchResult;
      return r.routeId ? ['/tabs/place', r.routeId] : ['/tabs/map'];
    }
    return ['/tabs/place', entity.id];
  }

  mainCardMapParams(entity: AiPlaceSearchResult | Place, isResult: boolean): MapQueryParams {
    if (isResult) {
      return this.buildMapQueryParamsForResult(entity as AiPlaceSearchResult);
    }
    return this.buildMapQueryParamsForPlace(entity as Place);
  }

  trackByPlaceId(index: number, place: Place) {
    return place.id || index;
  }

  get activePrompts(): string[] {
    return this.searchExperience?.suggestedQuestions?.length
      ? this.searchExperience.suggestedQuestions
      : this.defaultSuggestedPrompts;
  }

  getCategoryIcon(category: string): string {
    const map: [string, string][] = [
      ['plage', '🏖️'], ['beach', '🏖️'],
      ['culture', '🏛️'], ['historique', '🏯'], ['patrimoine', '🏯'],
      ['musée', '🎨'], ['art', '🎨'],
      ['restaurant', '🍽️'], ['gastronomie', '🥘'], ['cuisine', '🍜'],
      ['café', '☕'], ['thé', '🍵'],
      ['mosquée', '🕌'], ['médina', '🏘️'],
      ['nature', '🌿'], ['parc', '🌳'], ['jardin', '🌺'],
      ['sport', '⚽'], ['aventure', '🧗'], ['randonnée', '🥾'],
      ['shopping', '🛍️'], ['souk', '🧺'], ['artisanat', '🏺'],
      ['hôtel', '🏨'], ['hébergement', '🏨'],
      ['plein air', '🌄'], ['piscine', '🏊'],
    ];
    const lower = category.toLowerCase();
    return map.find(([k]) => lower.includes(k))?.[1] ?? '📍';
  }

  get miniCards(): Place[] {
    if (this.hasSearched && this.searchResults.length > 1) {
      return this.searchResults.slice(1).map(r => this.toPlaceCardPlace(r));
    }
    if (!this.hasSearched && this.featuredPlaces.length > 1) {
      return this.featuredPlaces.slice(1);
    }
    return [];
  }

  onMiniCardSelect(card: Place) {
    void this.router.navigate(['/tabs/place', card.id]);
  }

  onToggleMiniCardFav(event: Event, card: Place) {
    event.stopPropagation();
    this.favoritesService.toggle(card);
  }

  get isItinerary(): boolean {
    return this.searchExperience?.responseMode === 'itinerary';
  }

  private async startAudioRecording() {
    if (!this.canUseAudioSearch) {
      this.audioSearchMessage = 'Recherche vocale non disponible sur cet appareil.';
      return;
    }

    this.resetAudioCapture();

    // ── 1. Web Speech API (navigateur) — transcription instantanée ──
    const SpeechRecognitionClass = this.speechRecognitionClass;
    if (SpeechRecognitionClass) {
      this.startWebSpeechRecognition(SpeechRecognitionClass);
      return;
    }

    // ── 2. Fallback MediaRecorder → backend audio ──
    await this.startMediaRecorderCapture();
  }

  private startWebSpeechRecognition(SpeechRecognitionClass: any) {
    const recognition = new SpeechRecognitionClass();
    recognition.lang = 'fr-FR';
    recognition.interimResults = true;   // affichage en temps réel
    recognition.maxAlternatives = 1;
    recognition.continuous = true;       // continue jusqu'au 2ème clic

    this.speechRecognition = recognition;
    this.isRecordingAudio = true;
    this.audioSearchMessage = 'Parlez... (re-cliquez le micro pour lancer)';

    let finalTranscript = '';

    recognition.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const segment: string = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += segment + ' ';
        } else {
          interim += segment;
        }
      }
      const display = (finalTranscript + interim).trim();
      if (display) {
        this.audioSearchMessage = display;
        this.searchQuery = finalTranscript.trim() || display;
      }
    };

    recognition.onerror = (event: any) => {
      const code: string = event?.error ?? '';
      if (code === 'no-speech') return; // silence normal, on continue
      this.isRecordingAudio = false;
      this.speechRecognition = null;
      if (code === 'not-allowed' || code === 'service-not-allowed') {
        this.audioSearchMessage = 'Acces micro refuse. Autorisez le microphone.';
      } else if (code === 'network') {
        this.audioSearchMessage = 'Connexion requise pour la reconnaissance vocale.';
      } else {
        this.audioSearchMessage = `Erreur vocale (${code}). Tapez votre recherche.`;
      }
    };

    recognition.onend = () => {
      // onend peut se déclencher après recognition.stop()
      // → lancer la recherche si on a du texte
      this.isRecordingAudio = false;
      this.speechRecognition = null;
      const transcript = (finalTranscript || this.searchQuery || '').trim();
      if (transcript && this.isSearching) {
        // déjà déclenché par stopAudioRecording
        return;
      }
      if (transcript) {
        this.searchQuery = transcript;
        this.audioSearchMessage = `"${transcript}"`;
        void this.searchWithAi();
      } else if (this.audioSearchMessage === 'Parlez... (re-cliquez le micro pour lancer)') {
        this.audioSearchMessage = 'Aucun mot detecte. Reessayez.';
      }
    };

    try {
      recognition.start();
    } catch {
      this.isRecordingAudio = false;
      this.speechRecognition = null;
      this.audioSearchMessage = 'Impossible de demarrer le micro.';
    }
  }

  private async startMediaRecorderCapture() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = this.resolveRecorderMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      this.audioStream = stream;
      this.mediaRecorder = recorder;
      this.audioChunks = [];
      this.audioSearchMessage = 'Parlez, puis touchez a nouveau le micro.';

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      recorder.onerror = () => {
        this.isRecordingAudio = false;
        this.isSearching = false;
        this.audioSearchMessage = 'Erreur d enregistrement.';
        this.resetAudioCapture();
      };

      recorder.onstop = () => {
        const audioBlob = this.buildRecordedAudioBlob(recorder.mimeType);
        this.mediaRecorder = null;
        this.isRecordingAudio = false;
        this.releaseAudioStream();

        if (!audioBlob || !audioBlob.size) {
          this.isSearching = false;
          this.audioSearchMessage = 'Aucun son detecte. Reessayez.';
          return;
        }

        void this.runAudioSearch(audioBlob);
      };

      recorder.start();
      this.isRecordingAudio = true;
    } catch {
      this.audioSearchMessage = 'Impossible d acceder au microphone.';
      this.resetAudioCapture();
    }
  }

  private stopAudioRecording() {
    if (this.speechRecognition) {
      const transcript = this.searchQuery.trim();
      if (transcript) {
        // Marquer searching avant stop pour que onend ne relance pas
        this.isSearching = true;
        this.audioSearchMessage = `"${transcript}"`;
        this.speechRecognition.stop();
        void this.searchWithAi();
      } else {
        this.speechRecognition.stop();
        this.audioSearchMessage = 'Aucun mot detecte. Reessayez.';
      }
      return;
    }

    if (!this.mediaRecorder || this.mediaRecorder.state !== 'recording') {
      return;
    }

    this.isSearching = true;
    this.audioSearchMessage = 'Analyse audio en cours...';
    this.mediaRecorder.stop();
  }

  private async runAudioSearch(audio: Blob) {
    this.hasSearched = true;
    this.searchLocationMessage = 'Verification de votre position...';

    const locationOptions = await this.resolveSearchLocationOptions();

    this.aiPlaceService.searchFromAudio(audio, {
      ...locationOptions,
      language: 'fr',
    }).subscribe({
      next: (experience: AiPlaceSearchExperience) => {
        this.highlightImageLoaded = false;
        this.searchExperience = experience;
        this.searchResults = experience.results;
        this.searchMode = experience.source;
        this.searchQuery = experience.transcribedQuery || this.searchQuery;
        this.isSearching = false;
        this.searchLocationMessage = '';
        this.audioSearchMessage = experience.transcribedQuery
          ? `"${experience.transcribedQuery}"`
          : '';
      },
      error: (error: unknown) => {
        this.searchExperience = null;
        this.searchResults = [];
        this.searchMode = 'fallback';
        this.isSearching = false;
        this.searchLocationMessage = '';
        const details = this.resolveAudioError(error);
        this.audioSearchMessage = details
          ? `Recherche audio echouee (${details}). Tapez votre recherche.`
          : 'Recherche audio echouee. Tapez votre recherche.';
      },
    });
  }

  private async resolveSearchLocationOptions(): Promise<{ userLatitude?: number; userLongitude?: number }> {
    const location = await this.userLocationService.getCurrentLocation({
      forceRefresh: false,
      timeout: 8000,
      maximumAge: 300000,
    });

    if (!location) {
      this.searchLocationMessage = 'Recherche envoyee sans position activee.';
      return {};
    }

    this.searchLocationMessage = 'Recherche ajustee selon votre position actuelle.';


    return {
      userLatitude: location.latitude,
      userLongitude: location.longitude,
    };
  }

  private loadHomeContent() {
    this.placeCatalogService.getFeaturedPlaces().subscribe((places: Place[]) => {
      this.featuredPlaces = places;
      this.highlightPlace = places[0] ?? null;
    });

    this.coreDataService.getCategoryLabels().subscribe((filters: string[]) => {
      this.quickFilters = filters;
    });

    this.coreDataService.getNotifications().subscribe((notifications) => {
      this.notificationCount = notifications.length;
    });
  }

  private buildMapQueryParams(details: {
    placeId?: string;
    name: string;
    location?: string;
    address?: string;
    latitude?: number;
    longitude?: number;
    category?: string;
    googleMapsUrl?: string;
    imageUrl?: string;
    fallbackImageUrl?: string;
    photo_url?: string;
    photo_urls?: string;
  }): MapQueryParams {
    const params: MapQueryParams = {
      name: details.name,
    };

    if (details.placeId?.trim()) {
      params.placeId = details.placeId.trim();
    }

    if (details.location?.trim()) {
      params.location = details.location.trim();
    }

    if (details.address?.trim()) {
      params.address = details.address.trim();
    }

    if (typeof details.latitude === 'number') {
      params.latitude = String(details.latitude);
    }

    if (typeof details.longitude === 'number') {
      params.longitude = String(details.longitude);
    }

    if (details.category?.trim()) {
      params.category = details.category.trim();
    }

    if (details.googleMapsUrl?.trim()) {
      params.googleMapsUrl = details.googleMapsUrl.trim();
    }

    if (details.imageUrl?.trim()) {
      params.imageUrl = details.imageUrl.trim();
    }

    if (details.fallbackImageUrl?.trim()) {
      params.fallbackImageUrl = details.fallbackImageUrl.trim();
    }

    if (details.photo_url?.trim()) {
      params.photo_url = details.photo_url.trim();
    }

    if (details.photo_urls?.trim()) {
      params.photo_urls = details.photo_urls.trim();
    }

    return params;
  }

  private resolveRecorderMimeType(): string | undefined {
    const candidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/mpeg',
    ];

    if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
      return candidates[0];
    }

    return candidates.find((candidate: string) => MediaRecorder.isTypeSupported(candidate));
  }

  private buildRecordedAudioBlob(mimeType?: string): Blob | null {
    if (!this.audioChunks.length) {
      return null;
    }

    return new Blob(this.audioChunks, {
      type: mimeType || this.audioChunks[0]?.type || 'audio/webm',
    });
  }

  private resetAudioCapture() {
    if (this.speechRecognition) {
      try { this.speechRecognition.abort(); } catch { /* ignore */ }
      this.speechRecognition = null;
    }

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.onstop = null;
      this.mediaRecorder.stop();
    }

    this.mediaRecorder = null;
    this.audioChunks = [];
    this.isRecordingAudio = false;
    this.releaseAudioStream();
  }

  private resolveAudioError(error: unknown): string | undefined {
    if (!error || typeof error !== 'object') {
      return undefined;
    }

    const record = error as { status?: unknown; message?: unknown; error?: unknown };
    const status = typeof record.status === 'number' ? record.status : undefined;
    const message = typeof record.message === 'string' ? record.message : undefined;
    const innerMessage = record.error && typeof record.error === 'object'
      ? (record.error as { message?: unknown }).message
      : undefined;

    if (typeof innerMessage === 'string' && innerMessage.trim().length > 0) {
      return innerMessage.trim();
    }

    if (message && message.trim().length > 0) {
      return message.trim();
    }

    if (typeof status === 'number') {
      return `code ${status}`;
    }

    return undefined;
  }

  getImageSrc(entity?: { imageUrl?: string; photo_url?: string; photo_urls?: string[] | string; fallbackImageUrl?: string }): string {
    if (!entity) return this.FALLBACK_IMAGE;
    const candidates = this.collectImageCandidates(entity);
    return candidates.find(url => !this.failedImageUrls.has(url)) ?? this.FALLBACK_IMAGE;
  }

  private collectImageCandidates(entity: {
    imageUrl?: string;
    photo_url?: string;
    photo_urls?: string[] | string;
    fallbackImageUrl?: string;
  }): string[] {
    const seen = new Set<string>();
    const urls: string[] = [];

    const push = (url?: string) => {
      const trimmed = url?.trim();
      if (trimmed && !seen.has(trimmed)) {
        seen.add(trimmed);
        urls.push(trimmed);
      }
    };

    push(entity.imageUrl);
    push(entity.photo_url);
    for (const url of parsePhotoUrls(entity.photo_urls)) push(url);
    push(entity.fallbackImageUrl);

    return urls;
  }

  private releaseAudioStream() {
    if (this.audioStream) {
      this.audioStream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
    }

    this.audioStream = null;
  }
}
