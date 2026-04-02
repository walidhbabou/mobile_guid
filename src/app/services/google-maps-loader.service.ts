import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

declare global {
  interface Window {
    google?: any;
  }
}

@Injectable({
  providedIn: 'root'
})
export class GoogleMapsLoaderService {
  private loadingPromise?: Promise<any>;

  load(): Promise<any> {
    if (window.google?.maps) {
      return Promise.resolve(window.google);
    }

    if (this.loadingPromise) {
      return this.loadingPromise;
    }

    const apiKey = environment.googleMapsApiKey?.trim();

    if (!apiKey) {
      return Promise.reject(new Error('Missing Google Maps API key'));
    }

    this.loadingPromise = new Promise((resolve, reject) => {
      const existingScript = document.getElementById('google-maps-script') as HTMLScriptElement | null;

      if (existingScript) {
        existingScript.addEventListener('load', () => resolve(window.google));
        existingScript.addEventListener('error', () => reject(new Error('Google Maps failed to load')));
        return;
      }

      const script = document.createElement('script');
      script.id = 'google-maps-script';
      script.async = true;
      script.defer = true;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}`;
      script.onload = () => resolve(window.google);
      script.onerror = () => reject(new Error('Google Maps failed to load'));
      document.head.appendChild(script);
    }).catch((error: unknown) => {
      this.loadingPromise = undefined;
      throw error;
    });

    return this.loadingPromise;
  }
}
