import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';
import { BehaviorSubject, of } from 'rxjs';
import { RouterTestingModule } from '@angular/router/testing';

import { AiPlaceService } from '../services/ai-place.service';
import { CompareService } from '../services/compare.service';
import { FavoritesService } from '../services/favorites.service';
import { GoogleMapsLoaderService } from '../services/google-maps-loader.service';
import { OfflinePackService } from '../services/offline-pack.service';
import { PlaceCatalogService } from '../services/place-catalog.service';
import { UserLocationService } from '../services/user-location.service';

import { Tab2Page } from './tab2.page';

describe('Tab2Page', () => {
  let component: Tab2Page;
  let fixture: ComponentFixture<Tab2Page>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [Tab2Page],
      imports: [
        IonicModule.forRoot(),
        RouterTestingModule,
      ],
      providers: [
        {
          provide: AiPlaceService,
          useValue: {
            getRecommendations: () => of({ userId: 'test', latitude: 0, longitude: 0, recommendations: [] }),
          },
        },
        {
          provide: PlaceCatalogService,
          useValue: {
            getPlaces: () => of([]),
            filterPlaces: (places: unknown[]) => places,
            buildMarkers: () => [],
          },
        },
        {
          provide: GoogleMapsLoaderService,
          useValue: {
            load: () => Promise.reject(new Error('Missing key')),
          },
        },
        {
          provide: UserLocationService,
          useValue: {
            getCurrentLocation: () => Promise.resolve(null),
          },
        },
        {
          provide: FavoritesService,
          useValue: {
            favorites$: new BehaviorSubject([]).asObservable(),
            isFavorite: () => false,
            toggle: () => {},
          },
        },
        {
          provide: CompareService,
          useValue: {
            isSelected: () => false,
            toggle: () => 'added',
            places$: new BehaviorSubject([]).asObservable(),
            count: 0,
          },
        },
        {
          provide: OfflinePackService,
          useValue: {
            getInstalledPacks: () => [],
            isPackInstalled: () => false,
          },
        },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(Tab2Page);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
