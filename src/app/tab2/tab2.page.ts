import { AfterViewInit, Component, ElementRef, NgZone, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, ParamMap } from '@angular/router';
import { Place } from '../data/tourism.data';
import { RecommendedPlaceApi } from '../models/recommendation.model';
import { AiPlaceService } from '../services/ai-place.service';
import { CoreDataService } from '../services/core-data.service';
import { GoogleMapsLoaderService } from '../services/google-maps-loader.service';
import { PlaceCatalogService } from '../services/place-catalog.service';
import { UserLocationService } from '../services/user-location.service';
import { PlaceCardMeta } from '../shared/place-card/place-card.component';

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
export class Tab2Page implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('googleMap', { static: false }) private googleMapElement?: ElementRef<HTMLDivElement>;
  @ViewChild('mapPanel', { static: false }) private mapPanelElement?: ElementRef<HTMLDivElement>;

  filters: string[] = [];
  allPlaces: Place[] = [];
  filteredPlaces: Place[] = [];
  searchQuery = '';
  selectedFilter = 'Tout';
  selectedPlace: Place | null = null;
  isSplitView = false;
  userLatitude?: number;
  userLongitude?: number;
  isLocating = false;
  isSearchingPlaces = false;
  locationLabel = 'Position non detectee';
  isMapLoading = false;
  mapErrorMessage = '';
  mapSearchMessage = '';
  routeMessage = 'Choisissez un lieu sur la carte pour preparer l itineraire.';
  routeUrl?: string;
  routeDistanceText?: string;
  routeDurationText?: string;
  recommendedPlaces: Array<{ place: Place; score: number; distanceKm?: number }> = [];
  isLoadingRecommendations = false;
  recommendationsErrorMessage = '';
  private googleMap: any | null = null;
  private googleInfoWindow: any | null = null;
  private googleMarkers = new Map<string, any>();
  private userMarker: any | null = null;
  private directionsService: any | null = null;
  private directionsRenderer: any | null = null;
  private viewInitialized = false;
  private requestedPlace: Place | null = null;
  private catalogPlaces: Place[] = [];
  private favoriteBackendIds = new Set<number>();
  private metaCache = new Map<string, PlaceCardMeta>();

  filterState = {
    maxDistanceKm: 25,
    minRating: 0,
    maxBudgetMad: 2000,
  };

  handlePlaceImageError(place: Place) {
    // Permet d'afficher la miniature de fallback quand l'image principale ne charge pas.
    place.imageUrl = place.fallbackImageUrl && place.imageUrl !== place.fallbackImageUrl
      ? place.fallbackImageUrl
      : undefined;
  }

  constructor(
    private route: ActivatedRoute,
    private placeCatalogService: PlaceCatalogService,
    private aiPlaceService: AiPlaceService,
    private googleMapsLoaderService: GoogleMapsLoaderService,
    private ngZone: NgZone,
    private userLocationService: UserLocationService,
    private coreDataService: CoreDataService
  ) {}

  ngOnInit() {
    this.route.queryParamMap.subscribe((params: ParamMap) => {
      this.requestedPlace = this.buildRequestedPlace(params);

      if (this.catalogPlaces.length > 0) {
        this.refreshPlaceCollection();
      }
    });
  }

  ionViewWillEnter() {
    this.isSplitView = typeof window !== 'undefined' ? window.innerWidth >= 920 : false;
    this.loadMapContent();
    void this.locateUser(false, false).then(() => this.refreshRecommendations());
    this.refreshFavorites();
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
    this.clearRenderedRoute();
    this.userMarker?.setMap(null);

    if (this.directionsRenderer) {
      this.directionsRenderer.setMap(null);
    }
  }

  get totalPlacesCount(): number {
    return this.allPlaces.length;
  }

  get visiblePlacesCount(): number {
    return this.filteredPlaces.length;
  }

  get activeDestinationCount(): number {
    return this.selectedPlace ? 1 : 0;
  }

  get primaryLocation(): string {
    return this.selectedPlace?.location || this.filteredPlaces[0]?.location || 'Maroc';
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
    void this.prepareRoute(place);

    this.queueListHighlight(place);
  }

  focusSelectedPlace() {
    if (!this.selectedPlace) {
      return;
    }

    this.openInfoWindow(this.selectedPlace);
    this.focusMapOnPlace(this.selectedPlace);
  }

  async locateUser(refreshRoute = true, forceRefresh = true) {
    this.isLocating = true;

    try {
      const location = await this.userLocationService.getCurrentLocation({
        forceRefresh,
        timeout: 8000,
        maximumAge: forceRefresh ? 0 : 120000,
      });

      if (!location) {
        this.locationLabel = typeof navigator !== 'undefined' && 'geolocation' in navigator
          ? 'Impossible de recuperer votre position'
          : 'Geolocalisation indisponible';
        return;
      }

      this.userLatitude = location.latitude;
      this.userLongitude = location.longitude;
      this.locationLabel = `Position activee: ${this.userLatitude.toFixed(3)}, ${this.userLongitude.toFixed(3)}`;
      this.updateUserMarker();
      this.filteredPlaces = this.sortPlacesByDistance(this.filteredPlaces);
      this.refreshRecommendations();

      if (this.googleMap) {
        this.googleMap.panTo({
          lat: this.userLatitude,
          lng: this.userLongitude,
        });

        if ((this.googleMap.getZoom?.() ?? 0) < 12) {
          this.googleMap.setZoom(12);
        }
      }

      if (refreshRoute && this.selectedPlace) {
        await this.prepareRoute(this.selectedPlace);
      }
    } finally {
      this.isLocating = false;
    }
  }

  refreshRecommendations() {
    if (typeof this.userLatitude !== 'number' || typeof this.userLongitude !== 'number') {
      this.recommendedPlaces = [];
      return;
    }

    this.isLoadingRecommendations = true;
    this.recommendationsErrorMessage = '';

    this.aiPlaceService.getRecommendations(this.userLatitude, this.userLongitude).subscribe({
      next: (response) => {
        const raw = Array.isArray(response?.recommendations) ? response.recommendations as RecommendedPlaceApi[] : [];
        this.recommendedPlaces = raw.map((item: RecommendedPlaceApi) => ({
          place: this.mapRecommendedPlaceToPlace(item.place),
          score: item.score,
          distanceKm: item.distanceKm,
        }));
      },
      error: () => {
        this.recommendedPlaces = [];
        this.recommendationsErrorMessage = 'Impossible de charger les recommandations pour le moment.';
      },
      complete: () => {
        this.isLoadingRecommendations = false;
      },
    });
  }

  async searchInGoogleMaps() {
    const query = this.searchQuery.trim();

    if (!query) {
      this.mapSearchMessage = 'Saisissez un lieu pour lancer la recherche Google Maps.';
      return;
    }

    this.isSearchingPlaces = true;
    this.mapSearchMessage = 'Recherche Google Maps en cours...';

    try {
      if (!this.googleMap) {
        await this.initializeGoogleMap();
      }

      const google = await this.googleMapsLoaderService.load();
      await this.locateUser(false, false);
      const match = await this.findPlaceWithGoogleMaps(google, query);

      if (!match) {
        this.mapSearchMessage = 'Aucun lieu Google Maps n a ete trouve pour cette recherche.';
        return;
      }

      this.requestedPlace = this.buildPlaceFromGoogleResult(match);
      this.selectedFilter = 'Tout';
      this.refreshPlaceCollection();
      this.mapSearchMessage = `Lieu charge depuis Google Maps: ${this.requestedPlace.name}.`;
    } catch {
      this.mapSearchMessage = 'La recherche Google Maps est indisponible pour le moment.';
    } finally {
      this.isSearchingPlaces = false;
    }
  }

  openRouteInGoogleMaps() {
    if (!this.routeUrl) {
      return;
    }

    window.open(this.routeUrl, '_blank', 'noopener');
  }

  toggleSplitView() {
    this.isSplitView = !this.isSplitView;
    this.queueMapResize();
  }

  onViewOnMap(place: Place) {
    this.selectPlace(place, true);
    this.focusMapOnPlace(place);
    this.scrollToMapOnMobile();
  }

  onOpenRoute(place: Place) {
    this.selectPlace(place, true);
    this.routeUrl = this.buildDirectionsUrl(place);
    this.openRouteInGoogleMaps();
  }

  onFilterStateChanged() {
    this.applyFilter();
  }

  isFavorite(place: Place): boolean {
    return typeof place.backendId === 'number' && this.favoriteBackendIds.has(place.backendId);
  }

  onToggleFavorite(place: Place) {
    this.coreDataService.toggleFavorite(place).subscribe({
      next: (isFavorite: boolean) => {
        if (typeof place.backendId === 'number') {
          if (isFavorite) {
            this.favoriteBackendIds.add(place.backendId);
          } else {
            this.favoriteBackendIds.delete(place.backendId);
          }
        }
      },
      error: () => {
        // Silencieux: certains lieux ne sont pas encore sauvegardes en backend.
      },
    });
  }

  getPlaceMeta(place: Place): PlaceCardMeta {
    const cached = this.metaCache.get(place.id);
    if (cached) {
      return cached;
    }

    const meta = this.buildPlaceMeta(place);
    this.metaCache.set(place.id, meta);
    return meta;
  }

  private loadMapContent() {
    this.placeCatalogService.getPlaces().subscribe((places: Place[]) => {
      this.catalogPlaces = places;
      this.refreshPlaceCollection();
    });
  }

  private refreshPlaceCollection() {
    this.allPlaces = this.mergeRequestedPlace(this.catalogPlaces);
    this.metaCache.clear();
    this.refreshFilterSource();
    this.selectRequestedPlaceIfAvailable();
  }

  private applyFilter() {
    const categoryFiltered = this.placeCatalogService.filterPlaces(this.allPlaces, this.selectedFilter);
    const distanceFiltered = categoryFiltered.filter((place: Place) => {
      const distance = this.distanceKmFromUser(place);

      if (typeof distance !== 'number') {
        return true;
      }

      return distance <= this.filterState.maxDistanceKm;
    });
    const ratingFiltered = distanceFiltered.filter((place: Place) => {
      const rating = typeof place.rating === 'number' ? place.rating : 0;
      return rating >= this.filterState.minRating;
    });
    const budgetFiltered = ratingFiltered.filter((place: Place) => {
      const budget = this.getPlaceMeta(place).estimatedBudget;
      return budget <= this.filterState.maxBudgetMad;
    });

    this.filteredPlaces = this.sortPlacesByDistance(budgetFiltered);

    if (this.selectedPlace && !this.filteredPlaces.some((place: Place) => place.id === this.selectedPlace?.id)) {
      this.selectedPlace = null;
      this.routeUrl = undefined;
      this.routeMessage = 'Choisissez un lieu sur la carte pour preparer l itineraire.';
      this.clearRenderedRoute();
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

  private refreshFilterSource() {
    this.filters = this.buildFilters(this.allPlaces);

    if (!this.filters.includes(this.selectedFilter)) {
      this.selectedFilter = this.filters[0] ?? 'Tout';
    }

    this.applyFilter();
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
      this.directionsService = new google.maps.DirectionsService();
      this.directionsRenderer = new google.maps.DirectionsRenderer({
        map: this.googleMap,
        suppressMarkers: true,
        polylineOptions: {
          strokeColor: '#2d7ff0',
          strokeOpacity: 0.9,
          strokeWeight: 5,
        },
      });
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
    this.updateUserMarker();

    const placesWithCoordinates = this.filteredPlaces.filter((place: Place) => this.hasCoordinates(place));
    const bounds = new google.maps.LatLngBounds();

    if (this.hasUserCoordinates()) {
      bounds.extend({
        lat: this.userLatitude as number,
        lng: this.userLongitude as number,
      });
    }

    if (!placesWithCoordinates.length) {
      if (this.hasUserCoordinates()) {
        this.googleMap.setCenter({
          lat: this.userLatitude as number,
          lng: this.userLongitude as number,
        });
        this.googleMap.setZoom(13);
      } else {
        this.googleMap.setCenter({ lat: 31.7917, lng: -7.0926 });
        this.googleMap.setZoom(6);
      }

      this.googleInfoWindow?.close();

      if (!this.selectedPlace || !this.hasCoordinates(this.selectedPlace)) {
        this.clearRenderedRoute();
      }

      return;
    }

    placesWithCoordinates.forEach((place: Place) => {
      const marker = new google.maps.Marker({
        map: this.googleMap,
        position: {
          lat: place.latitude as number,
          lng: place.longitude as number,
        },
        title: place.name,
        icon: this.buildMarkerIcon(place, false),
      });

      marker.addListener('click', () => {
        this.ngZone.run(() => this.selectPlace(place, true));
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

  private buildMarkerIcon(place: Place, isActive: boolean) {
    const heatColor = this.buildHeatColor(this.getPlaceMeta(place).popularity);

    return {
      path: window.google.maps.SymbolPath.CIRCLE,
      scale: isActive ? 9 : 7,
      fillColor: isActive ? '#2d7ff0' : heatColor,
      fillOpacity: 1,
      strokeColor: '#ffffff',
      strokeWeight: 2,
    };
  }

  private buildUserMarkerIcon() {
    return {
      path: window.google.maps.SymbolPath.CIRCLE,
      scale: 8,
      fillColor: '#2563eb',
      fillOpacity: 1,
      strokeColor: '#ffffff',
      strokeWeight: 3,
    };
  }

  private updateMarkerSelection() {
    this.googleMarkers.forEach((marker: any, placeId: string) => {
      const isActive = this.selectedPlace?.id === placeId;
      const place = this.filteredPlaces.find((item: Place) => item.id === placeId) || this.allPlaces.find((item: Place) => item.id === placeId);
      if (place) {
        marker.setIcon(this.buildMarkerIcon(place, isActive));
      }
      marker.setZIndex(isActive ? 10 : 1);
    });
  }

  private updateUserMarker() {
    if (!this.googleMap || !window.google?.maps) {
      return;
    }

    if (!this.hasUserCoordinates()) {
      this.userMarker?.setMap(null);
      this.userMarker = null;
      return;
    }

    const position = {
      lat: this.userLatitude as number,
      lng: this.userLongitude as number,
    };

    if (!this.userMarker) {
      this.userMarker = new window.google.maps.Marker({
        map: this.googleMap,
        position,
        title: 'Ma position',
        icon: this.buildUserMarkerIcon(),
        zIndex: 20,
      });
      return;
    }

    this.userMarker.setMap(this.googleMap);
    this.userMarker.setPosition(position);
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

  private refreshFavorites() {
    this.coreDataService.getFavoritePlaces().subscribe({
      next: (favorites) => {
        this.favoriteBackendIds = new Set(
          favorites
            .map((item) => item.place?.backendId)
            .filter((value: number | undefined): value is number => typeof value === 'number')
        );
      },
      error: () => {
        this.favoriteBackendIds = new Set<number>();
      },
    });
  }

  private queueListHighlight(place: Place) {
    if (typeof document === 'undefined') {
      return;
    }

    window.setTimeout(() => {
      const element = document.getElementById(`place-${place.id}`);
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element?.classList.add('pulse-highlight');
      window.setTimeout(() => element?.classList.remove('pulse-highlight'), 850);
    }, 40);
  }

  private scrollToMapOnMobile() {
    if (typeof window === 'undefined' || this.isSplitView || window.innerWidth >= 920) {
      return;
    }

    window.setTimeout(() => {
      this.mapPanelElement?.nativeElement?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 80);
  }

  private buildPlaceMeta(place: Place): PlaceCardMeta {
    const types = Array.isArray(place.types) ? place.types : [];
    const text = this.normalizeText(`${place.category} ${types.join(' ')} ${place.name} ${place.location}`);

    const tags: string[] = [];
    if (text.includes('romant') || text.includes('couple')) tags.push('romantique');
    if (text.includes('cafe') || text.includes('coffee')) tags.push('calme');
    if (text.includes('plage') || text.includes('beach')) tags.push('vue mer');
    if (text.includes('park') || text.includes('parc') || text.includes('jardin')) tags.push('nature');
    if (text.includes('museum') || text.includes('musee')) tags.push('culture');

    if (tags.length === 0) {
      tags.push('flex');
    }

    const estimatedBudget = this.estimateBudgetMad(text);
    const avgDurationMinutes = this.estimateDurationMinutes(text);
    const popularity = this.estimatePopularity(place);

    return {
      tags: tags.slice(0, 4),
      estimatedBudget,
      avgDurationMinutes,
      popularity,
    };
  }

  private estimateBudgetMad(text: string): number {
    if (text.includes('hotel') || text.includes('spa')) return 900;
    if (text.includes('restaurant')) return 250;
    if (text.includes('cafe')) return 80;
    if (text.includes('museum') || text.includes('musee')) return 60;
    if (text.includes('plage') || text.includes('park') || text.includes('parc')) return 40;
    return 120;
  }

  private estimateDurationMinutes(text: string): number {
    if (text.includes('museum') || text.includes('musee')) return 90;
    if (text.includes('restaurant')) return 75;
    if (text.includes('cafe')) return 50;
    if (text.includes('plage') || text.includes('park') || text.includes('parc')) return 120;
    return 60;
  }

  private estimatePopularity(place: Place): number {
    const base = Math.max(0, Math.min(1, (place.rating || 0) / 5));
    const seed = this.hashToUnit(place.id);
    const blended = 0.65 * base + 0.35 * seed;
    return Math.max(0, Math.min(1, blended));
  }

  private buildHeatColor(popularity: number): string {
    const p = Math.max(0, Math.min(1, popularity));
    const r = Math.round(59 + (239 - 59) * p);
    const g = Math.round(130 + (68 - 130) * p);
    const b = Math.round(246 + (68 - 246) * p);
    return `rgb(${r}, ${g}, ${b})`;
  }

  private hashToUnit(value: string): number {
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) {
      hash = ((hash << 5) - hash) + value.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash % 1000) / 1000;
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

  private async prepareRoute(place: Place) {
    this.routeUrl = this.buildDirectionsUrl(place);

    if (!this.hasCoordinates(place)) {
      this.routeMessage = 'Ce lieu ne dispose pas de coordonnees suffisantes pour un itineraire.';
      this.clearRenderedRoute();
      return;
    }

    if (!this.hasUserCoordinates()) {
      await this.locateUser(false);
    }

    if (this.hasUserCoordinates()) {
      this.renderRoute(place);
      return;
    }

    this.routeMessage = 'Position non detectee. Activez votre position ou ouvrez l itineraire dans Google Maps.';
    this.clearRenderedRoute();
  }

  private renderRoute(place: Place) {
    if (!this.directionsService || !this.directionsRenderer || !this.hasCoordinates(place) || !this.hasUserCoordinates()) {
      return;
    }

    this.directionsService.route(
      {
        origin: {
          lat: this.userLatitude as number,
          lng: this.userLongitude as number,
        },
        destination: {
          lat: place.latitude as number,
          lng: place.longitude as number,
        },
        travelMode: window.google.maps.TravelMode.DRIVING,
      },
      (result: any, status: string) => {
        this.ngZone.run(() => {
          if (status === 'OK' && result) {
            this.directionsRenderer?.setDirections(result);

            const leg = result.routes?.[0]?.legs?.[0];
            this.routeDistanceText = leg?.distance?.text || undefined;
            this.routeDurationText = leg?.duration?.text || undefined;

            const distance = this.routeDistanceText ? ` (${this.routeDistanceText})` : '';
            const duration = this.routeDurationText ? ` en ${this.routeDurationText}` : '';

            this.routeMessage = `Itineraire vers ${place.name}${distance}${duration}.`;
            return;
          }

          this.clearRenderedRoute();
          this.routeMessage = 'Impossible d afficher l itineraire sur la carte. Ouvrez Google Maps pour continuer.';
        });
      }
    );
  }

  private clearRenderedRoute() {
    this.directionsRenderer?.set('directions', null);
    this.routeDistanceText = undefined;
    this.routeDurationText = undefined;
  }

  distanceKmFromUser(place: Place): number | undefined {
    if (!this.hasUserCoordinates() || !this.hasCoordinates(place)) {
      return undefined;
    }

    const earthRadiusKm = 6371;
    const lat1 = (this.userLatitude as number) * (Math.PI / 180);
    const lon1 = (this.userLongitude as number) * (Math.PI / 180);
    const lat2 = (place.latitude as number) * (Math.PI / 180);
    const lon2 = (place.longitude as number) * (Math.PI / 180);

    const dLat = lat2 - lat1;
    const dLon = lon2 - lon1;

    const a = Math.sin(dLat / 2) ** 2
      + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return earthRadiusKm * c;
  }

  private sortPlacesByDistance(places: Place[]): Place[] {
    if (!this.hasUserCoordinates()) {
      return places;
    }

    return [...places].sort((a: Place, b: Place) => {
      const da = this.distanceKmFromUser(a);
      const db = this.distanceKmFromUser(b);

      const left = typeof da === 'number' ? da : Number.POSITIVE_INFINITY;
      const right = typeof db === 'number' ? db : Number.POSITIVE_INFINITY;

      return left - right;
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
      } else if (this.hasUserCoordinates()) {
        this.googleMap.panTo({
          lat: this.userLatitude as number,
          lng: this.userLongitude as number,
        });
      }
    }, 120);
  }

  private buildDirectionsUrl(place: Place): string | undefined {
    const destination = this.resolveDestinationValue(place);

    if (!destination) {
      return place.googleMapsUrl;
    }

    const params = new URLSearchParams({
      api: '1',
      destination,
      travelmode: 'driving',
    });

    if (this.hasUserCoordinates()) {
      params.set('origin', `${this.userLatitude},${this.userLongitude}`);
    }

    return `https://www.google.com/maps/dir/?${params.toString()}`;
  }

  private resolveDestinationValue(place: Place): string | undefined {
    if (typeof place.latitude === 'number' && typeof place.longitude === 'number') {
      return `${place.latitude},${place.longitude}`;
    }

    const query = [place.name, place.address].filter((segment: string) => segment.trim().length > 0).join(', ');
    return query || undefined;
  }

  private buildRequestedPlace(params: ParamMap): Place | null {
    const placeId = params.get('placeId')?.trim() || undefined;
    const name = params.get('name')?.trim();
    const location = params.get('location')?.trim() || 'Maroc';
    const address = params.get('address')?.trim() || location;
    const category = params.get('category')?.trim() || 'Lieu';
    const googleMapsUrl = params.get('googleMapsUrl')?.trim() || undefined;
    const latitude = this.readCoordinate(params.get('latitude'));
    const longitude = this.readCoordinate(params.get('longitude'));

    if (!placeId && !name && (typeof latitude !== 'number' || typeof longitude !== 'number')) {
      return null;
    }

    const fallbackName = name || 'Destination';
    const fallbackId = placeId || this.slugify(`${fallbackName}-${location}`);

    return {
      id: fallbackId,
      externalPlaceId: placeId,
      name: fallbackName,
      location,
      rating: 0,
      reviewsLabel: location,
      reviewsCount: 0,
      category,
      badge: location,
      theme: 'theme-rabat',
      icon: 'navigate-outline',
      spotlight: 'Destination preparee depuis la recherche.',
      shortDescription: address,
      longDescription: `Destination preparee vers ${fallbackName}.`,
      address,
      hours: 'Consultez Google Maps pour les horaires du jour',
      starsLabel: 'Nouveau',
      highlights: [location, category].filter((item: string) => item.trim().length > 0),
      googleMapsUrl,
      latitude,
      longitude,
      city: location,
    };
  }

  private mergeRequestedPlace(places: Place[]): Place[] {
    const requestedPlace = this.findMatchingRequestedPlace(places);

    if (!requestedPlace) {
      return places;
    }

    this.requestedPlace = requestedPlace;

    if (places.some((place: Place) => place.id === requestedPlace.id)) {
      return places;
    }

    return [requestedPlace, ...places];
  }

  private selectRequestedPlaceIfAvailable() {
    if (!this.requestedPlace) {
      return;
    }

    const matchingPlace = this.findMatchingRequestedPlace(this.allPlaces) || this.requestedPlace;

    if (this.selectedFilter !== 'Tout') {
      this.selectedFilter = 'Tout';
      this.applyFilter();
    }

    this.selectPlace(matchingPlace, true);
  }

  private findMatchingRequestedPlace(places: Place[]): Place | null {
    if (!this.requestedPlace) {
      return null;
    }

    const requestedId = this.requestedPlace.id;
    const requestedExternalId = this.requestedPlace.externalPlaceId;

    return places.find((place: Place) => {
      if (place.id === requestedId) {
        return true;
      }

      if (requestedExternalId && (place.id === requestedExternalId || place.externalPlaceId === requestedExternalId)) {
        return true;
      }

      return false;
    }) ?? this.requestedPlace;
  }

  private readCoordinate(value: string | null): number | undefined {
    if (!value?.trim()) {
      return undefined;
    }

    const parsedValue = Number(value);
    return Number.isFinite(parsedValue) ? parsedValue : undefined;
  }

  private hasCoordinates(place: Place | null): boolean {
    return !!place && typeof place.latitude === 'number' && typeof place.longitude === 'number';
  }

  private hasUserCoordinates(): boolean {
    return typeof this.userLatitude === 'number' && typeof this.userLongitude === 'number';
  }

  private slugify(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private findPlaceWithGoogleMaps(google: any, query: string): Promise<any | null> {
    if (!google?.maps?.places?.PlacesService) {
      return Promise.resolve(null);
    }

    const placesService = new google.maps.places.PlacesService(this.googleMap || document.createElement('div'));
    const request: Record<string, unknown> = {
      query,
      region: 'ma',
    };

    const mapBounds = this.googleMap?.getBounds?.();

    if (mapBounds) {
      request['bounds'] = mapBounds;
    } else if (this.hasUserCoordinates()) {
      request['location'] = new google.maps.LatLng(this.userLatitude as number, this.userLongitude as number);
      request['radius'] = 25000;
    }

    return new Promise((resolve) => {
      placesService.textSearch(request, (results: any[] | null, status: string) => {
        const successStatus = google.maps.places.PlacesServiceStatus.OK;
        resolve(status === successStatus && results?.length ? results[0] : null);
      });
    });
  }

  private buildPlaceFromGoogleResult(result: any): Place {
    const latitude = typeof result?.geometry?.location?.lat === 'function'
      ? result.geometry.location.lat()
      : undefined;
    const longitude = typeof result?.geometry?.location?.lng === 'function'
      ? result.geometry.location.lng()
      : undefined;
    const name = typeof result?.name === 'string' && result.name.trim().length > 0
      ? result.name.trim()
      : 'Destination';
    const address = typeof result?.formatted_address === 'string' && result.formatted_address.trim().length > 0
      ? result.formatted_address.trim()
      : 'Maroc';
    const location = this.extractLocationFromAddress(address);
    const category = this.buildCategoryFromTypes(Array.isArray(result?.types) ? result.types : []);
    const rating = typeof result?.rating === 'number' ? result.rating : 0;
    const photoUrl = this.resolveGooglePlacePhoto(result);
    const fallbackImageUrl = this.placeCatalogService.buildFallbackImageUrl({
      name,
      address,
      latitude,
      longitude,
    });

    return {
      id: typeof result?.place_id === 'string' && result.place_id.trim().length > 0
        ? result.place_id.trim()
        : this.slugify(`${name}-${location}`),
      externalPlaceId: typeof result?.place_id === 'string' ? result.place_id.trim() : undefined,
      name,
      location,
      rating,
      reviewsLabel: location,
      reviewsCount: typeof result?.user_ratings_total === 'number' ? result.user_ratings_total : 0,
      category,
      badge: location,
      theme: this.pickTheme(category, location, name),
      icon: this.pickIcon(category, Array.isArray(result?.types) ? result.types : []),
      spotlight: `Destination Google Maps preparee pour ${name}.`,
      shortDescription: this.truncate(address, 110),
      longDescription: `Destination Google Maps preparee pour ${name}. Utilisez la carte pour voir l itineraire et les informations locales.`,
      address,
      hours: 'Consultez Google Maps pour les horaires du jour',
      starsLabel: this.buildStarsLabel(rating),
      highlights: this.buildHighlights(Array.isArray(result?.types) ? result.types : [], location, address),
      imageUrl: photoUrl || fallbackImageUrl,
      fallbackImageUrl,
      googleMapsUrl: this.buildGoogleMapsUrl(name, address, latitude, longitude, result?.place_id),
      latitude,
      longitude,
      types: Array.isArray(result?.types)
        ? result.types.filter((type: unknown): type is string => typeof type === 'string' && type.trim().length > 0)
        : [],
      city: location,
    };
  }

  private mapRecommendedPlaceToPlace(item: RecommendedPlaceApi['place']): Place {
    const name = item?.name?.trim() || 'Lieu recommande';
    const location = this.primaryLocation || 'Maroc';
    const category = item?.category?.trim() || 'Lieu';

    return {
      id: item?.id?.trim() || this.slugify(`${name}-${category}`),
      name,
      location,
      rating: typeof item?.rating === 'number' ? item.rating : 0,
      reviewsLabel: location,
      reviewsCount: 0,
      category,
      badge: location,
      theme: this.pickTheme(category, location, name),
      icon: this.pickIcon(category, []),
      spotlight: `Suggestion IA pour ${name}.`,
      shortDescription: category,
      longDescription: `Suggestion IA pour ${name}.`,
      address: location,
      hours: 'Consultez Google Maps pour les horaires du jour',
      starsLabel: this.buildStarsLabel(typeof item?.rating === 'number' ? item.rating : 0),
      highlights: [category, location].filter(Boolean),
      imageUrl: this.placeCatalogService.buildFallbackImageUrl({
        name,
        address: location,
        latitude: item?.latitude,
        longitude: item?.longitude,
      }),
      fallbackImageUrl: this.placeCatalogService.buildFallbackImageUrl({
        name,
        address: location,
        latitude: item?.latitude,
        longitude: item?.longitude,
      }),
      latitude: item?.latitude,
      longitude: item?.longitude,
      city: location,
    };
  }

  private resolveGooglePlacePhoto(result: any): string | undefined {
    const firstPhoto = Array.isArray(result?.photos) ? result.photos[0] : null;

    if (!firstPhoto || typeof firstPhoto.getUrl !== 'function') {
      return undefined;
    }

    try {
      return firstPhoto.getUrl({
        maxWidth: 1200,
        maxHeight: 800,
      });
    } catch {
      return undefined;
    }
  }

  private buildGoogleMapsUrl(
    name: string,
    address: string,
    latitude?: number,
    longitude?: number,
    placeId?: unknown
  ): string | undefined {
    if (typeof latitude === 'number' && typeof longitude === 'number') {
      const params = new URLSearchParams({
        api: '1',
        query: `${latitude},${longitude}`,
      });

      if (typeof placeId === 'string' && placeId.trim().length > 0) {
        params.set('query_place_id', placeId.trim());
      }

      return `https://www.google.com/maps/search/?${params.toString()}`;
    }

    const query = [name, address].filter((segment: string) => segment.trim().length > 0).join(', ');
    return query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : undefined;
  }

  private extractLocationFromAddress(address: string): string {
    const segments = address
      .split(',')
      .map((segment: string) => segment.trim())
      .filter((segment: string) => segment.length > 0);

    if (segments.length >= 2) {
      return segments[segments.length - 2];
    }

    return segments[segments.length - 1] || 'Maroc';
  }

  private buildCategoryFromTypes(types: string[]): string {
    const semanticType = types.find((type: string) => !['point_of_interest', 'establishment', 'food', 'store'].includes(type));
    return this.toTitleCase((semanticType || 'lieu').replace(/[_-]+/g, ' '));
  }

  private buildHighlights(types: string[], location: string, address: string): string[] {
    return Array.from(new Set([
      ...types.map((type: string) => this.toTitleCase(type.replace(/[_-]+/g, ' '))),
      location,
      address,
    ].filter((value: string) => value.trim().length > 0))).slice(0, 4);
  }

  private buildStarsLabel(rating: number): string {
    if (!Number.isFinite(rating) || rating <= 0) {
      return 'Nouveau';
    }

    return '*'.repeat(Math.max(1, Math.min(5, Math.round(rating))));
  }

  private pickTheme(category: string, location: string, name: string): string {
    const text = this.normalizeText(`${category} ${location} ${name}`);

    if (text.includes('plage') || text.includes('beach') || text.includes('ocean')) {
      return 'theme-agadir';
    }

    if (text.includes('marrakech')) {
      return 'theme-marrakech';
    }

    if (text.includes('chefchaouen')) {
      return 'theme-chefchaouen';
    }

    if (text.includes('zoo') || text.includes('family') || text.includes('parc')) {
      return 'theme-zoo';
    }

    return 'theme-rabat';
  }

  private pickIcon(category: string, types: string[]): string {
    const text = this.normalizeText(`${category} ${types.join(' ')}`);

    if (text.includes('plage') || text.includes('beach') || text.includes('ocean')) {
      return 'water-outline';
    }

    if (text.includes('cafe')) {
      return 'cafe-outline';
    }

    if (text.includes('restaurant')) {
      return 'restaurant-outline';
    }

    if (text.includes('hotel') || text.includes('lodging')) {
      return 'bed-outline';
    }

    if (text.includes('park') || text.includes('parc')) {
      return 'leaf-outline';
    }

    return 'compass-outline';
  }

  private truncate(value: string, limit: number): string {
    return value.length <= limit ? value : `${value.slice(0, limit - 3).trim()}...`;
  }

  private toTitleCase(value: string): string {
    return value
      .split(' ')
      .filter((segment: string) => segment.length > 0)
      .map((segment: string) => `${segment[0].toUpperCase()}${segment.slice(1)}`)
      .join(' ');
  }

  private normalizeText(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }
}
