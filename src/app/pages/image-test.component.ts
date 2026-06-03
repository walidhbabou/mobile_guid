import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Place } from '../data/tourism.data';
import { ImageDiagnosticsService, ImageDiagnostic } from '../services/image-diagnostics.service';
import { PlaceCatalogService } from '../services/place-catalog.service';

@Component({
  selector: 'app-image-test',
  imports: [CommonModule],
  template: `
    <div style="padding: 20px; font-family: monospace;">
      <h1>🖼️ Image Diagnostics</h1>

      <div style="margin: 20px 0; padding: 10px; background: #f0f0f0; border-radius: 5px;">
        <h3>Places Summary</h3>
        <p><strong>Total Places:</strong> {{ rawPlaceData.length }}</p>
        <p style="color: green;"><strong>✅ Places with images:</strong> {{ placesWithImages.length }}</p>
        <p style="color: red;"><strong>❌ Places without images:</strong> {{ placesWithoutImages.length }}</p>
      </div>

      <div style="margin: 20px 0; padding: 10px; background: #f0f0f0; border-radius: 5px;">
        <h3>Test Results Summary</h3>
        <p><strong>Total Images Tested:</strong> {{ summary.total }}</p>
        <p style="color: green;"><strong>✅ Loaded:</strong> {{ summary.success }}</p>
        <p style="color: red;"><strong>❌ Failed:</strong> {{ summary.failed }}</p>
        <p style="color: orange;"><strong>⏳ Loading:</strong> {{ summary.loading }}</p>
      </div>

      <button (click)="testAllPlaces()" style="padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer; margin: 10px 0;">
        Test All Places Images
      </button>

      <button (click)="printToConsole()" style="padding: 10px 20px; background: #28a745; color: white; border: none; border-radius: 5px; cursor: pointer; margin: 10px 0; margin-left: 10px;">
        Print to Console
      </button>

      <button (click)="clearDiagnostics()" style="padding: 10px 20px; background: #dc3545; color: white; border: none; border-radius: 5px; cursor: pointer; margin: 10px 0; margin-left: 10px;">
        Clear Results
      </button>

      <div style="margin-top: 30px;">
        <h3>Places WITHOUT Images ({{ placesWithoutImages.length }})</h3>
        <div *ngIf="placesWithoutImages.length === 0" style="color: green;">
          ✅ All places have images!
        </div>
        <div *ngFor="let place of placesWithoutImages" style="background: #ffe0e0; padding: 10px; margin: 5px 0; border-left: 4px solid red; word-break: break-all;">
          ❌ {{ place.name }} ({{ place.location }})
        </div>
      </div>

      <div style="margin-top: 30px;">
        <h3>Failed Images</h3>
        <div *ngIf="summary.failedUrls.length === 0" style="color: green;">
          ✅ No failed images!
        </div>
        <div *ngFor="let url of summary.failedUrls" style="background: #ffe0e0; padding: 10px; margin: 5px 0; border-left: 4px solid red; word-break: break-all;">
          ❌ {{ url }}
        </div>
      </div>

      <div style="margin-top: 30px;">
        <h3>All Diagnostics</h3>
        <div *ngFor="let diagnostic of (diagnostics$ | async)"
             [style.background]="diagnostic.status === 'success' ? '#e0ffe0' : diagnostic.status === 'failed' ? '#ffe0e0' : '#fff0e0'"
             style="padding: 10px; margin: 5px 0; border-left: 4px solid; word-break: break-all;"
             [style.border-left-color]="diagnostic.status === 'success' ? 'green' : diagnostic.status === 'failed' ? 'red' : 'orange'">
          <strong>[{{ diagnostic.status }}]</strong> {{ diagnostic.url.substring(0, 100) }}...
          <div *ngIf="diagnostic.errorMessage" style="color: red; font-size: 12px; margin-top: 5px;">
            {{ diagnostic.errorMessage }}
          </div>
        </div>
      </div>
    </div>
  `,
  standalone: true,
})
export class ImageTestComponent implements OnInit {
  summary = { total: 0, success: 0, failed: 0, loading: 0, failedUrls: [] as string[] };
  diagnostics$ = this.imageDiagnosticsService.getDiagnostics();
  rawPlaceData: Place[] = [];
  placesWithImages: Place[] = [];
  placesWithoutImages: Place[] = [];

  constructor(
    private imageDiagnosticsService: ImageDiagnosticsService,
    private placeCatalogService: PlaceCatalogService
  ) {}

  ngOnInit() {
    this.placeCatalogService.getPlaces().subscribe(places => {
      console.log('🔍 Places récupérées:', places.length);
      this.rawPlaceData = places;
      
      // Analyze which places have images
      places.forEach((place, idx) => {
        const hasImages = !!place.imageUrl || !!place.photo_url || (place.photo_urls && place.photo_urls.length > 0);
        console.log(`[${idx}] ${place.name}:`, {
          imageUrl: place.imageUrl ? '✅' : '❌',
          photo_url: place.photo_url ? '✅' : '❌',
          photo_urls: place.photo_urls?.length ? `✅ (${place.photo_urls.length})` : '❌',
          fallbackImageUrl: place.fallbackImageUrl ? '✅' : '❌'
        });
        
        if (hasImages) {
          this.placesWithImages.push(place);
        } else {
          this.placesWithoutImages.push(place);
        }
      });
      
      places.forEach(place => {
        this.testPlaceImages(place);
      });
    });
  }

  testPlaceImages(place: Place) {
    const urls = [place.imageUrl, place.photo_url, ...(place.photo_urls ?? [])].filter(u => !!u);
    if (urls.length === 0) {
      console.warn(`⚠️ No images for: ${place.name}`);
    }
    urls.forEach(url => {
      this.imageDiagnosticsService.testImageUrl(url!).subscribe({
        next: (diagnostic) => {
          this.summary = this.imageDiagnosticsService.getSummary();
        },
      });
    });
  }

  testAllPlaces() {
    this.imageDiagnosticsService.clearDiagnostics();
    this.placeCatalogService.getPlaces().subscribe(places => {
      console.log('🔍 Testing all places:', places.length);
      places.forEach(place => this.testPlaceImages(place));
    });
  }

  printToConsole() {
    this.imageDiagnosticsService.printDiagnostics();
  }

  clearDiagnostics() {
    this.imageDiagnosticsService.clearDiagnostics();
    this.summary = { total: 0, success: 0, failed: 0, loading: 0, failedUrls: [] };
  }
}
