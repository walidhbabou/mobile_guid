import { Component, OnDestroy } from '@angular/core';
import { Place } from '../data/tourism.data';
import { AiGuideCard, AiPlaceSearchExperience, AiPlaceSearchResult } from '../models/ai-place.model';
import { AiPlaceService } from '../services/ai-place.service';
import { CoreDataService } from '../services/core-data.service';
import { PlaceCatalogService } from '../services/place-catalog.service';
import { UserLocationService } from '../services/user-location.service';

interface MapQueryParams {
  placeId?: string;
  name?: string;
  location?: string;
  address?: string;
  latitude?: string;
  longitude?: string;
  category?: string;
  googleMapsUrl?: string;
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
  featuredPlaces: Place[] = [];
  quickFilters: string[] = [];
  highlightPlace: Place | null = null;
  notificationCount = 0;
  readonly defaultSuggestedPrompts = [
    'plage calme a Agadir',
    'sortie famille a Rabat',
    'ville culturelle pour photos',
    'lieu romantique au coucher de soleil',
  ];
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private audioStream: MediaStream | null = null;

  constructor(
    private aiPlaceService: AiPlaceService,
    private placeCatalogService: PlaceCatalogService,
    private coreDataService: CoreDataService,
    private userLocationService: UserLocationService
  ) {}

  ionViewWillEnter() {
    this.userName = localStorage.getItem('userName') || 'Sophie';
    this.loadHomeContent();
  }

  ngOnDestroy() {
    this.resetAudioCapture();
  }

  get userInitial(): string {
    return this.userName.charAt(0).toUpperCase() || 'U';
  }

  get canUseAudioSearch(): boolean {
    return typeof navigator !== 'undefined'
      && !!navigator.mediaDevices?.getUserMedia
      && typeof MediaRecorder !== 'undefined';
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
      ? `${this.searchResults.length} proposition(s) composee(s) pour votre demande.`
      : `${this.searchResults.length} piste(s) locales proches de votre recherche sont affichees.`;
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
        this.searchExperience = experience;
        this.searchResults = experience.results;
        this.searchMode = experience.source;
        this.isSearching = false;
      },
      error: () => {
        this.searchExperience = null;
        this.searchResults = [];
        this.searchMode = 'fallback';
        this.isSearching = false;
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

  clearSearch() {
    this.searchQuery = '';
    this.searchExperience = null;
    this.searchResults = [];
    this.hasSearched = false;
    this.searchMode = 'idle';
    this.isSearching = false;
    this.audioSearchMessage = '';
    this.searchLocationMessage = '';
    this.resetAudioCapture();
  }

  handlePlaceImageError(place: Place) {
    place.imageUrl = place.fallbackImageUrl && place.imageUrl !== place.fallbackImageUrl
      ? place.fallbackImageUrl
      : undefined;
  }

  handleResultImageError(result: AiPlaceSearchResult) {
    result.imageUrl = result.fallbackImageUrl && result.imageUrl !== result.fallbackImageUrl
      ? result.fallbackImageUrl
      : undefined;
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
    });
  }

  get activePrompts(): string[] {
    return this.searchExperience?.suggestedQuestions?.length
      ? this.searchExperience.suggestedQuestions
      : this.defaultSuggestedPrompts;
  }

  private async startAudioRecording() {
    if (!this.canUseAudioSearch) {
      this.audioSearchMessage = 'La recherche audio n est pas disponible sur cet appareil.';
      return;
    }

    this.resetAudioCapture();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = this.resolveRecorderMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      this.audioStream = stream;
      this.mediaRecorder = recorder;
      this.audioChunks = [];
      this.audioSearchMessage = 'Parlez naturellement, puis touchez a nouveau le micro pour lancer la recherche.';

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      recorder.onerror = () => {
        this.isRecordingAudio = false;
        this.isSearching = false;
        this.audioSearchMessage = 'Impossible d enregistrer l audio pour cette recherche.';
        this.resetAudioCapture();
      };

      recorder.onstop = () => {
        const audioBlob = this.buildRecordedAudioBlob(recorder.mimeType);

        this.mediaRecorder = null;
        this.isRecordingAudio = false;
        this.releaseAudioStream();

        if (!audioBlob || !audioBlob.size) {
          this.isSearching = false;
          this.audioSearchMessage = 'Aucun son n a ete detecte. Reessayez.';
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
    if (!this.mediaRecorder || this.mediaRecorder.state !== 'recording') {
      return;
    }

    this.isSearching = true;
    this.audioSearchMessage = 'Analyse audio en cours...';
    this.mediaRecorder.stop();
  }

  private async runAudioSearch(audio: Blob) {
    this.hasSearched = true;
    this.searchLocationMessage = 'Verification de votre position pour affiner la recherche...';

    const locationOptions = await this.resolveSearchLocationOptions();

    this.aiPlaceService.searchFromAudio(audio, {
      ...locationOptions,
      language: 'fr',
    }).subscribe({
      next: (experience: AiPlaceSearchExperience) => {
        this.searchExperience = experience;
        this.searchResults = experience.results;
        this.searchMode = experience.source;
        this.searchQuery = experience.transcribedQuery || this.searchQuery;
        this.isSearching = false;
        this.audioSearchMessage = experience.transcribedQuery
          ? `Recherche audio comprise: ${experience.transcribedQuery}`
          : '';
      },
      error: (error: unknown) => {
        this.searchExperience = null;
        this.searchResults = [];
        this.searchMode = 'fallback';
        this.isSearching = false;
        const details = this.resolveAudioError(error);
        this.audioSearchMessage = details
          ? `La recherche audio n a pas abouti (${details}). Essayez en texte ou relancez un enregistrement.`
          : 'La recherche audio n a pas abouti. Essayez en texte ou lancez un nouvel enregistrement.';
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

  private releaseAudioStream() {
    if (this.audioStream) {
      this.audioStream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
    }

    this.audioStream = null;
  }
}
