import { Location } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Place, Review } from '../data/tourism.data';
import { PlaceCatalogService } from '../services/place-catalog.service';

@Component({
  selector: 'app-place-detail',
  templateUrl: './place-detail.page.html',
  styleUrls: ['./place-detail.page.scss'],
  standalone: false,
})
export class PlaceDetailPage implements OnInit {
  place: Place | null = null;
  reviews: Review[] = [];
  audioWave: number[] = [];

  constructor(
    private route: ActivatedRoute,
    private location: Location,
    private router: Router,
    private placeCatalogService: PlaceCatalogService
  ) {}

  ngOnInit() {
    this.route.paramMap.subscribe((params) => {
      this.loadPlace(params.get('id') ?? '');
    });
  }

  goBack() {
    if (window.history.length > 1) {
      this.location.back();
      return;
    }

    this.router.navigate(['/tabs/home']);
  }

  private loadPlace(placeId: string) {
    this.placeCatalogService.getPlaceById(placeId).subscribe((place: Place | null) => {
      this.place = place;
      this.reviews = [];
      this.audioWave = place ? this.placeCatalogService.buildAudioWave(place) : [];

      if (place) {
        this.placeCatalogService.trackPlaceVisit(place.id);
      }
    });
  }
}
