import { AfterViewInit, Component, ElementRef, NgZone, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, ParamMap } from '@angular/router';
import * as L from 'leaflet';
import { Place } from '../data/tourism.data';
import { RecommendedPlaceApi } from '../models/recommendation.model';
import { AiPlaceService } from '../services/ai-place.service';
import { CompareService } from '../services/compare.service';
import { FavoritesService } from '../services/favorites.service';
import { CityPack, CITY_PACKS, OfflinePackService, PackInfo } from '../services/offline-pack.service';
import { PlaceCatalogService } from '../services/place-catalog.service';
import { UserLocationService } from '../services/user-location.service';
import { PlaceCardMeta } from '../shared/place-card/place-card.component';

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
  isListMode = false;
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
  private googleMap: L.Map | null = null;
  private googleMarkers = new Map<string, L.CircleMarker>();
  private userMarker: L.CircleMarker | null = null;
  private routePolyline: L.Polyline | null = null;
  private viewInitialized = false;
  private requestedPlace: Place | null = null;
  private catalogPlaces: Place[] = [];

  filterState = {
    maxDistanceKm: 25,
    minRating: 0,
    maxBudgetMad: 2000,
  };

  isFiltersExpanded = false;

  // ── Mode hors-ligne "Pack Ville" ──────────────────────────
  isOfflinePanelOpen = false;
  readonly cityPacks: CityPack[] = CITY_PACKS;
  packInfos: Record<string, PackInfo> = {};
  downloadingId: string | null = null;
  downloadPercent = 0;

  toggleFilters() {
    this.isFiltersExpanded = !this.isFiltersExpanded;
  }

  toggleOfflinePanel() {
    this.isOfflinePanelOpen = !this.isOfflinePanelOpen;
    if (this.isOfflinePanelOpen) {
      this.loadPackStatuses();
    }
  }

  isPackDownloaded(id: string): boolean {
    return !!this.packInfos[id];
  }

  formatBytes(bytes?: number): string {
    if (!bytes) {
      return '';
    }
    if (bytes < 1024 * 1024) {
      return `${Math.round(bytes / 1024)} Ko`;
    }
    return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
  }

  async downloadCityPack(pack: CityPack) {
    if (this.downloadingId) {
      return;
    }

    this.downloadingId = pack.id;
    this.downloadPercent = 0;

    const places = this.placesForCity(pack);

    try {
      const info = await this.offlinePackService.downloadPack(pack, places, (progress) => {
        this.ngZone.run(() => {
          this.downloadPercent = Math.round(progress.ratio * 100);
        });
      });
      this.ngZone.run(() => {
        this.packInfos = { ...this.packInfos, [pack.id]: info };
      });
    } catch {
      // Telechargement interrompu (reseau) : le pack partiel reste exploitable.
    } finally {
      this.ngZone.run(() => {
        this.downloadingId = null;
        this.downloadPercent = 0;
      });
    }
  }

  async removeCityPack(pack: CityPack) {
    await this.offlinePackService.deletePack(pack);
    this.ngZone.run(() => {
      const next = { ...this.packInfos };
      delete next[pack.id];
      this.packInfos = next;
    });
  }

  private loadPackStatuses() {
    this.offlinePackService.listDownloaded().then((list) => {
      this.ngZone.run(() => {
        const map: Record<string, PackInfo> = {};
        list.forEach((info) => { map[info.id] = info; });
        this.packInfos = map;
      });
    });
  }

  private placesForCity(pack: CityPack): Place[] {
    const [south, west, north, east] = pack.bbox;
    const target = this.normalizeText(pack.name);

    const inBbox = (place: Place): boolean =>
      typeof place.latitude === 'number' && typeof place.longitude === 'number'
      && place.latitude >= south && place.latitude <= north
      && place.longitude >= west && place.longitude <= east;

    const matchesName = (place: Place): boolean =>
      this.normalizeText(place.city || '').includes(target)
      || this.normalizeText(place.location || '').includes(target);

    return this.allPlaces
      .filter((place: Place) => inBbox(place) || matchesName(place))
      .sort((a: Place, b: Place) => (b.rating || 0) - (a.rating || 0))
      .slice(0, 50);
  }

  toggleListMode() {
    this.isListMode = !this.isListMode;
  }

  switchToMapView() {
    this.isListMode = false;
    this.queueMapResize();
  }

  getCardBgImage(place: Place): string {
    const url = place.photo_url
      ?? place.photo_urls?.[0]
      ?? place.imageUrl
      ?? place.fallbackImageUrl;
    return url ? `url('${url}')` : '';
  }

  handlePlaceImageError(place: Place) {
    place.imageUrl = undefined;
  }

  constructor(
    private route: ActivatedRoute,
    private placeCatalogService: PlaceCatalogService,
    private aiPlaceService: AiPlaceService,
    private ngZone: NgZone,
    private userLocationService: UserLocationService,
    private compareService: CompareService,
    private favoritesService: FavoritesService,
    private offlinePackService: OfflinePackService,
  ) {}

  get hasUserLocation(): boolean {
    return this.hasUserCoordinates();
  }

  /** Libelle affiche dans la pastille de localisation (plus de "Rabat" fige). */
  get cityLabel(): string {
    if (this.selectedPlace?.location) {
      return this.selectedPlace.location;
    }
    if (this.hasUserCoordinates()) {
      return 'Ma position';
    }
    return this.filteredPlaces[0]?.location || 'Maroc';
  }

  isInCompare(place: Place): boolean {
    return this.compareService.isSelected(place.id);
  }

  onToggleCompare(place: Place): void {
    this.compareService.toggle(place);
  }

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
    this.loadPackStatuses();
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
    this.clearRenderedRoute();
    this.userMarker?.remove();
    this.googleMap?.remove();
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
        this.googleMap.panTo([this.userLatitude, this.userLongitude]);

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
    // Les recommandations ne sont pas affichees dans cette vue carte.
    this.isLoadingRecommendations = false;
    this.recommendationsErrorMessage = '';
    this.recommendedPlaces = [];
  }

  async searchInGoogleMaps() {
    const query = this.searchQuery.trim();

    if (!query) {
      this.mapSearchMessage = 'Saisissez un lieu pour lancer la recherche OpenStreetMap.';
      return;
    }

    this.isSearchingPlaces = true;
    this.mapSearchMessage = 'Recherche OpenStreetMap en cours...';

    try {
      if (!this.googleMap) {
        await this.initializeGoogleMap();
      }

      await this.locateUser(false, false);
      const match = await this.findPlaceWithGoogleMaps(query);

      if (!match) {
        this.mapSearchMessage = 'Aucun lieu OpenStreetMap n a ete trouve pour cette recherche.';
        return;
      }

      this.requestedPlace = this.buildPlaceFromGoogleResult(match);
      this.selectedFilter = 'Tout';
      this.refreshPlaceCollection();
      this.mapSearchMessage = `Lieu charge depuis OpenStreetMap: ${this.requestedPlace.name}.`;
    } catch {
      this.mapSearchMessage = 'La recherche OpenStreetMap est indisponible pour le moment.';
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
    // Meme source de verite que la page details et la page favoris.
    return this.favoritesService.isFavorite(place.id);
  }

  onToggleFavorite(place: Place) {
    this.favoritesService.toggle(place);
  }

  getPlaceMeta(place: Place): PlaceCardMeta {
    return this.buildPlaceMeta(place);
  }

  private loadMapContent() {
    this.placeCatalogService.getPlaces().subscribe((places: Place[]) => {
      if (places.length === 0) {
        // Reseau indisponible: repli sur les lieux mis en cache hors-ligne.
        this.offlinePackService.getCachedPlaces().then((cached: Place[]) => {
          if (cached.length > 0) {
            this.ngZone.run(() => {
              this.catalogPlaces = cached;
              this.refreshPlaceCollection();
            });
          }
        });
      }

      this.catalogPlaces = places;
      this.refreshPlaceCollection();
    });
  }

  private refreshPlaceCollection() {
    this.allPlaces = this.mergeRequestedPlace(this.catalogPlaces);
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
      if (!this.googleMapElement?.nativeElement) {
        return;
      }

      this.googleMap = L.map(this.googleMapElement.nativeElement, {
        center: [31.7917, -7.0926],
        zoom: 6,
        zoomControl: true,
      });

      // Couche hors-ligne: sert les tuiles en cache (packs villes) puis le reseau.
      this.offlinePackService.createTileLayer().addTo(this.googleMap);

      this.mapErrorMessage = '';
      this.syncGoogleMap();
      this.queueMapResize();
    } catch {
      this.mapErrorMessage = 'La carte OpenStreetMap ne s affiche pas pour le moment.';
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

    this.clearGoogleMarkers();
    this.updateUserMarker();

    const placesWithCoordinates = this.filteredPlaces.filter((place: Place) => this.hasCoordinates(place));
    const bounds = L.latLngBounds([] as L.LatLngTuple[]);

    if (this.hasUserCoordinates()) {
      bounds.extend([this.userLatitude as number, this.userLongitude as number]);
    }

    if (!placesWithCoordinates.length) {
      if (this.hasUserCoordinates()) {
        this.googleMap.setView([this.userLatitude as number, this.userLongitude as number], 13);
        this.googleMap.setZoom(13);
      } else {
        this.googleMap.setView([31.7917, -7.0926], 6);
        this.googleMap.setZoom(6);
      }

      if (!this.selectedPlace || !this.hasCoordinates(this.selectedPlace)) {
        this.clearRenderedRoute();
      }

      return;
    }

    placesWithCoordinates.forEach((place: Place) => {
      const marker = L.circleMarker([place.latitude as number, place.longitude as number], this.buildMarkerIcon(place, false));
      marker.addTo(this.googleMap as L.Map);

      marker.on('click', () => {
        this.ngZone.run(() => this.selectPlace(place, true));
      });

      this.googleMarkers.set(place.id, marker);
      bounds.extend(marker.getLatLng());
    });

    if (this.selectedPlace && this.hasCoordinates(this.selectedPlace)) {
      this.focusMapOnPlace(this.selectedPlace);
    } else {
      this.googleMap.fitBounds(bounds.pad(0.2));
    }

    this.updateMarkerSelection();

    if (this.selectedPlace) {
      this.openInfoWindow(this.selectedPlace);
    }
  }

  private buildMarkerIcon(place: Place, isActive: boolean) {
    const heatColor = this.buildHeatColor(this.getPlaceMeta(place).popularity);

    return {
      radius: isActive ? 9 : 7,
      fillColor: isActive ? '#2d7ff0' : heatColor,
      fillOpacity: 1,
      color: '#ffffff',
      weight: 2,
    };
  }

  private buildUserMarkerIcon() {
    return {
      radius: 8,
      fillColor: '#2563eb',
      fillOpacity: 1,
      color: '#ffffff',
      weight: 3,
    };
  }

  private updateMarkerSelection() {
    this.googleMarkers.forEach((marker: any, placeId: string) => {
      const isActive = this.selectedPlace?.id === placeId;
      const place = this.filteredPlaces.find((item: Place) => item.id === placeId) || this.allPlaces.find((item: Place) => item.id === placeId);
      if (place) {
        marker.setStyle(this.buildMarkerIcon(place, isActive));
      }
      marker.bringToFront();
    });
  }

  private updateUserMarker() {
    if (!this.googleMap) {
      return;
    }

    if (!this.hasUserCoordinates()) {
      this.userMarker?.remove();
      this.userMarker = null;
      return;
    }

    const position: L.LatLngTuple = [this.userLatitude as number, this.userLongitude as number];

    if (!this.userMarker) {
      this.userMarker = L.circleMarker(position, this.buildUserMarkerIcon()).addTo(this.googleMap);
      this.userMarker.bindTooltip('Ma position', { direction: 'top', offset: [0, -6] });
      return;
    }

    this.userMarker.setLatLng(position);
    this.userMarker.setStyle(this.buildUserMarkerIcon());
  }

  private focusMapOnPlace(place: Place) {
    if (!this.googleMap || !this.hasCoordinates(place)) {
      return;
    }

    this.googleMap.panTo([place.latitude as number, place.longitude as number]);

    if ((this.googleMap.getZoom?.() ?? 0) < 13) {
      this.googleMap.setZoom(13);
    }
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
    if (!this.googleMap) {
      return;
    }

    const marker = this.googleMarkers.get(place.id);

    if (!marker) {
      return;
    }

    // Get the best available image for display in popup
    const imageUrl = place.photo_url || (place.photo_urls && place.photo_urls.length > 0 ? place.photo_urls[0] : null) || place.imageUrl;
    
    // Build the popup content with image if available
    let popupContent = `<div style="padding:0;max-width:280px;border-radius:8px;overflow:hidden;">`;
    
    if (imageUrl) {
      popupContent += `<img src="${this.escapeHtml(imageUrl)}" style="width:100%;height:160px;object-fit:cover;display:block;" alt="${this.escapeHtml(place.name)}" onerror="this.style.display='none'"/>`;
    }
    
    popupContent += `<div style="padding:12px 10px;">
      <strong style="font-size:14px;">${this.escapeHtml(place.name)}</strong>
      <div style="margin-top:4px;font-size:12px;color:#667085;">${this.escapeHtml(place.location)}</div>
      ${place.category ? `<div style="margin-top:6px;font-size:11px;color:#9ca3af;"><span style="background:#f3f4f6;padding:2px 8px;border-radius:4px;">${this.escapeHtml(place.category)}</span></div>` : ''}
    </div></div>`;

    marker.bindPopup(popupContent);
    marker.openPopup();
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
      await this.renderRoute(place);
      return;
    }

    this.routeMessage = 'Position non detectee. Activez votre position ou ouvrez l itineraire dans Google Maps.';
    this.clearRenderedRoute();
  }

  private async renderRoute(place: Place) {
    if (!this.googleMap || !this.hasCoordinates(place) || !this.hasUserCoordinates()) {
      return;
    }

    const originLat = this.userLatitude as number;
    const originLng = this.userLongitude as number;
    const destinationLat = place.latitude as number;
    const destinationLng = place.longitude as number;

    const url = `https://router.project-osrm.org/route/v1/driving/${originLng},${originLat};${destinationLng},${destinationLat}?overview=full&geometries=geojson`;

    try {
      const response = await fetch(url);
      const payload = await response.json();
      const route = payload?.routes?.[0];

      if (!route?.geometry?.coordinates?.length) {
        throw new Error('No route geometry');
      }

      const coordinates = route.geometry.coordinates as Array<[number, number]>;
      const latLngs = coordinates.map((coordinate) => [coordinate[1], coordinate[0]] as L.LatLngTuple);

      this.clearRenderedRoute();
      this.routePolyline = L.polyline(latLngs, {
        color: '#2d7ff0',
        weight: 5,
        opacity: 0.9,
      }).addTo(this.googleMap);

      this.routeDistanceText = `${(route.distance / 1000).toFixed(1)} km`;
      const durationMinutes = Math.max(1, Math.round((route.duration || 0) / 60));
      this.routeDurationText = `${durationMinutes} min`;

      const distance = this.routeDistanceText ? ` (${this.routeDistanceText})` : '';
      const duration = this.routeDurationText ? ` en ${this.routeDurationText}` : '';
      this.routeMessage = `Itineraire vers ${place.name}${distance}${duration}.`;

      if (this.routePolyline) {
        this.googleMap.fitBounds(this.routePolyline.getBounds().pad(0.18));
      }
    } catch {
      this.clearRenderedRoute();
      this.routeMessage = 'Impossible d afficher l itineraire sur la carte. Ouvrez Google Maps pour continuer.';
    }
  }

  private clearRenderedRoute() {
    this.routePolyline?.remove();
    this.routePolyline = null;
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
    this.googleMarkers.forEach((marker: L.CircleMarker) => marker.remove());
    this.googleMarkers.clear();
  }

  private queueMapResize() {
    if (!this.googleMap) {
      return;
    }

    window.setTimeout(() => {
      this.googleMap?.invalidateSize();

      if (this.selectedPlace) {
        this.focusMapOnPlace(this.selectedPlace);
      } else if (this.hasUserCoordinates()) {
        this.googleMap?.panTo([this.userLatitude as number, this.userLongitude as number]);
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
    const imageUrlParam = params.get('imageUrl')?.trim() || undefined;
    const photoUrl = params.get('photo_url')?.trim() || undefined;
    const photoUrlsParam = params.get('photo_urls')?.trim();
    const latitude = this.readCoordinate(params.get('latitude'));
    const longitude = this.readCoordinate(params.get('longitude'));

    if (!placeId && !name && (typeof latitude !== 'number' || typeof longitude !== 'number')) {
      return null;
    }

    // Parse photo_urls JSON array
    let photoUrls: string[] | undefined;
    if (photoUrlsParam) {
      try {
        photoUrls = JSON.parse(photoUrlsParam);
        if (!Array.isArray(photoUrls)) {
          photoUrls = undefined;
        }
      } catch {
        photoUrls = undefined;
      }
    }

    const fallbackName = name || 'Destination';
    const fallbackId = placeId || this.slugify(`${fallbackName}-${location}`);
    const imageUrl = imageUrlParam || photoUrl || (photoUrls && photoUrls.length > 0 ? photoUrls[0] : undefined);

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
      imageUrl,
      fallbackImageUrl: undefined,
      photo_url: photoUrl,
      photo_urls: photoUrls,
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

  private async findPlaceWithGoogleMaps(query: string): Promise<any | null> {
    const params = new URLSearchParams({
      q: query,
      format: 'jsonv2',
      addressdetails: '1',
      limit: '1',
      countrycodes: 'ma',
    });

    if (this.hasUserCoordinates()) {
      params.set('lat', String(this.userLatitude));
      params.set('lon', String(this.userLongitude));
    }

    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json() as any[];
    return payload.length ? payload[0] : null;
  }

  private buildPlaceFromGoogleResult(result: any): Place {
    const latitude = this.readCoordinate(typeof result?.lat === 'string' ? result.lat : String(result?.lat ?? ''));
    const longitude = this.readCoordinate(typeof result?.lon === 'string' ? result.lon : String(result?.lon ?? ''));
    const name = typeof result?.display_name === 'string' && result.display_name.trim().length > 0
      ? result.display_name.split(',')[0].trim()
      : 'Destination';
    const address = typeof result?.display_name === 'string' && result.display_name.trim().length > 0
      ? result.display_name.trim()
      : 'Maroc';
    const location = this.extractLocationFromAddress(address);
    const category = this.toTitleCase((result?.type || 'lieu').replace(/[_-]+/g, ' '));
    const rating = 0;
    const fallbackImageUrl = this.placeCatalogService.buildFallbackImageUrl({
      name,
      address,
      latitude,
      longitude,
    });

    return {
      id: result?.place_id
        ? String(result.place_id).trim()
        : this.slugify(`${name}-${location}`),
      externalPlaceId: result?.place_id ? String(result.place_id).trim() : undefined,
      name,
      location,
      rating,
      reviewsLabel: location,
      reviewsCount: 0,
      category,
      badge: location,
      theme: this.pickTheme(category, location, name),
      icon: this.pickIcon(category, [result?.type || '']),
      spotlight: `Destination OpenStreetMap preparee pour ${name}.`,
      shortDescription: this.truncate(address, 110),
      longDescription: `Destination OpenStreetMap preparee pour ${name}. Utilisez la carte pour voir l itineraire et les informations locales.`,
      address,
      hours: 'Consultez Google Maps pour les horaires du jour',
      starsLabel: this.buildStarsLabel(rating),
      highlights: this.buildHighlights([result?.type || ''], location, address),
      imageUrl: fallbackImageUrl,
      fallbackImageUrl,
      googleMapsUrl: this.buildGoogleMapsUrl(name, address, latitude, longitude, result?.place_id),
      latitude,
      longitude,
      types: [result?.type || ''].filter((type: string) => type.trim().length > 0),
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
