import { Injectable } from '@angular/core';

/**
 * Gere le theme clair/sombre de l'application.
 * Applique une classe `dark` sur <html>; les couleurs sombres sont definies
 * dans les SCSS sous `html.dark` / `:host-context(html.dark)`.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly storageKey = 'app-theme';
  private dark = false;

  get isDark(): boolean {
    return this.dark;
  }

  /** A appeler au demarrage de l'app. */
  init(): void {
    let dark: boolean;
    const stored = this.readStored();

    if (stored) {
      dark = stored === 'dark';
    } else {
      dark = this.systemPrefersDark();
    }

    this.apply(dark, false);
  }

  toggle(): void {
    this.apply(!this.dark, true);
  }

  setDark(dark: boolean): void {
    this.apply(dark, true);
  }

  private apply(dark: boolean, persist: boolean): void {
    this.dark = dark;

    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', dark);
    }

    if (persist) {
      try {
        localStorage.setItem(this.storageKey, dark ? 'dark' : 'light');
      } catch {
        // stockage indisponible : pas de persistance
      }
    }
  }

  private readStored(): string | null {
    try {
      return localStorage.getItem(this.storageKey);
    } catch {
      return null;
    }
  }

  private systemPrefersDark(): boolean {
    try {
      return typeof window !== 'undefined'
        && !!window.matchMedia
        && window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch {
      return false;
    }
  }
}
