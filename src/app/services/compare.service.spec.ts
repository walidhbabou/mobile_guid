import { TestBed } from '@angular/core/testing';
import { Place } from '../data/tourism.data';
import { CompareService } from './compare.service';

describe('CompareService', () => {
  let service: CompareService;

  function createPlace(id: string): Place {
    return {
      id,
      name: `Lieu ${id}`,
      location: 'Marrakech',
      rating: 4.0,
      reviewsLabel: 'Marrakech',
      reviewsCount: 50,
      category: 'Culture',
      badge: 'Marrakech',
      theme: 'theme-marrakech',
      icon: 'business-outline',
      spotlight: 'Un lieu culturel.',
      shortDescription: 'Un lieu culturel.',
      longDescription: 'Un lieu culturel remarquable.',
      address: 'Medina, Marrakech',
      hours: '09:00 - 18:00',
      starsLabel: '****',
      highlights: ['Culture'],
      types: ['culture'],
    };
  }

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CompareService);
  });

  it('should start with an empty selection', () => {
    expect(service.count).toBe(0);
    expect(service.places).toEqual([]);
    expect(service.isFull).toBeFalse();
  });

  it('should add a place and return added', () => {
    const result = service.toggle(createPlace('p1'));

    expect(result).toBe('added');
    expect(service.count).toBe(1);
    expect(service.isSelected('p1')).toBeTrue();
  });

  it('should remove an already-selected place and return removed', () => {
    const place = createPlace('p1');
    service.toggle(place);

    const result = service.toggle(place);

    expect(result).toBe('removed');
    expect(service.count).toBe(0);
    expect(service.isSelected('p1')).toBeFalse();
  });

  it('should return full when the selection reaches the maximum of 3', () => {
    service.toggle(createPlace('p1'));
    service.toggle(createPlace('p2'));
    service.toggle(createPlace('p3'));

    const result = service.toggle(createPlace('p4'));

    expect(result).toBe('full');
    expect(service.count).toBe(3);
    expect(service.isFull).toBeTrue();
    expect(service.isSelected('p4')).toBeFalse();
  });

  it('should remove a specific place by id without touching others', () => {
    service.toggle(createPlace('p1'));
    service.toggle(createPlace('p2'));

    service.remove('p1');

    expect(service.count).toBe(1);
    expect(service.isSelected('p1')).toBeFalse();
    expect(service.isSelected('p2')).toBeTrue();
  });

  it('should clear all selected places', () => {
    service.toggle(createPlace('p1'));
    service.toggle(createPlace('p2'));

    service.clear();

    expect(service.count).toBe(0);
    expect(service.places).toEqual([]);
  });

  it('should emit updates through places$', (done) => {
    const emissions: Place[][] = [];

    service.places$.subscribe((places) => {
      emissions.push([...places]);
      if (emissions.length === 2) {
        expect(emissions[0]).toEqual([]);
        expect(emissions[1][0].id).toBe('p1');
        done();
      }
    });

    service.toggle(createPlace('p1'));
  });

  it('should allow re-adding a place after it was removed', () => {
    const place = createPlace('p1');
    service.toggle(place);
    service.toggle(place);
    const result = service.toggle(place);

    expect(result).toBe('added');
    expect(service.count).toBe(1);
  });
});
