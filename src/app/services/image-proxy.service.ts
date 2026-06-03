import { Injectable } from '@angular/core';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from './api.service';

/**
 * Service pour gérer le chargement des images via proxy backend si nécessaire
 * Utile quand les URLs d'images sont bloquées par CORS
 */
@Injectable({
  providedIn: 'root'
})
export class ImageProxyService {
  private readonly USE_PROXY = true;

  constructor(
    private sanitizer: DomSanitizer,
    private apiService: ApiService
  ) {}

  /**
   * Retourne l'URL de l'image (directe ou via proxy)
   * @param imageUrl URL de l'image
   * @returns URL à utiliser pour le src de l'image
   */
  getImageUrl(imageUrl: string | undefined): string | undefined {
    if (!imageUrl) {
      return undefined;
    }

    // Si problèmes CORS, utiliser le proxy
    if (this.USE_PROXY) {
      return this.getProxyUrl(imageUrl);
    }

    return imageUrl;
  }

  /**
   * Retourne l'URL du proxy pour une image
   * @param imageUrl URL de l'image
   * @returns URL du proxy
   */
  private getProxyUrl(imageUrl: string): string {
    const encodedUrl = encodeURIComponent(imageUrl);
    return `/api/proxy/image?url=${encodedUrl}`;
  }

  /**
   * Récupère une image via le backend (fallback pour CORS)
   * @param imageUrl URL de l'image
   * @returns Observable de la réponse
   */
  fetchImageAsBlob(imageUrl: string): Observable<any> {
    // Utiliser l'endpoint de proxy backend si disponible
    return this.apiService.get(`/api/proxy/image?url=${encodeURIComponent(imageUrl)}`);
  }

  /**
   * Convertit un Blob en URL utilisable pour src
   * @param blob Blob de l'image
   * @returns URL blob
   */
  blobToUrl(blob: Blob): string {
    return URL.createObjectURL(blob);
  }

  /**
   * Crée une SafeUrl pour Angular (sécurité sanitization)
   * @param url URL de l'image
   * @returns SafeUrl
   */
  getSafeUrl(url: string): SafeUrl {
    return this.sanitizer.bypassSecurityTrustUrl(url);
  }

  /**
   * Crée un data URI à partir d'un Blob
   * @param blob Blob de l'image
   * @returns Promise<string> Data URI
   */
  blobToDataUri(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}
