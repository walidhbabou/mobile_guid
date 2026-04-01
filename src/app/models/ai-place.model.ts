export interface AiPlaceSearchResult {
  id: string;
  name: string;
  location: string;
  category: string;
  description: string;
  rating?: number;
  imageUrl?: string;
  reviewsLabel?: string;
  routeId?: string;
  theme?: string;
  visualBadge?: string;
  visualIcon?: string;
  source: 'ai' | 'fallback';
}
