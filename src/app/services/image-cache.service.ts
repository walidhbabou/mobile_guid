import { Injectable } from '@angular/core';

/**
 * Service pour gérer le cache d'images et les fallbacks.
 * Aide à diagnostiquer les problèmes de chargement d'images.
 */
@Injectable({
  providedIn: 'root'
})
export class ImageCacheService {
  private imageLoadMap = new Map<string, boolean>();
  private failedImages = new Set<string>();

  /**
   * Marque une image comme ayant réussi à se charger
   */
  markAsLoaded(url: string): void {
    this.imageLoadMap.set(url, true);
    this.failedImages.delete(url);
    console.debug(`[ImageCache] Image loaded: ${url.substring(0, 50)}...`);
  }

  /**
   * Marque une image comme ayant échoué
   */
  markAsFailed(url: string): void {
    this.imageLoadMap.set(url, false);
    this.failedImages.add(url);
    console.debug(`[ImageCache] Image failed: ${url.substring(0, 50)}...`);
  }

  /**
   * Retourne si une image a échoué précédemment
   */
  hasImageFailed(url: string): boolean {
    return this.failedImages.has(url);
  }

  /**
   * Retourne le statut d'une image (loaded, failed, unknown)
   */
  getImageStatus(url: string): 'loaded' | 'failed' | 'unknown' {
    const status = this.imageLoadMap.get(url);
    if (status === true) return 'loaded';
    if (status === false) return 'failed';
    return 'unknown';
  }

  /**
   * Retourne un résumé du cache (utile pour le debugging)
   */
  getDebugInfo(): {
    total: number;
    loaded: number;
    failed: number;
    failedUrls: string[];
  } {
    const loaded = Array.from(this.imageLoadMap.values()).filter(v => v === true).length;
    const failed = this.failedImages.size;
    return {
      total: this.imageLoadMap.size,
      loaded,
      failed,
      failedUrls: Array.from(this.failedImages),
    };
  }

  /**
   * Nettoie le cache (utile pour la démémoire)
   */
  clearCache(): void {
    this.imageLoadMap.clear();
    this.failedImages.clear();
    console.debug('[ImageCache] Cache cleared');
  }

  /**
   * Retourne la meilleure image (principale) et une image de secours pour un objet Place/Result.
   * Priorité: `imageUrl` -> `photo_url` -> `photo_urls[0]` -> `fallbackImageUrl` -> undefined
   */
  getBestImageUrls(entity: { imageUrl?: string; fallbackImageUrl?: string; photo_url?: string; photo_urls?: string[] } | null): { primary?: string; fallback?: string } {
    if (!entity) return {};

    const primary = entity.imageUrl || entity.photo_url || (Array.isArray(entity.photo_urls) && entity.photo_urls.length ? entity.photo_urls[0] : undefined) || undefined;
    const fallback = entity.fallbackImageUrl || (Array.isArray(entity.photo_urls) && entity.photo_urls.length ? entity.photo_urls[0] : undefined) || entity.photo_url || undefined;

    return { primary, fallback };
  }
}
