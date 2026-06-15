import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';
import { of } from 'rxjs';

import { NotificationItem } from '../data/tourism.data';
import { CoreDataService } from '../services/core-data.service';
import { Tab4Page } from './tab4.page';

describe('Tab4Page', () => {
  let component: Tab4Page;
  let fixture: ComponentFixture<Tab4Page>;
  let coreDataServiceSpy: jasmine.SpyObj<CoreDataService>;

  beforeEach(async () => {
    coreDataServiceSpy = jasmine.createSpyObj<CoreDataService>('CoreDataService', ['getNotifications']);
    coreDataServiceSpy.getNotifications.and.returnValue(of([]));

    await TestBed.configureTestingModule({
      declarations: [Tab4Page],
      imports: [IonicModule.forRoot()],
      providers: [
        { provide: CoreDataService, useValue: coreDataServiceSpy },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(Tab4Page);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should start with an empty notifications list', () => {
    expect(component.notifications).toEqual([]);
    expect(component.notificationCount).toBe(0);
  });

  it('should load notifications on ionViewWillEnter', () => {
    const mockNotifications: NotificationItem[] = [
      { icon: 'heart-outline', title: 'Lieu enregistre', description: 'Cafe Medina ajouté.', time: '12:00', tone: 'primary' },
      { icon: 'time-outline', title: 'Lieu visite', description: 'Palais Bahia consulte.', time: '10:00', tone: 'secondary' },
    ];

    coreDataServiceSpy.getNotifications.and.returnValue(of(mockNotifications));

    component.ionViewWillEnter();

    expect(component.notifications).toEqual(mockNotifications);
    expect(component.notificationCount).toBe(2);
  });

  it('should report zero when no notifications are returned', () => {
    coreDataServiceSpy.getNotifications.and.returnValue(of([]));

    component.ionViewWillEnter();

    expect(component.notificationCount).toBe(0);
  });

  it('should call getNotifications on each ionViewWillEnter', () => {
    component.ionViewWillEnter();
    component.ionViewWillEnter();

    expect(coreDataServiceSpy.getNotifications).toHaveBeenCalledTimes(2);
  });
});
