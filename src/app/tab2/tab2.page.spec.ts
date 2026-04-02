import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { of } from 'rxjs';
import { RouterTestingModule } from '@angular/router/testing';

import { ExploreContainerComponentModule } from '../explore-container/explore-container.module';
import { AiPlaceService } from '../services/ai-place.service';
import { GoogleMapsLoaderService } from '../services/google-maps-loader.service';
import { PlaceCatalogService } from '../services/place-catalog.service';

import { Tab2Page } from './tab2.page';

describe('Tab2Page', () => {
  let component: Tab2Page;
  let fixture: ComponentFixture<Tab2Page>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [Tab2Page],
      imports: [
        IonicModule.forRoot(),
        ExploreContainerComponentModule,
        FormsModule,
        RouterTestingModule,
      ],
      providers: [
        {
          provide: PlaceCatalogService,
          useValue: {
            getPlaces: () => of([]),
            filterPlaces: (places: unknown[]) => places,
            buildMarkers: () => [],
          },
        },
        {
          provide: AiPlaceService,
          useValue: {
            search: () => of({
              results: [],
              source: 'fallback',
            }),
            searchFromAudio: () => of({
              results: [],
              source: 'fallback',
            }),
          },
        },
        {
          provide: GoogleMapsLoaderService,
          useValue: {
            load: () => Promise.reject(new Error('Missing key')),
          },
        },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(Tab2Page);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
