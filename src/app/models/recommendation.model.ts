export interface RecommendedPlaceApi {
  place: {
    id: string;
    name: string;
    category: string;
    latitude: number;
    longitude: number;
    rating: number;
  };
  distanceKm: number;
  score: number;
  reasons?: string[];
}

export interface RecommendationsResponseApi {
  userId: string;
  latitude: number;
  longitude: number;
  recommendations: RecommendedPlaceApi[];
}

