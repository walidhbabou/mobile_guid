import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';
import { BehaviorSubject } from 'rxjs';
import { RouterTestingModule } from '@angular/router/testing';

import { CompareService } from '../services/compare.service';
import { FavoritesService } from '../services/favorites.service';

import { Tab3Page } from './tab3.page';

describe('Tab3Page', () => {
  let component: Tab3Page;
  let fixture: ComponentFixture<Tab3Page>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [Tab3Page],
      imports: [IonicModule.forRoot(), RouterTestingModule],
      providers: [
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

    fixture = TestBed.createComponent(Tab3Page);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
