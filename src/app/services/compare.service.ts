import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Place } from '../data/tourism.data';

@Injectable({ providedIn: 'root' })
export class CompareService {
  private readonly MAX = 3;
  private subject = new BehaviorSubject<Place[]>([]);
  readonly places$ = this.subject.asObservable();

  get count(): number { return this.subject.value.length; }
  get places(): Place[] { return this.subject.value; }
  get isFull(): boolean { return this.subject.value.length >= this.MAX; }

  isSelected(id: string): boolean {
    return this.subject.value.some(p => p.id === id);
  }

  toggle(place: Place): 'added' | 'removed' | 'full' {
    const current = this.subject.value;
    const idx = current.findIndex(p => p.id === place.id);
    if (idx >= 0) {
      this.subject.next(current.filter((_, i) => i !== idx));
      return 'removed';
    }
    if (current.length >= this.MAX) return 'full';
    this.subject.next([...current, place]);
    return 'added';
  }

  remove(id: string): void {
    this.subject.next(this.subject.value.filter(p => p.id !== id));
  }

  clear(): void {
    this.subject.next([]);
  }
}
