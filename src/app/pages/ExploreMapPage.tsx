import React, { useState } from 'react';

interface Place {
  id: string;
  name: string;
  location: string;
  category: string;
  tags: string[];
  rating: number;
  distance: number;
  gradient: string;
  mapX: number;
  mapY: number;
  pinColor: string;
}

const PLACES: Place[] = [
  {
    id: 'tour-hassan',
    name: 'Tour Hassan',
    location: 'Rabat',
    category: 'Monument',
    tags: ['MONUMENT', 'MUSÉE'],
    rating: 4.9,
    distance: 0.7,
    gradient: 'linear-gradient(140deg, #b03020 0%, #e05030 45%, #f0a020 100%)',
    mapX: 62, mapY: 36,
    pinColor: '#FF3B30',
  },
  {
    id: 'mausolee',
    name: 'Mausolée Mohammed V',
    location: 'Rabat',
    category: 'Musée',
    tags: ['MUSÉE', 'MONUMENT'],
    rating: 4.8,
    distance: 1.2,
    gradient: 'linear-gradient(140deg, #a07800 0%, #d4a020 45%, #e8c040 100%)',
    mapX: 71, mapY: 28,
    pinColor: '#34C759',
  },
  {
    id: 'cafe-maure',
    name: 'Café Maure des Oudayas',
    location: 'Rabat',
    category: 'Café',
    tags: ['RESTAURANT', 'CAFÉ'],
    rating: 4.7,
    distance: 2.1,
    gradient: 'linear-gradient(140deg, #2d5a1b 0%, #4a8a2a 45%, #6aaa45 100%)',
    mapX: 28, mapY: 50,
    pinColor: '#007AFF',
  },
  {
    id: 'kasbah',
    name: 'Kasbah des Oudayas',
    location: 'Rabat',
    category: 'Lieu',
    tags: ['LIEU', 'HISTORIQUE'],
    rating: 4.8,
    distance: 2.4,
    gradient: 'linear-gradient(140deg, #7b1a1a 0%, #b03030 45%, #8b2020 100%)',
    mapX: 20, mapY: 43,
    pinColor: '#FF9500',
  },
  {
    id: 'jardin-andalou',
    name: 'Jardin Andalou',
    location: 'Rabat',
    category: 'Lieu',
    tags: ['PARC', 'NATURE'],
    rating: 4.6,
    distance: 3.0,
    gradient: 'linear-gradient(140deg, #1a5c3a 0%, #2e8b57 45%, #4aae80 100%)',
    mapX: 47, mapY: 64,
    pinColor: '#30B0C7',
  },
];

const FILTERS = ['Tout', 'Restaurant', 'Café', 'Lieu', 'Musée'];

const CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  .emp {
    position: relative;
    width: 100%;
    max-width: 430px;
    height: 100vh;
    margin: 0 auto;
    overflow: hidden;
    background: #f0ebe0;
    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif;
    color: #1c1c1e;
    -webkit-font-smoothing: antialiased;
  }

  /* ── Topbar ─────────────────────────── */
  .emp-topbar {
    position: absolute;
    top: 0; left: 0; right: 0;
    z-index: 20;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 50px 16px 14px;
    transition: background 0.25s;
  }
  .emp-topbar--map {
    background: linear-gradient(to bottom, rgba(0,0,0,0.22) 0%, transparent 100%);
  }
  .emp-topbar--list {
    background: rgba(242,242,247,0.95);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-bottom: 0.5px solid rgba(0,0,0,0.1);
  }

  .emp-loc-pill {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 8px 14px;
    background: rgba(255,255,255,0.92);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-radius: 999px;
    border: none;
    cursor: pointer;
    box-shadow: 0 2px 10px rgba(0,0,0,0.14);
    font-size: 14px;
    font-weight: 700;
    color: #1c1c1e;
    transition: transform 0.12s;
    letter-spacing: -0.2px;
  }
  .emp-loc-pill:active { transform: scale(0.95); }
  .emp-loc-chevron { font-size: 11px; color: #8e8e93; }

  .emp-topbar-actions { display: flex; gap: 8px; }

  .emp-icon-btn {
    width: 36px; height: 36px;
    border-radius: 50%;
    border: none;
    background: rgba(255,255,255,0.92);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    display: flex; align-items: center; justify-content: center;
    cursor: pointer;
    box-shadow: 0 2px 10px rgba(0,0,0,0.14);
    color: #1c1c1e;
    font-size: 18px;
    font-weight: 600;
    transition: transform 0.12s;
  }
  .emp-icon-btn:active { transform: scale(0.9); }

  /* ── Map ────────────────────────────── */
  .emp-map-area {
    position: absolute;
    inset: 0;
    overflow: hidden;
  }

  .emp-map-svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }

  .emp-user-dot {
    position: absolute;
    width: 16px; height: 16px;
    border-radius: 50%;
    background: #007AFF;
    border: 3px solid #fff;
    box-shadow: 0 0 0 5px rgba(0,122,255,0.18);
    transform: translate(-50%, -50%);
    z-index: 3;
    animation: emp-pulse 2.2s ease-in-out infinite;
    pointer-events: none;
  }
  @keyframes emp-pulse {
    0%,100% { box-shadow: 0 0 0 5px rgba(0,122,255,0.18); }
    50%      { box-shadow: 0 0 0 10px rgba(0,122,255,0.0); }
  }

  .emp-pin {
    position: absolute;
    width: 30px; height: 30px;
    border-radius: 50%;
    border: 2.5px solid #fff;
    cursor: pointer;
    transform: translate(-50%, -50%);
    box-shadow: 0 3px 10px rgba(0,0,0,0.24);
    transition: transform 0.18s, box-shadow 0.18s, width 0.18s, height 0.18s;
    display: flex; align-items: center; justify-content: center;
    font-size: 13px;
    z-index: 2;
  }
  .emp-pin--selected {
    width: 38px; height: 38px;
    z-index: 4;
    box-shadow: 0 4px 18px rgba(255,59,48,0.35), 0 0 0 4px rgba(255,59,48,0.18);
  }
  .emp-pin:active { transform: translate(-50%, -50%) scale(0.88); }

  .emp-popup {
    position: absolute;
    transform: translate(-50%, calc(-100% - 22px));
    background: #fff;
    border-radius: 14px;
    padding: 10px 13px;
    box-shadow: 0 6px 24px rgba(0,0,0,0.18);
    z-index: 5;
    min-width: 155px;
    max-width: 210px;
    pointer-events: none;
    animation: emp-pop 0.18s ease-out;
  }
  .emp-popup::after {
    content: '';
    position: absolute;
    bottom: -5px;
    left: 50%;
    transform: translateX(-50%);
    width: 10px; height: 6px;
    background: #fff;
    clip-path: polygon(0 0, 100% 0, 50% 100%);
  }
  @keyframes emp-pop {
    from { opacity: 0; transform: translate(-50%, calc(-100% - 12px)) scale(0.88); }
    to   { opacity: 1; transform: translate(-50%, calc(-100% - 22px)) scale(1); }
  }
  .emp-popup-name {
    font-size: 13px;
    font-weight: 700;
    color: #1c1c1e;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    letter-spacing: -0.2px;
  }
  .emp-popup-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 3px;
    font-size: 12px;
    color: #8e8e93;
    font-weight: 500;
  }

  /* ── Bottom sheet ───────────────────── */
  .emp-sheet {
    position: absolute;
    bottom: 64px; left: 0; right: 0;
    height: 52vh;
    background: #fff;
    border-radius: 20px 20px 0 0;
    z-index: 10;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 -8px 32px rgba(0,0,0,0.12);
  }

  .emp-drag {
    width: 36px; height: 4px;
    background: #d1d1d6;
    border-radius: 2px;
    margin: 10px auto 0;
    flex-shrink: 0;
  }

  /* ── Full list ──────────────────────── */
  .emp-list-full {
    position: absolute;
    top: 0; bottom: 64px; left: 0; right: 0;
    background: #f2f2f7;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    padding-top: 115px;
  }

  /* ── Shared list body ───────────────── */
  .emp-list-body {
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow: hidden;
  }

  .emp-list-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 13px 18px 8px;
    flex-shrink: 0;
  }
  .emp-list-left { display: flex; align-items: center; gap: 7px; }
  .emp-list-title {
    font-size: 17px;
    font-weight: 700;
    color: #1c1c1e;
    letter-spacing: -0.3px;
  }
  .emp-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 22px; height: 22px;
    padding: 0 7px;
    border-radius: 11px;
    background: #e5e5ea;
    font-size: 12px;
    font-weight: 700;
    color: #1c1c1e;
  }
  .emp-filters-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 6px 13px;
    border-radius: 999px;
    border: 1.5px solid #d1d1d6;
    background: transparent;
    font-size: 13px;
    font-weight: 600;
    color: #3a3a3c;
    cursor: pointer;
    transition: background 0.12s;
  }
  .emp-filters-btn:active { background: #e5e5ea; }

  .emp-chips {
    display: flex;
    gap: 7px;
    padding: 2px 18px 12px;
    overflow-x: auto;
    scrollbar-width: none;
    flex-shrink: 0;
  }
  .emp-chips::-webkit-scrollbar { display: none; }

  .emp-chip {
    display: inline-flex;
    align-items: center;
    height: 32px;
    padding: 0 15px;
    border-radius: 999px;
    border: 1.5px solid #d1d1d6;
    background: #fff;
    font-size: 13px;
    font-weight: 600;
    color: #3a3a3c;
    white-space: nowrap;
    cursor: pointer;
    flex-shrink: 0;
    transition: all 0.14s;
  }
  .emp-chip--on {
    background: #007AFF;
    border-color: #007AFF;
    color: #fff;
  }
  .emp-chip:active:not(.emp-chip--on) { background: #e5e5ea; }

  .emp-scroll {
    flex: 1;
    overflow-y: auto;
    padding: 0 16px 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    scrollbar-width: none;
  }
  .emp-scroll::-webkit-scrollbar { display: none; }

  /* ── Place card ─────────────────────── */
  .emp-card {
    position: relative;
    width: 100%;
    height: 112px;
    border-radius: 16px;
    overflow: hidden;
    border: none;
    cursor: pointer;
    flex-shrink: 0;
    transition: transform 0.15s, box-shadow 0.15s;
    box-shadow: 0 2px 10px rgba(0,0,0,0.12);
    display: block;
    text-align: left;
  }
  .emp-card:active { transform: scale(0.98); }
  .emp-card--selected {
    box-shadow: 0 4px 20px rgba(0,122,255,0.28), 0 0 0 2px rgba(0,122,255,0.4);
  }

  .emp-card-grad {
    position: absolute;
    inset: 0;
  }
  .emp-card-stripes {
    position: absolute;
    inset: 0;
    background-image: repeating-linear-gradient(
      45deg,
      transparent 0px, transparent 14px,
      rgba(255,255,255,0.07) 14px, rgba(255,255,255,0.07) 28px
    );
  }
  .emp-card-overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(to bottom, transparent 25%, rgba(0,0,0,0.32) 100%);
  }
  .emp-card-body {
    position: absolute;
    inset: 0;
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }
  .emp-card-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .emp-card-pin-lbl {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 11px;
    font-weight: 600;
    color: rgba(255,255,255,0.82);
    text-shadow: 0 1px 3px rgba(0,0,0,0.3);
  }
  .emp-card-fav {
    width: 28px; height: 28px;
    border-radius: 50%;
    border: none;
    background: rgba(0,0,0,0.22);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    display: flex; align-items: center; justify-content: center;
    cursor: pointer;
    font-size: 14px;
    line-height: 1;
    transition: background 0.12s, transform 0.12s;
  }
  .emp-card-fav:active { transform: scale(0.84); }
  .emp-card-fav--on { background: rgba(255,59,48,0.35); }

  .emp-card-bottom {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
  }
  .emp-card-cats {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: #ff8a80;
    margin-bottom: 3px;
    text-shadow: 0 1px 2px rgba(0,0,0,0.2);
  }
  .emp-card-name {
    font-size: 14px;
    font-weight: 800;
    color: #fff;
    text-shadow: 0 1px 4px rgba(0,0,0,0.28);
    line-height: 1.2;
    letter-spacing: -0.2px;
    max-width: 200px;
  }
  .emp-card-dist {
    font-size: 13px;
    font-weight: 700;
    color: rgba(255,255,255,0.88);
    text-shadow: 0 1px 3px rgba(0,0,0,0.25);
    white-space: nowrap;
    align-self: flex-end;
  }

  /* ── Bottom nav ─────────────────────── */
  .emp-bottom-nav {
    position: absolute;
    bottom: 0; left: 0; right: 0;
    height: 64px;
    background: rgba(249,249,249,0.94);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-top: 0.5px solid rgba(0,0,0,0.1);
    z-index: 20;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .emp-nav-track {
    display: flex;
    background: #e5e5ea;
    border-radius: 999px;
    padding: 3px;
  }
  .emp-nav-pill {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 7px 18px;
    border-radius: 999px;
    border: none;
    background: transparent;
    font-size: 13px;
    font-weight: 600;
    color: #8e8e93;
    cursor: pointer;
    transition: background 0.18s, color 0.18s, box-shadow 0.18s;
    white-space: nowrap;
  }
  .emp-nav-pill--on {
    background: #fff;
    color: #1c1c1e;
    box-shadow: 0 2px 8px rgba(0,0,0,0.12);
  }

  .emp-empty {
    flex: 1;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    gap: 10px;
    color: #8e8e93;
    font-size: 14px;
    font-weight: 500;
  }
`;

function LayersSvg() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12,2 2,7 12,12 22,7" />
      <polyline points="2,17 12,22 22,17" />
      <polyline points="2,12 12,17 22,12" />
    </svg>
  );
}

function MockMap({ places, selected, onSelect }: {
  places: Place[];
  selected: Place | null;
  onSelect: (p: Place) => void;
}) {
  const UX = 50, UY = 53;
  return (
    <div className="emp-map-area">
      <svg className="emp-map-svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
        {/* base fill */}
        <rect width="100" height="100" fill="#f0ebe0" />

        {/* green zones */}
        <rect x="4" y="60" width="16" height="12" rx="2" fill="#cde9b0" opacity="0.7" />
        <rect x="76" y="14" width="14" height="9" rx="2" fill="#cde9b0" opacity="0.7" />
        <rect x="38" y="74" width="13" height="10" rx="2" fill="#cde9b0" opacity="0.7" />

        {/* water */}
        <ellipse cx="13" cy="28" rx="9" ry="5" fill="#b8d9ef" opacity="0.55" />

        {/* major roads */}
        <rect x="0" y="46" width="100" height="2.8" fill="#ddd3be" />
        <rect x="0" y="68" width="100" height="2.2" fill="#ddd3be" />
        <rect x="0" y="24" width="100" height="2.2" fill="#ddd3be" />
        <rect x="40" y="0" width="2.8" height="100" fill="#ddd3be" />
        <rect x="68" y="0" width="2.2" height="100" fill="#ddd3be" />
        <rect x="18" y="0" width="2.2" height="100" fill="#ddd3be" />

        {/* minor roads */}
        <rect x="0" y="36" width="100" height="1.2" fill="#e8e0ce" />
        <rect x="0" y="57" width="100" height="1.2" fill="#e8e0ce" />
        <rect x="29" y="0" width="1.2" height="100" fill="#e8e0ce" />
        <rect x="54" y="0" width="1.2" height="100" fill="#e8e0ce" />
        <rect x="82" y="0" width="1.2" height="100" fill="#e8e0ce" />

        {/* dotted route */}
        {selected && (
          <line
            x1={UX} y1={UY}
            x2={selected.mapX} y2={selected.mapY}
            stroke="#007AFF"
            strokeWidth="1.6"
            strokeDasharray="3,2.5"
            strokeLinecap="round"
            opacity="0.82"
          />
        )}
      </svg>

      {/* user position */}
      <div className="emp-user-dot" style={{ left: `${UX}%`, top: `${UY}%` }} />

      {/* place pins */}
      {places.map(p => (
        <button
          key={p.id}
          className={`emp-pin${selected?.id === p.id ? ' emp-pin--selected' : ''}`}
          style={{
            left: `${p.mapX}%`,
            top: `${p.mapY}%`,
            background: selected?.id === p.id ? '#FF3B30' : p.pinColor,
          }}
          onClick={() => onSelect(p)}
          aria-label={p.name}
        >
          📍
        </button>
      ))}

      {/* popup */}
      {selected && (
        <div key={selected.id} className="emp-popup"
          style={{ left: `${selected.mapX}%`, top: `${selected.mapY}%` }}>
          <div className="emp-popup-name">{selected.name}</div>
          <div className="emp-popup-meta">
            <span>⭐ {selected.rating}</span>
            <span>{selected.distance}km</span>
          </div>
        </div>
      )}
    </div>
  );
}

function PlaceCard({ place, fav, selected, onFav, onSelect }: {
  place: Place;
  fav: boolean;
  selected: boolean;
  onFav: (id: string) => void;
  onSelect: (p: Place) => void;
}) {
  return (
    <button
      className={`emp-card${selected ? ' emp-card--selected' : ''}`}
      onClick={() => onSelect(place)}
    >
      <div className="emp-card-grad" style={{ background: place.gradient }} />
      <div className="emp-card-stripes" />
      <div className="emp-card-overlay" />
      <div className="emp-card-body">
        <div className="emp-card-top">
          <span className="emp-card-pin-lbl">📍 {place.location}</span>
          <button
            className={`emp-card-fav${fav ? ' emp-card-fav--on' : ''}`}
            onClick={e => { e.stopPropagation(); onFav(place.id); }}
            aria-label={fav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
          >
            {fav ? '❤️' : '🤍'}
          </button>
        </div>
        <div className="emp-card-bottom">
          <div>
            <div className="emp-card-cats">{place.tags.join(' · ')}</div>
            <div className="emp-card-name">{place.name}</div>
          </div>
          <div className="emp-card-dist">{place.distance}km</div>
        </div>
      </div>
    </button>
  );
}

function ListBody({ places, filter, setFilter, favs, toggleFav, selected, onSelect }: {
  places: Place[];
  filter: string;
  setFilter: (f: string) => void;
  favs: Set<string>;
  toggleFav: (id: string) => void;
  selected: Place | null;
  onSelect: (p: Place) => void;
}) {
  return (
    <div className="emp-list-body">
      <div className="emp-list-head">
        <div className="emp-list-left">
          <span className="emp-list-title">Lieux à explorer</span>
          <span className="emp-badge">{places.length}</span>
        </div>
        <button className="emp-filters-btn">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="4" y1="6" x2="16" y2="6" />
            <line x1="8" y1="12" x2="20" y2="12" />
            <line x1="4" y1="18" x2="16" y2="18" />
          </svg>
          Filtres
        </button>
      </div>

      <div className="emp-chips">
        {FILTERS.map(f => (
          <button
            key={f}
            className={`emp-chip${filter === f ? ' emp-chip--on' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="emp-scroll">
        {places.length === 0 ? (
          <div className="emp-empty">
            <span style={{ fontSize: 30 }}>🔍</span>
            <span>Aucun lieu pour ce filtre.</span>
          </div>
        ) : (
          places.map(p => (
            <PlaceCard
              key={p.id}
              place={p}
              fav={favs.has(p.id)}
              selected={selected?.id === p.id}
              onFav={toggleFav}
              onSelect={onSelect}
            />
          ))
        )}
      </div>
    </div>
  );
}

export default function ExploreMapPage() {
  const [view, setView] = useState<'map' | 'list'>('map');
  const [filter, setFilter] = useState('Tout');
  const [selected, setSelected] = useState<Place | null>(PLACES[0]);
  const [favs, setFavs] = useState<Set<string>>(new Set(['mausolee']));

  const visible = PLACES.filter(p =>
    filter === 'Tout' ||
    p.category === filter ||
    p.tags.some(t => t.toLowerCase() === filter.toLowerCase())
  );

  const toggleFav = (id: string) =>
    setFavs(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const handleSelect = (p: Place) => {
    setSelected(p);
    if (view === 'list') setView('map');
  };

  return (
    <>
      <style>{CSS}</style>
      <div className="emp">

        {/* Top bar */}
        <div className={`emp-topbar emp-topbar--${view}`}>
          <button className="emp-loc-pill">
            📍 <strong>Rabat</strong> <span className="emp-loc-chevron">▾</span>
          </button>
          <div className="emp-topbar-actions">
            <button className="emp-icon-btn" title="Calques"><LayersSvg /></button>
            <button className="emp-icon-btn" title="Ajouter" style={{ fontSize: 20, fontWeight: 600 }}>+</button>
          </div>
        </div>

        {/* Map */}
        {view === 'map' && (
          <MockMap places={visible} selected={selected} onSelect={setSelected} />
        )}

        {/* Bottom sheet (map mode) */}
        {view === 'map' && (
          <div className="emp-sheet">
            <div className="emp-drag" />
            <ListBody
              places={visible} filter={filter} setFilter={setFilter}
              favs={favs} toggleFav={toggleFav}
              selected={selected} onSelect={handleSelect}
            />
          </div>
        )}

        {/* Full list (list mode) */}
        {view === 'list' && (
          <div className="emp-list-full">
            <ListBody
              places={visible} filter={filter} setFilter={setFilter}
              favs={favs} toggleFav={toggleFav}
              selected={selected} onSelect={handleSelect}
            />
          </div>
        )}

        {/* Bottom nav */}
        <div className="emp-bottom-nav">
          <div className="emp-nav-track">
            <button
              className={`emp-nav-pill${view === 'map' ? ' emp-nav-pill--on' : ''}`}
              onClick={() => setView('map')}
            >
              🗺 Vue carte
            </button>
            <button
              className={`emp-nav-pill${view === 'list' ? ' emp-nav-pill--on' : ''}`}
              onClick={() => setView('list')}
            >
              ☰ Liste déroulée
            </button>
          </div>
        </div>

      </div>
    </>
  );
}
