import { Component } from '@angular/core';
import { Place } from '../data/tourism.data';
import { AiGuideCard, AiPlaceSearchExperience, AiPlaceSearchResult } from '../models/ai-place.model';
import { AiPlaceService } from '../services/ai-place.service';
import { PlaceCatalogService } from '../services/place-catalog.service';

@Component({
  selector: 'app-tab1',
  templateUrl: 'tab1.page.html',
  styleUrls: ['tab1.page.scss'],
  standalone: false,
})
export class Tab1Page {
  userName = 'Sophie';
  searchQuery = '';
  isSearching = false;
  hasSearched = false;
  searchResults: AiPlaceSearchResult[] = [];
  searchMode: 'ai' | 'fallback' | 'idle' = 'idle';
  searchExperience: AiPlaceSearchExperience | null = null;
  featuredPlaces: Place[] = [];
  quickFilters: string[] = [];
  highlightPlace: Place | null = null;
  readonly defaultSuggestedPrompts = [
    'plage calme a Agadir',
    'sortie famille a Rabat',
    'ville culturelle pour photos',
    'lieu romantique au coucher de soleil',
  ];

  constructor(
    private aiPlaceService: AiPlaceService,
    private placeCatalogService: PlaceCatalogService
  ) {}

  ionViewWillEnter() {
    this.userName = localStorage.getItem('userName') || 'Sophie';
    this.loadHomeContent();
  }

  searchWithAi() {
    const query = this.searchQuery.trim();

    if (!query) {
      this.clearSearch();
      return;
    }

    this.isSearching = true;
    this.hasSearched = true;

    this.aiPlaceService.search(query).subscribe({
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

  useSuggestedPrompt(prompt: string) {
    this.searchQuery = prompt;
    this.searchWithAi();
  }

  clearSearch() {
    this.searchQuery = '';
    this.searchExperience = null;
    this.searchResults = [];
    this.hasSearched = false;
    this.searchMode = 'idle';
    this.isSearching = false;
  }

  handlePlaceImageError(place: Place) {
    place.imageUrl = undefined;
  }

  handleResultImageError(result: AiPlaceSearchResult) {
    result.imageUrl = undefined;
  }

  useGuideCard(card: AiGuideCard) {
    this.searchQuery = card.query || card.title;
    this.searchWithAi();
  }

  get activePrompts(): string[] {
    return this.searchExperience?.suggestedQuestions?.length
      ? this.searchExperience.suggestedQuestions
      : this.defaultSuggestedPrompts;
  }

  private loadHomeContent() {
    this.placeCatalogService.getFeaturedPlaces().subscribe((places: Place[]) => {
      this.featuredPlaces = places;
      this.highlightPlace = places[0] ?? null;
    });

    this.placeCatalogService.getQuickFilters().subscribe((filters: string[]) => {
      this.quickFilters = filters;
    });
  }
}
