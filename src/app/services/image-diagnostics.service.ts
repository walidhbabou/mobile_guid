import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface ImageDiagnostic {
  url: string;
  status: 'loading' | 'success' | 'failed' | 'pending';
  timestamp: number;
  errorMessage?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ImageDiagnosticsService {
  private diagnostics = new Map<string, ImageDiagnostic>();
  private diagnosticsSubject = new BehaviorSubject<ImageDiagnostic[]>([]);

  constructor() {}

  /**
   * Teste le chargement direct d'une image
   */
  testImageUrl(url: string): Observable<ImageDiagnostic> {
    return new Observable(subscriber => {
      if (!url) {
        subscriber.error({ error: 'URL empty' });
        return;
      }

      const diagnostic: ImageDiagnostic = {
        url,
        status: 'loading',
        timestamp: Date.now(),
      };

      this.diagnostics.set(url, diagnostic);
      this.updateSubject();

      const img = new Image();

      img.onload = () => {
        diagnostic.status = 'success';
        diagnostic.timestamp = Date.now();
        this.diagnostics.set(url, diagnostic);
        this.updateSubject();
        console.debug(`✅ Image loaded successfully: ${url.substring(0, 80)}...`);
        subscriber.next(diagnostic);
        subscriber.complete();
      };

      img.onerror = (event) => {
        diagnostic.status = 'failed';
        diagnostic.errorMessage = `Failed to load image from ${url}`;
        diagnostic.timestamp = Date.now();
        this.diagnostics.set(url, diagnostic);
        this.updateSubject();
        console.error(`❌ Image failed to load: ${url.substring(0, 80)}...`, event);
        subscriber.next(diagnostic);
        subscriber.complete();
      };

      img.onabort = () => {
        diagnostic.status = 'failed';
        diagnostic.errorMessage = 'Image loading aborted';
        diagnostic.timestamp = Date.now();
        this.diagnostics.set(url, diagnostic);
        this.updateSubject();
        console.warn(`⚠️ Image loading aborted: ${url.substring(0, 80)}...`);
        subscriber.next(diagnostic);
        subscriber.complete();
      };

      img.src = url;
    });
  }

  /**
   * Obtient tous les diagnostics enregistrés
   */
  getDiagnostics(): Observable<ImageDiagnostic[]> {
    return this.diagnosticsSubject.asObservable();
  }

  /**
   * Obtient le résumé des diagnostics
   */
  getSummary(): {
    total: number;
    success: number;
    failed: number;
    loading: number;
    failedUrls: string[];
  } {
    const diagnostics = Array.from(this.diagnostics.values());
    const success = diagnostics.filter(d => d.status === 'success').length;
    const failed = diagnostics.filter(d => d.status === 'failed').length;
    const loading = diagnostics.filter(d => d.status === 'loading').length;
    const failedUrls = diagnostics
      .filter(d => d.status === 'failed')
      .map(d => d.url);

    return {
      total: diagnostics.length,
      success,
      failed,
      loading,
      failedUrls,
    };
  }

  /**
   * Réinitialise les diagnostics
   */
  clearDiagnostics(): void {
    this.diagnostics.clear();
    this.updateSubject();
  }

  /**
   * Affiche les diagnostics en console
   */
  printDiagnostics(): void {
    const summary = this.getSummary();
    console.table({
      'Total images': summary.total,
      'Loaded': summary.success,
      'Failed': summary.failed,
      'Loading': summary.loading,
    });

    if (summary.failedUrls.length > 0) {
      console.warn('❌ Failed image URLs:', summary.failedUrls);
    }

    const diagnostics = Array.from(this.diagnostics.values());
    console.table(diagnostics.map(d => ({
      url: d.url.substring(0, 60) + '...',
      status: d.status,
    })));
  }

  private updateSubject(): void {
    this.diagnosticsSubject.next(Array.from(this.diagnostics.values()));
  }
}
