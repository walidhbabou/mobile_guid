import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { of } from 'rxjs';
import { RouterTestingModule } from '@angular/router/testing';

import { ExploreContainerComponentModule } from '../explore-container/explore-container.module';
import { AiPlaceService } from '../services/ai-place.service';
import { PlaceCatalogService } from '../services/place-catalog.service';

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
            getQuickFilters: () => of([]),
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
