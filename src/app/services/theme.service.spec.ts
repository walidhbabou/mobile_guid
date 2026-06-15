import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  let service: ThemeService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ThemeService);
    localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  it('should start in light mode', () => {
    expect(service.isDark).toBeFalse();
  });

  it('should switch to dark mode on toggle', () => {
    service.toggle();

    expect(service.isDark).toBeTrue();
    expect(document.documentElement.classList.contains('dark')).toBeTrue();
  });

  it('should switch back to light mode on second toggle', () => {
    service.toggle();
    service.toggle();

    expect(service.isDark).toBeFalse();
    expect(document.documentElement.classList.contains('dark')).toBeFalse();
  });

  it('should persist the dark preference to localStorage', () => {
    service.setDark(true);

    expect(localStorage.getItem('app-theme')).toBe('dark');
    expect(service.isDark).toBeTrue();
  });

  it('should persist the light preference to localStorage', () => {
    service.setDark(true);
    service.setDark(false);

    expect(localStorage.getItem('app-theme')).toBe('light');
    expect(service.isDark).toBeFalse();
  });

  it('should restore dark mode from localStorage on init', () => {
    localStorage.setItem('app-theme', 'dark');

    service.init();

    expect(service.isDark).toBeTrue();
    expect(document.documentElement.classList.contains('dark')).toBeTrue();
  });

  it('should restore light mode from localStorage on init', () => {
    localStorage.setItem('app-theme', 'dark');
    service.init();
    localStorage.setItem('app-theme', 'light');

    service.init();

    expect(service.isDark).toBeFalse();
    expect(document.documentElement.classList.contains('dark')).toBeFalse();
  });

  it('should apply the dark class to the html element when dark mode is set', () => {
    service.setDark(true);

    expect(document.documentElement.classList.contains('dark')).toBeTrue();
  });

  it('should remove the dark class from the html element when light mode is set', () => {
    service.setDark(true);
    service.setDark(false);

    expect(document.documentElement.classList.contains('dark')).toBeFalse();
  });
});
