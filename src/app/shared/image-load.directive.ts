import { Directive, ElementRef, Input, OnInit } from '@angular/core';
import { ImageCacheService } from '../services/image-cache.service';

/**
 * Directive pour gérer l'affichage des images avec fallback automatique.
 * Usage: <img [appImageLoad]="imageUrl" appFallback="fallbackUrl" />
 */
@Directive({
  selector: '[appImageLoad]',
  standalone: true
})
export class ImageLoadDirective implements OnInit {
  @Input() appImageLoad: string | undefined;
  @Input() appFallback: string | undefined;

  constructor(
    private el: ElementRef<HTMLImageElement>,
    private imageCacheService: ImageCacheService
  ) {}

  ngOnInit(): void {
    if (!this.appImageLoad) {
      this.loadFallback();
      return;
    }

    // Check if image already failed
    if (this.imageCacheService.hasImageFailed(this.appImageLoad)) {
      this.loadFallback();
      return;
    }

    this.el.nativeElement.src = this.appImageLoad;
    this.el.nativeElement.onload = () => {
      this.imageCacheService.markAsLoaded(this.appImageLoad!);
    };
    this.el.nativeElement.onerror = () => {
      this.imageCacheService.markAsFailed(this.appImageLoad!);
      this.loadFallback();
    };
  }

  private loadFallback(): void {
    if (this.appFallback) {
      this.el.nativeElement.src = this.appFallback;
      this.el.nativeElement.onerror = () => {
        this.el.nativeElement.src = '';
      };
    }
  }
}
