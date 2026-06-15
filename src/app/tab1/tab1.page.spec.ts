import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { BehaviorSubject, of } from 'rxjs';
import { RouterTestingModule } from '@angular/router/testing';

import { ExploreContainerComponentModule } from '../explore-container/explore-container.module';
import { AiPlaceService } from '../services/ai-place.service';
import { CompareService } from '../services/compare.service';
import { CoreDataService } from '../services/core-data.service';
import { FavoritesService } from '../services/favorites.service';
import { PlaceCatalogService } from '../services/place-catalog.service';
import { UserLocationService } from '../services/user-location.service';

import { Tab1Page } from './tab1.page';

describe('Tab1Page', () => {
  let component: Tab1Page;
  let fixture: ComponentFixture<Tab1Page>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [Tab1Page],
      imports: [
        IonicModule.forRoot(),
        ExploreContainerComponentModule,
        FormsModule,
        RouterTestingModule,
      ],
      providers: [
        {
          provide: AiPlaceService,
          useValue: {
            search: () => of({
              results: [],
              source: 'fallback',
            }),
          },
        },
        {
          provide: PlaceCatalogService,
          useValue: {
            getFeaturedPlaces: () => of([]),
          },
        },
        {
          provide: CoreDataService,
          useValue: {
            getCategoryLabels: () => of([]),
            getNotifications: () => of([]),
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
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(Tab1Page);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
