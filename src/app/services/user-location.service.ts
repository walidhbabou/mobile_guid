import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

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

    // Sur mobile (Capacitor) on utilise le plugin natif: navigator.geolocation
    // ne fonctionne pas de facon fiable dans la WebView Android.
    if (Capacitor.isNativePlatform()) {
      return this.getNativeLocation(timeout, maximumAge);
    }

    return this.getBrowserLocation(timeout, maximumAge);
  }

  private async getNativeLocation(
    timeout: number,
    maximumAge: number
  ): Promise<UserLocationCoordinates | null> {
    try {
      if (!(await this.ensureNativePermission())) {
        return this.lastKnownLocation;
      }

      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout,
        maximumAge,
      });

      return this.storeLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: position.timestamp || Date.now(),
      });
    } catch {
      return this.lastKnownLocation;
    }
  }

  private async ensureNativePermission(): Promise<boolean> {
    try {
      const status = await Geolocation.checkPermissions();

      if (this.isPermissionGranted(status)) {
        return true;
      }

      const requested = await Geolocation.requestPermissions({
        permissions: ['location', 'coarseLocation'],
      });

      return this.isPermissionGranted(requested);
    } catch {
      return false;
    }
  }

  private isPermissionGranted(status: {
    location?: string;
    coarseLocation?: string;
  }): boolean {
    return status.location === 'granted' || status.coarseLocation === 'granted';
  }

  private async getBrowserLocation(
    timeout: number,
    maximumAge: number
  ): Promise<UserLocationCoordinates | null> {
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

      return this.storeLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: position.timestamp || Date.now(),
      });
    } catch {
      return this.lastKnownLocation;
    }
  }

  private storeLocation(location: UserLocationCoordinates): UserLocationCoordinates {
    this.lastKnownLocation = location;
    return location;
  }

  private canReuseCachedLocation(maximumAge: number): boolean {
    return !!this.lastKnownLocation
      && (Date.now() - this.lastKnownLocation.timestamp) <= Math.max(0, maximumAge);
  }
}
