import { Injectable } from '@angular/core';
import * as L from 'leaflet';
import { Place } from '../data/tourism.data';

/** Une ville telechargeable hors-ligne. bbox = [sud, ouest, nord, est]. */
export interface CityPack {
  id: string;
  name: string;
  emoji: string;
  bbox: [number, number, number, number];
}

/** Etat d'un pack stocke en cache. */
export interface PackInfo {
  id: string;
  name: string;
  tileCount: number;
  placeCount: number;
  bytes: number;
  downloadedAt: string;
}

export interface DownloadProgress {
  done: number;
  total: number;
  ratio: number; // 0..1
}

const DB_NAME = 'offlinePacksDb';
const DB_VERSION = 1;
const TILE_STORE = 'tiles';
const PACK_STORE = 'packs';
const PLACE_STORE = 'places';

// Niveaux de zoom telecharges (compromis taille / lisibilite ville).
const ZOOM_MIN = 11;
const ZOOM_MAX = 15;
const TILE_TEMPLATE = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

/** Villes marocaines proposees au telechargement. */
export const CITY_PACKS: CityPack[] = [
  { id: 'marrakech',   name: 'Marrakech',   emoji: '🕌', bbox: [31.585, -8.070, 31.690, -7.930] },
  { id: 'rabat',       name: 'Rabat',       emoji: '🏛️', bbox: [33.940, -6.900, 34.045, -6.780] },
  { id: 'casablanca',  name: 'Casablanca',  emoji: '🌊', bbox: [33.520, -7.700, 33.625, -7.550] },
  { id: 'fes',         name: 'Fès',         emoji: '🏺', bbox: [34.010, -5.030, 34.085, -4.940] },
  { id: 'chefchaouen', name: 'Chefchaouen', emoji: '💙', bbox: [35.150, -5.290, 35.190, -5.240] },
  { id: 'agadir',      name: 'Agadir',      emoji: '🏖️', bbox: [30.380, -9.630, 30.450, -9.540] },
  { id: 'tanger',      name: 'Tanger',      emoji: '⛵', bbox: [35.735, -5.850, 35.805, -5.760] },
];

@Injectable({ providedIn: 'root' })
export class OfflinePackService {
  private dbPromise?: Promise<IDBDatabase>;

  // ── Acces base IndexedDB ────────────────────────────────────
  private openDb(): Promise<IDBDatabase> {
    if (this.dbPromise) {
      return this.dbPromise;
    }

    this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(TILE_STORE)) {
          db.createObjectStore(TILE_STORE);
        }
        if (!db.objectStoreNames.contains(PACK_STORE)) {
          db.createObjectStore(PACK_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(PLACE_STORE)) {
          db.createObjectStore(PLACE_STORE, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return this.dbPromise;
  }

  private async tx<T>(
    store: string,
    mode: IDBTransactionMode,
    work: (s: IDBObjectStore) => IDBRequest<T>
  ): Promise<T> {
    const db = await this.openDb();
    return new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(store, mode);
      const request = work(transaction.objectStore(store));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // ── Tuiles ──────────────────────────────────────────────────
  private tileKey(z: number, x: number, y: number): string {
    return `${z}/${x}/${y}`;
  }

  async getTile(z: number, x: number, y: number): Promise<Blob | undefined> {
    try {
      return await this.tx<Blob | undefined>(TILE_STORE, 'readonly', s => s.get(this.tileKey(z, x, y)));
    } catch {
      return undefined;
    }
  }

  private putTile(z: number, x: number, y: number, blob: Blob): Promise<unknown> {
    return this.tx(TILE_STORE, 'readwrite', s => s.put(blob, this.tileKey(z, x, y)));
  }

  // ── Conversion lon/lat -> indices de tuile ──────────────────
  private lonToX(lon: number, z: number): number {
    return Math.floor(((lon + 180) / 360) * Math.pow(2, z));
  }

  private latToY(lat: number, z: number): number {
    const rad = (lat * Math.PI) / 180;
    return Math.floor(
      ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * Math.pow(2, z)
    );
  }

  /** Liste des coordonnees de tuiles couvrant la bbox sur tous les zooms. */
  private enumerateTiles(bbox: [number, number, number, number]): Array<{ z: number; x: number; y: number }> {
    const [south, west, north, east] = bbox;
    const tiles: Array<{ z: number; x: number; y: number }> = [];

    for (let z = ZOOM_MIN; z <= ZOOM_MAX; z += 1) {
      const xMin = this.lonToX(west, z);
      const xMax = this.lonToX(east, z);
      const yMin = this.latToY(north, z); // nord = y plus petit
      const yMax = this.latToY(south, z);

      for (let x = Math.min(xMin, xMax); x <= Math.max(xMin, xMax); x += 1) {
        for (let y = Math.min(yMin, yMax); y <= Math.max(yMin, yMax); y += 1) {
          tiles.push({ z, x, y });
        }
      }
    }

    return tiles;
  }

  estimateTileCount(pack: CityPack): number {
    return this.enumerateTiles(pack.bbox).length;
  }

  // ── Telechargement d'un pack ────────────────────────────────
  async downloadPack(
    pack: CityPack,
    places: Place[],
    onProgress?: (progress: DownloadProgress) => void
  ): Promise<PackInfo> {
    const tiles = this.enumerateTiles(pack.bbox);
    const total = tiles.length;
    let done = 0;
    let bytes = 0;

    const report = () => onProgress?.({ done, total, ratio: total ? done / total : 1 });
    report();

    const concurrency = 6;
    for (let i = 0; i < tiles.length; i += concurrency) {
      const batch = tiles.slice(i, i + concurrency);
      await Promise.all(
        batch.map(async ({ z, x, y }) => {
          try {
            const existing = await this.getTile(z, x, y);
            if (existing) {
              bytes += existing.size;
            } else {
              const url = TILE_TEMPLATE
                .replace('{z}', String(z))
                .replace('{x}', String(x))
                .replace('{y}', String(y));
              const response = await fetch(url);
              if (response.ok) {
                const blob = await response.blob();
                await this.putTile(z, x, y, blob);
                bytes += blob.size;
              }
            }
          } catch {
            // tuile ignoree (reseau) — le pack reste partiellement utilisable
          } finally {
            done += 1;
            report();
          }
        })
      );
    }

    // Lieux de la ville (deja filtres/tries en amont)
    const cityPlaces = places.slice(0, 50);
    await Promise.all(cityPlaces.map(place => this.tx(PLACE_STORE, 'readwrite', s => s.put(place))));

    const info: PackInfo = {
      id: pack.id,
      name: pack.name,
      tileCount: total,
      placeCount: cityPlaces.length,
      bytes,
      downloadedAt: new Date().toISOString(),
    };
    await this.tx(PACK_STORE, 'readwrite', s => s.put(info));
    return info;
  }

  // ── Etat / suppression ──────────────────────────────────────
  async getPackInfo(id: string): Promise<PackInfo | undefined> {
    try {
      return await this.tx<PackInfo | undefined>(PACK_STORE, 'readonly', s => s.get(id));
    } catch {
      return undefined;
    }
  }

  async listDownloaded(): Promise<PackInfo[]> {
    try {
      const all = await this.tx<PackInfo[]>(PACK_STORE, 'readonly', s => s.getAll());
      return all ?? [];
    } catch {
      return [];
    }
  }

  async deletePack(pack: CityPack): Promise<void> {
    // Supprime les tuiles de la bbox puis l'entree du pack.
    const tiles = this.enumerateTiles(pack.bbox);
    await Promise.all(
      tiles.map(({ z, x, y }) =>
        this.tx(TILE_STORE, 'readwrite', s => s.delete(this.tileKey(z, x, y))).catch(() => undefined)
      )
    );
    await this.tx(PACK_STORE, 'readwrite', s => s.delete(pack.id)).catch(() => undefined);
  }

  /** Tous les lieux mis en cache (repli quand le reseau est absent). */
  async getCachedPlaces(): Promise<Place[]> {
    try {
      const all = await this.tx<Place[]>(PLACE_STORE, 'readonly', s => s.getAll());
      return all ?? [];
    } catch {
      return [];
    }
  }

  // ── Couche Leaflet hors-ligne ───────────────────────────────
  /**
   * Cree une couche de tuiles qui sert d'abord le cache local, puis retombe
   * sur le reseau (et met la tuile en cache au passage). Comportement en ligne
   * inchange; hors-ligne, les villes telechargees restent visibles.
   */
  createTileLayer(): L.TileLayer {
    const service = this;

    const OfflineTileLayer = L.TileLayer.extend({
      createTile(coords: L.Coords, done: (error: Error | null, tile: HTMLElement) => void): HTMLElement {
        const tile = document.createElement('img');
        tile.alt = '';
        tile.setAttribute('role', 'presentation');

        const fallbackToNetwork = () => {
          const url = (this as L.TileLayer).getTileUrl(coords);
          tile.onload = () => done(null, tile);
          tile.onerror = () => done(null, tile);
          tile.src = url;
          // Mise en cache opportuniste de la tuile reseau
          fetch(url)
            .then(r => (r.ok ? r.blob() : null))
            .then(blob => { if (blob) void service.putTile(coords.z, coords.x, coords.y, blob); })
            .catch(() => undefined);
        };

        service.getTile(coords.z, coords.x, coords.y)
          .then(blob => {
            if (blob) {
              const objectUrl = URL.createObjectURL(blob);
              tile.onload = () => { URL.revokeObjectURL(objectUrl); done(null, tile); };
              tile.onerror = () => { URL.revokeObjectURL(objectUrl); fallbackToNetwork(); };
              tile.src = objectUrl;
            } else {
              fallbackToNetwork();
            }
          })
          .catch(() => fallbackToNetwork());

        return tile;
      },
    });

    return new (OfflineTileLayer as new (url: string, options: L.TileLayerOptions) => L.TileLayer)(
      TILE_TEMPLATE,
      {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      }
    );
  }
}
