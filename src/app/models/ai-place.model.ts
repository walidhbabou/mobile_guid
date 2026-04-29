export interface AiPlaceSearchResult {
  id: string;
  name: string;
  location: string;
  category: string;
  description: string;
  address?: string;
  rating?: number;
  imageUrl?: string;
  fallbackImageUrl?: string;
  latitude?: number;
  longitude?: number;
  googleMapsUrl?: string;
  types?: string[];
  reviewsLabel?: string;
  routeId?: string;
  theme?: string;
  visualBadge?: string;
  visualIcon?: string;
  distanceKm?: number;
  source: 'ai' | 'fallback';
}

export interface AiGuideCard {
  title: string;
  description: string;
  query?: string;
  /**
   * Champs optionnels enrichissant les cartes quand il s'agit d'un itinéraire.
   * Provenance: `llm_map` -> backend Java -> front.
   */
  timeSlot?: string;
  durationMinutes?: number;
  budgetMinMad?: number;
  budgetMaxMad?: number;
}

export interface AiPlaceSearchExperience {
  results: AiPlaceSearchResult[];
  source: 'ai' | 'fallback';
  assistantReply?: string;
  message?: string;
  positionNote?: string;
  inputMode?: string;
  responseMode?: string;
  detectedLanguage?: string;
  transcribedQuery?: string;
  audioFilename?: string;
  city?: string;
  category?: string;
  resultsCount: number;
  suggestedQuestions: string[];
  guideCards: AiGuideCard[];
}
