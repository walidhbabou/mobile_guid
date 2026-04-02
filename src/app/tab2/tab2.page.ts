import { AfterViewInit, Component, ElementRef, NgZone, OnDestroy, ViewChild } from '@angular/core';
import { Place } from '../data/tourism.data';
import { AiGuideCard, AiPlaceSearchExperience, AiPlaceSearchResult } from '../models/ai-place.model';
import { AiPlaceService } from '../services/ai-place.service';
import { GoogleMapsLoaderService } from '../services/google-maps-loader.service';
import { PlaceCatalogService, PlaceMarker } from '../services/place-catalog.service';

declare global {
  interface Window {
    google?: any;
  }
}

@Component({
  selector: 'app-tab2',
  templateUrl: 'tab2.page.html',
  styleUrls: ['tab2.page.scss'],
  standalone: false,
})
export class Tab2Page implements AfterViewInit, OnDestroy {
  @ViewChild('googleMap', { static: false }) private googleMapElement?: ElementRef<HTMLDivElement>;

  filters: string[] = [];
  allPlaces: Place[] = [];
  aiPlaces: Place[] = [];
  filteredPlaces: Place[] = [];
  markers: PlaceMarker[] = [];
  selectedFilter = 'Tout';
  selectedPlace: Place | null = null;
  searchQuery = '';
  isSearching = false;
  hasActiveSearch = false;
  searchMode: 'catalog' | 'ai' | 'fallback' = 'catalog';
  searchExperience: AiPlaceSearchExperience | null = null;
  recordingError = '';
  recordingStateLabel = 'Touchez le micro pour poser votre question en audio.';
  userLatitude?: number;
  userLongitude?: number;
  isLocating = false;
  locationLabel = 'Position non detectee';
  isRecording = false;
  isMapLoading = false;
  mapErrorMessage = '';
  private mediaRecorder: MediaRecorder | null = null;
  private recordingStream: MediaStream | null = null;
  private recordedChunks: Blob[] = [];
  private googleMap: any | null = null;
  private googleInfoWindow: any | null = null;
  private googleMarkers = new Map<string, any>();
  private viewInitialized = false;

  constructor(
    private placeCatalogService: PlaceCatalogService,
    private aiPlaceService: AiPlaceService,
    private googleMapsLoaderService: GoogleMapsLoaderService,
    private ngZone: NgZone
  ) {}

  ionViewWillEnter() {
    this.loadMapContent();
  }

  ionViewDidEnter() {
    this.queueMapResize();
  }

  ngAfterViewInit() {
    this.viewInitialized = true;
    void this.initializeGoogleMap();
  }

  ngOnDestroy() {
    this.clearGoogleMarkers();
    this.googleInfoWindow?.close();
  }

  selectFilter(filter: string) {
    this.selectedFilter = filter;
    this.applyFilter();
  }

  selectPlace(place: Place, openInfoWindow = true) {
    this.selectedPlace = place;
    this.updateMarkerSelection();

    if (openInfoWindow) {
      this.openInfoWindow(place);
    }

    this.focusMapOnPlace(place);
  }

  focusSelectedPlace() {
    if (!this.selectedPlace) {
      return;
    }

    this.openInfoWindow(this.selectedPlace);
    this.focusMapOnPlace(this.selectedPlace);
  }

  searchWithAi() {
    const query = this.searchQuery.trim();

    if (!query) {
      this.clearAiSearch();
      return;
    }

    this.recordingError = '';
    this.isSearching = true;

    this.aiPlaceService.search(query, this.buildSearchOptions()).subscribe({
      next: (experience: AiPlaceSearchExperience) => {
        this.applySearchExperience(experience);
        this.recordingStateLabel = 'Recherche terminee. Vous pouvez relancer par texte ou audio.';
        this.isSearching = false;
      },
      error: (error: unknown) => {
        this.recordingError = this.resolveApiErrorMessage(
          error,
          'La recherche intelligente a echoue. Reessayez dans quelques instants.'
        );
        this.isSearching = false;
      },
    });
  }

  useSuggestedQuestion(question: string) {
    this.searchQuery = question;
    this.searchWithAi();
  }

  useGuideCard(card: AiGuideCard) {
    this.searchQuery = card.query || card.title;
    this.searchWithAi();
  }

  clearAiSearch() {
    this.searchExperience = null;
    this.searchMode = 'catalog';
    this.hasActiveSearch = false;
    this.aiPlaces = [];
    this.recordingError = '';
    this.recordingStateLabel = 'Touchez le micro pour poser votre question en audio.';
    this.refreshFilterSource();
  }

  async toggleRecording() {
    if (this.isSearching) {
      return;
    }

    if (this.isRecording) {
      this.stopRecording();
      return;
    }

    this.recordingError = '';

    if (!this.canUseAudioRecording()) {
      this.recordingError = 'L enregistrement audio n est pas disponible sur cet appareil.';
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);

      this.recordedChunks = [];
      this.mediaRecorder = recorder;
      this.recordingStream = stream;
      this.isRecording = true;
      this.recordingStateLabel = 'Enregistrement en cours. Touchez encore le micro pour envoyer.';

      recorder.addEventListener('dataavailable', (event: BlobEvent) => {
        if (event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      });

      recorder.addEventListener('stop', () => {
        const audioBlob = new Blob(this.recordedChunks, {
          type: recorder.mimeType || 'audio/webm',
        });

        this.cleanupRecorder();

        if (!audioBlob.size) {
          this.recordingError = 'Aucun audio exploitable n a ete capture.';
          return;
        }

        this.recordingStateLabel = 'Analyse audio en cours...';
        this.submitAudioSearch(audioBlob);
      });

      recorder.start();
    } catch {
      this.cleanupRecorder();
      this.recordingError = 'Le micro n est pas accessible. Verifiez les autorisations.';
    }
  }

  async locateUser() {
    if (!('geolocation' in navigator)) {
      this.locationLabel = 'Geolocalisation indisponible';
      return;
    }

    this.isLocating = true;

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 8000,
          maximumAge: 120000,
        });
      });

      this.userLatitude = position.coords.latitude;
      this.userLongitude = position.coords.longitude;
      this.locationLabel = `Position activee: ${this.userLatitude.toFixed(3)}, ${this.userLongitude.toFixed(3)}`;

      if (this.googleMap) {
        this.googleMap.panTo({
          lat: this.userLatitude,
          lng: this.userLongitude,
        });

        if ((this.googleMap.getZoom?.() ?? 0) < 12) {
          this.googleMap.setZoom(12);
        }
      }
    } catch {
      this.locationLabel = 'Impossible de recuperer votre position';
    } finally {
      this.isLocating = false;
    }
  }

  handlePlaceImageError(place: Place) {
    place.imageUrl = undefined;
  }

  get suggestedQuestions(): string[] {
    return this.searchExperience?.suggestedQuestions ?? [];
  }

  get guideCards(): AiGuideCard[] {
    return this.searchExperience?.guideCards ?? [];
  }

  private loadMapContent() {
    this.placeCatalogService.getPlaces().subscribe((places: Place[]) => {
      this.allPlaces = places;
      this.refreshFilterSource();
    });
  }

  private applyFilter() {
    const sourcePlaces = this.hasActiveSearch ? this.aiPlaces : this.allPlaces;
    const filteredPlaces = this.placeCatalogService.filterPlaces(sourcePlaces, this.selectedFilter);

    this.filteredPlaces = filteredPlaces;
    this.markers = this.placeCatalogService.buildMarkers(filteredPlaces);

    if (!filteredPlaces.length) {
      this.selectedPlace = null;
      this.syncGoogleMap();
      return;
    }

    if (!this.selectedPlace || !filteredPlaces.some((place: Place) => place.id === this.selectedPlace?.id)) {
      this.selectedPlace = filteredPlaces[0];
    } else {
      this.selectedPlace = filteredPlaces.find((place: Place) => place.id === this.selectedPlace?.id) ?? filteredPlaces[0];
    }

    this.syncGoogleMap();
  }

  private buildFilters(places: Place[]): string[] {
    const categories = Array.from(new Set(
      places
        .map((place: Place) => place.category)
        .filter((category: string) => category.trim().length > 0)
    ));

    return ['Tout', ...categories.slice(0, 6)];
  }

  private applySearchExperience(experience: AiPlaceSearchExperience) {
    this.searchExperience = experience;
    this.searchMode = experience.source;
    this.hasActiveSearch = true;
    this.aiPlaces = experience.results.map((result: AiPlaceSearchResult, index: number) => this.mapResultToPlace(result, index));
    this.searchQuery = experience.transcribedQuery || this.searchQuery;
    this.refreshFilterSource();
  }

  private refreshFilterSource() {
    const sourcePlaces = this.hasActiveSearch ? this.aiPlaces : this.allPlaces;
    this.filters = this.buildFilters(sourcePlaces);

    if (!this.filters.includes(this.selectedFilter)) {
      this.selectedFilter = this.filters[0] ?? 'Tout';
    }

    this.applyFilter();
  }

  private mapResultToPlace(result: AiPlaceSearchResult, index: number): Place {
    const existingPlace = this.allPlaces.find((place: Place) => place.id === (result.routeId || result.id));
    const location = result.location || existingPlace?.location || 'Maroc';
    const description = result.description || existingPlace?.shortDescription || `Suggestion intelligente pour ${result.name}.`;
    const rating = result.rating ?? existingPlace?.rating ?? 0;
    const address = result.address || existingPlace?.address || location;
    const latitude = result.latitude ?? existingPlace?.latitude;
    const longitude = result.longitude ?? existingPlace?.longitude;
    const googleMapsUrl = result.googleMapsUrl
      || existingPlace?.googleMapsUrl
      || this.buildGoogleMapsUrl(result.name, address, latitude, longitude);

    if (existingPlace) {
      return {
        ...existingPlace,
        location,
        city: location,
        category: result.category || existingPlace.category,
        spotlight: description,
        shortDescription: this.truncate(description, 110),
        longDescription: description,
        address,
        imageUrl: result.imageUrl || existingPlace.imageUrl,
        googleMapsUrl,
        latitude,
        longitude,
        badge: result.visualBadge || existingPlace.badge,
        icon: result.visualIcon || existingPlace.icon,
        theme: result.theme || existingPlace.theme,
        rating,
        starsLabel: this.buildStarsLabel(rating),
        types: result.types?.length ? result.types : existingPlace.types,
      };
    }

    return {
      id: result.routeId || result.id || `ai-map-${index}`,
      name: result.name,
      location,
      rating,
      reviewsLabel: location,
      reviewsCount: 0,
      category: result.category || 'Suggestion',
      badge: result.visualBadge || result.category || 'IA',
      theme: result.theme || 'theme-rabat',
      icon: result.visualIcon || 'sparkles-outline',
      spotlight: description,
      shortDescription: this.truncate(description, 110),
      longDescription: description,
      address,
      hours: 'Consultez Google Maps pour les horaires du jour',
      starsLabel: this.buildStarsLabel(rating),
      highlights: [
        ...(result.types ?? []).slice(0, 2),
        location,
        address || 'Suggestion IA',
      ].filter((value: string, itemIndex: number, values: string[]) => value.trim().length > 0 && values.indexOf(value) === itemIndex).slice(0, 4),
      imageUrl: result.imageUrl,
      googleMapsUrl,
      latitude,
      longitude,
      types: result.types,
      city: location,
    };
  }

  private async initializeGoogleMap() {
    if (!this.viewInitialized || !this.googleMapElement?.nativeElement) {
      return;
    }

    if (this.googleMap) {
      this.syncGoogleMap();
      return;
    }

    this.isMapLoading = true;

    try {
      const google = await this.googleMapsLoaderService.load();

      if (!this.googleMapElement?.nativeElement) {
        return;
      }

      this.googleMap = new google.maps.Map(this.googleMapElement.nativeElement, {
        center: { lat: 31.7917, lng: -7.0926 },
        zoom: 6,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        clickableIcons: false,
      });
      this.googleInfoWindow = new google.maps.InfoWindow();
      this.mapErrorMessage = '';
      this.syncGoogleMap();
      this.queueMapResize();
    } catch {
      this.mapErrorMessage = 'Google Maps ne s affiche pas. Ajoutez une cle API valide dans src/environments/environment.ts.';
    } finally {
      this.isMapLoading = false;
    }
  }

  private syncGoogleMap() {
    if (!this.viewInitialized) {
      return;
    }

    if (!this.googleMap) {
      void this.initializeGoogleMap();
      return;
    }

    const google = window.google;

    if (!google?.maps) {
      return;
    }

    this.clearGoogleMarkers();

    const placesWithCoordinates = this.filteredPlaces.filter((place: Place) => this.hasCoordinates(place));

    if (!placesWithCoordinates.length) {
      this.googleMap.setCenter({ lat: 31.7917, lng: -7.0926 });
      this.googleMap.setZoom(6);
      this.googleInfoWindow?.close();
      return;
    }

    const bounds = new google.maps.LatLngBounds();

    placesWithCoordinates.forEach((place: Place) => {
      const marker = new google.maps.Marker({
        map: this.googleMap,
        position: {
          lat: place.latitude as number,
          lng: place.longitude as number,
        },
        title: place.name,
        icon: this.buildMarkerIcon(false),
      });

      marker.addListener('click', () => {
        this.ngZone.run(() => this.selectPlace(place));
      });

      this.googleMarkers.set(place.id, marker);
      bounds.extend(marker.getPosition());
    });

    if (this.selectedPlace && this.hasCoordinates(this.selectedPlace)) {
      this.focusMapOnPlace(this.selectedPlace);
    } else {
      this.googleMap.fitBounds(bounds, 64);
    }

    this.updateMarkerSelection();

    if (this.selectedPlace) {
      this.openInfoWindow(this.selectedPlace);
    }
  }

  private buildMarkerIcon(isActive: boolean) {
    return {
      path: window.google.maps.SymbolPath.CIRCLE,
      scale: isActive ? 9 : 7,
      fillColor: isActive ? '#2d7ff0' : '#ef6c57',
      fillOpacity: 1,
      strokeColor: '#ffffff',
      strokeWeight: 2,
    };
  }

  private updateMarkerSelection() {
    this.googleMarkers.forEach((marker: any, placeId: string) => {
      const isActive = this.selectedPlace?.id === placeId;
      marker.setIcon(this.buildMarkerIcon(isActive));
      marker.setZIndex(isActive ? 10 : 1);
    });
  }

  private focusMapOnPlace(place: Place) {
    if (!this.googleMap || !this.hasCoordinates(place)) {
      return;
    }

    this.googleMap.panTo({
      lat: place.latitude as number,
      lng: place.longitude as number,
    });

    if ((this.googleMap.getZoom?.() ?? 0) < 13) {
      this.googleMap.setZoom(13);
    }
  }

  private openInfoWindow(place: Place) {
    if (!this.googleMap || !this.googleInfoWindow) {
      return;
    }

    const marker = this.googleMarkers.get(place.id);

    if (!marker) {
      this.googleInfoWindow.close();
      return;
    }

    this.googleInfoWindow.setContent(
      `<div style="padding:8px 10px;max-width:220px;">
        <strong>${this.escapeHtml(place.name)}</strong>
        <div style="margin-top:4px;font-size:12px;color:#667085;">${this.escapeHtml(place.location)}</div>
      </div>`
    );
    this.googleInfoWindow.open({
      anchor: marker,
      map: this.googleMap,
    });
  }

  private clearGoogleMarkers() {
    this.googleMarkers.forEach((marker: any) => marker.setMap(null));
    this.googleMarkers.clear();
  }

  private queueMapResize() {
    if (!this.googleMap || !window.google?.maps?.event) {
      return;
    }

    window.setTimeout(() => {
      window.google?.maps?.event?.trigger(this.googleMap, 'resize');

      if (this.selectedPlace) {
        this.focusMapOnPlace(this.selectedPlace);
      }
    }, 120);
  }

  private hasCoordinates(place: Place | null): place is Place {
    return !!place && typeof place.latitude === 'number' && typeof place.longitude === 'number';
  }

  private buildGoogleMapsUrl(name: string, address: string, latitude?: number, longitude?: number): string | undefined {
    if (typeof latitude === 'number' && typeof longitude === 'number') {
      return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
    }

    const query = [name, address].filter((segment: string) => segment.trim().length > 0).join(', ');

    return query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : undefined;
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private submitAudioSearch(audio: Blob) {
    this.isSearching = true;

    this.aiPlaceService.searchFromAudio(audio, this.buildSearchOptions()).subscribe({
      next: (experience: AiPlaceSearchExperience) => {
        this.applySearchExperience(experience);
        this.recordingStateLabel = 'Question audio analysee. Vous pouvez poser une nouvelle question.';
        this.isSearching = false;
      },
      error: (error: unknown) => {
        this.recordingError = this.resolveApiErrorMessage(
          error,
          'Analyse audio impossible pour le moment.'
        );
        this.recordingStateLabel = 'Touchez le micro pour reessayer.';
        this.isSearching = false;
      },
    });
  }

  private stopRecording() {
    if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
      return;
    }

    this.isRecording = false;
    this.mediaRecorder.stop();
  }

  private cleanupRecorder() {
    this.isRecording = false;

    if (this.recordingStream) {
      this.recordingStream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
    }

    this.mediaRecorder = null;
    this.recordingStream = null;
    this.recordedChunks = [];
  }

  private canUseAudioRecording(): boolean {
    return typeof MediaRecorder !== 'undefined'
      && typeof navigator !== 'undefined'
      && !!navigator.mediaDevices?.getUserMedia;
  }

  private buildSearchOptions() {
    return {
      userLatitude: this.userLatitude,
      userLongitude: this.userLongitude,
      language: typeof navigator !== 'undefined' ? navigator.language : undefined,
    };
  }

  private truncate(value: string, limit: number): string {
    return value.length <= limit ? value : `${value.slice(0, limit - 3).trim()}...`;
  }

  private buildStarsLabel(rating: number): string {
    if (!Number.isFinite(rating) || rating <= 0) {
      return 'Nouveau';
    }

    return '\u2605'.repeat(Math.max(1, Math.min(5, Math.round(rating))));
  }

  private resolveApiErrorMessage(error: unknown, fallback: string): string {
    const apiError = error as {
      status?: number;
      error?: string | { error?: string; message?: string };
      message?: string;
    };

    if (apiError?.status === 403) {
      return 'Acces refuse. Reconnectez-vous puis rechargez les lieux.';
    }

    if (apiError?.status === 400) {
      return this.extractApiMessage(apiError) || 'Requete invalide. Le backend n accepte pas encore ce format audio.';
    }

    return this.extractApiMessage(apiError) || fallback;
  }

  private extractApiMessage(error: {
    error?: string | { error?: string; message?: string };
    message?: string;
  }): string | undefined {
    if (typeof error?.error === 'string' && error.error.trim()) {
      return error.error.trim();
    }

    if (typeof error?.error === 'object') {
      const nestedError = error.error.error?.trim();
      const nestedMessage = error.error.message?.trim();

      return nestedError || nestedMessage;
    }

    return error?.message?.trim() || undefined;
  }
}
