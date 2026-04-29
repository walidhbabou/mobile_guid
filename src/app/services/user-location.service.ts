import { Injectable } from '@angular/core';

export interface UserLocationCoordinates {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: number;
}

interface UserLocationRequestOptions {
  forceRefresh?: boolean;
  timeout?: number;
  maximumAge?: number;
}

@Injectable({
  providedIn: 'root'
})
export class UserLocationService {
  private lastKnownLocation: UserLocationCoordinates | null = null;

  async getCurrentLocation(
    options: UserLocationRequestOptions = {}
  ): Promise<UserLocationCoordinates | null> {
    const forceRefresh = options.forceRefresh ?? false;
    const timeout = options.timeout ?? 8000;
    const maximumAge = options.maximumAge ?? 120000;

    if (!forceRefresh && this.canReuseCachedLocation(maximumAge)) {
      return this.lastKnownLocation;
    }

    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      return this.lastKnownLocation;
    }

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout,
          maximumAge,
        });
      });

      const nextLocation: UserLocationCoordinates = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: position.timestamp || Date.now(),
      };

      this.lastKnownLocation = nextLocation;
      return nextLocation;
    } catch {
      return this.lastKnownLocation;
    }
  }

  private canReuseCachedLocation(maximumAge: number): boolean {
    return !!this.lastKnownLocation
      && (Date.now() - this.lastKnownLocation.timestamp) <= Math.max(0, maximumAge);
  }
}
