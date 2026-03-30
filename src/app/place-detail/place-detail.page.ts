import { Location } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AUDIO_WAVE, Place, REVIEWS, getPlaceById } from '../data/tourism.data';

@Component({
  selector: 'app-place-detail',
  templateUrl: './place-detail.page.html',
  styleUrls: ['./place-detail.page.scss'],
  standalone: false,
})
export class PlaceDetailPage implements OnInit {
  place!: Place;
  readonly reviews = REVIEWS;
  readonly audioWave = AUDIO_WAVE;

  constructor(
    private route: ActivatedRoute,
    private location: Location,
    private router: Router
  ) {}

  ngOnInit() {
    this.route.paramMap.subscribe((params) => {
      this.place = getPlaceById(params.get('id') ?? 'zoo-rabat');
    });
  }

  goBack() {
    if (window.history.length > 1) {
      this.location.back();
      return;
    }

    this.router.navigate(['/tabs/home']);
  }
}
