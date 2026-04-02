export interface AiPlaceSearchResult {
  id: string;
  name: string;
  location: string;
  category: string;
  description: string;
  address?: string;
  rating?: number;
  imageUrl?: string;
  latitude?: number;
  longitude?: number;
  googleMapsUrl?: string;
  types?: string[];
  reviewsLabel?: string;
  routeId?: string;
  theme?: string;
  visualBadge?: string;
  visualIcon?: string;
  source: 'ai' | 'fallback';
}

export interface AiGuideCard {
  title: string;
  description: string;
  query?: string;
}

export interface AiPlaceSearchExperience {
  results: AiPlaceSearchResult[];
  source: 'ai' | 'fallback';
  assistantReply?: string;
  message?: string;
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
