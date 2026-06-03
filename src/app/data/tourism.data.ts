export interface Place {
  id: string;
  backendId?: number;
  externalPlaceId?: string;
  name: string;
  location: string;
  rating: number;
  reviewsLabel: string;
  reviewsCount: number;
  category: string;
  badge: string;
  theme: string;
  icon: string;
  spotlight: string;
  shortDescription: string;
  longDescription: string;
  address: string;
  hours: string;
  starsLabel: string;
  highlights: string[];
  imageUrl?: string;
  fallbackImageUrl?: string;
  photo_url?: string;
  photo_urls?: string[];
  googleMapsUrl?: string;
  latitude?: number;
  longitude?: number;
  types?: string[];
  city?: string;
}

export interface Review {
  id?: number;
  userId?: number;
  author: string;
  role: string;
  ratingLabel: string;
  ratingValue?: number;
  comment: string;
  likes: number;
  replies: number;
  avatar: string;
  createdAt?: string;
  updatedAt?: string;
  isOwnReview?: boolean;
}

export interface NotificationItem {
  icon: string;
  title: string;
  description: string;
  time: string;
  tone: 'primary' | 'secondary' | 'success';
}

export interface ProfileStat {
  label: string;
  value: string;
}

export interface ProfileAction {
  icon: string;
  title: string;
  subtitle: string;
}
