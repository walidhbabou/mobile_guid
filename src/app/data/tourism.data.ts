export interface Place {
  id: string;
  name: string;
  location: string;
  rating: number;
  reviewsLabel: string;
  reviewsCount: number;
  category: string;
  badge: string;
  theme: string;
  icon: string;
  spotlight: string;
  shortDescription: string;
  longDescription: string;
  address: string;
  hours: string;
  starsLabel: string;
  highlights: string[];
}

export interface Review {
  author: string;
  role: string;
  ratingLabel: string;
  comment: string;
  likes: number;
  replies: number;
  avatar: string;
}

export interface NotificationItem {
  icon: string;
  title: string;
  description: string;
  time: string;
  tone: 'primary' | 'secondary' | 'success';
}

export interface ProfileStat {
  label: string;
  value: string;
}

export interface ProfileAction {
  icon: string;
  title: string;
  subtitle: string;
}

const rabatKasbah: Place = {
  id: 'rabat-kasbah',
  name: 'Rabat',
  location: 'Kasbah des Oudayas',
  rating: 4.8,
  reviewsLabel: '320 avis',
  reviewsCount: 320,
  category: 'Culture',
  badge: 'Ville imperiale',
  theme: 'theme-rabat',
  icon: 'business-outline',
  spotlight: 'Panorama historique sur l embouchure du Bouregreg',
  shortDescription: 'Remparts, jardins andalous et heritage au bord de l eau.',
  longDescription: 'Rabat offre un parcours elegant entre medina paisible, remparts atlantiques et monuments emblematiques. C est une etape ideale pour une premiere immersion culturelle.',
  address: 'Kasbah des Oudayas, Rabat',
  hours: '09:00 - 19:00',
  starsLabel: '★★★★☆',
  highlights: ['Vue ocean', 'Medina calme', 'Culture'],
};

const marrakechMedina: Place = {
  id: 'marrakech-medina',
  name: 'Marrakech',
  location: 'Medina et rooftops',
  rating: 4.7,
  reviewsLabel: '280 avis',
  reviewsCount: 280,
  category: 'Culture',
  badge: 'Ambiance',
  theme: 'theme-marrakech',
  icon: 'sunny-outline',
  spotlight: 'Terrasses dorees, souks et couchers de soleil vibrants',
  shortDescription: 'Une ville intense, creative et lumineuse a explorer au rythme des ruelles.',
  longDescription: 'Marrakech melange artisanat, saveurs et architecture ocre dans une atmosphere tres vivante. Le circuit conseille passe par la medina, les rooftops et les jardins.',
  address: 'Jemaa el-Fna, Marrakech',
  hours: '10:00 - 23:00',
  starsLabel: '★★★★☆',
  highlights: ['Souks', 'Cuisine', 'Sunset'],
};

const chefchaouenMedina: Place = {
  id: 'chefchaouen-medina',
  name: 'Chefchaouen',
  location: 'Vieille ville bleue',
  rating: 4.9,
  reviewsLabel: '410 avis',
  reviewsCount: 410,
  category: 'Decouverte',
  badge: 'Photogenique',
  theme: 'theme-chefchaouen',
  icon: 'sparkles-outline',
  spotlight: 'Ruelles bleues, artisanat local et ambiance apaisante',
  shortDescription: 'Le joyau bleu du Rif pour une promenade douce et tres visuelle.',
  longDescription: 'Chefchaouen seduit par son calme, ses murs bleus et ses points de vue en hauteur. C est la destination parfaite pour la balade, la photo et l artisanat.',
  address: 'Place Outa el Hammam, Chefchaouen',
  hours: '08:30 - 20:30',
  starsLabel: '★★★★★',
  highlights: ['Couleurs bleues', 'Artisanat', 'Balades'],
};

const agadirBeach: Place = {
  id: 'agadir-beach',
  name: 'Agadir',
  location: 'Front de mer',
  rating: 4.6,
  reviewsLabel: '260 avis',
  reviewsCount: 260,
  category: 'Plage',
  badge: 'Ocean',
  theme: 'theme-agadir',
  icon: 'boat-outline',
  spotlight: 'Longue plage, promenade moderne et atmosphere detendue',
  shortDescription: 'Une respiration balneaire entre sable chaud, surf et couchers de soleil.',
  longDescription: 'Agadir est ideale pour une escapade soleil avec plage facile d acces, activites nautiques et restaurants en bord de mer. Le rythme y est plus relax.',
  address: 'Corniche, Agadir',
  hours: '07:00 - 21:00',
  starsLabel: '★★★★☆',
  highlights: ['Plage', 'Surf', 'Famille'],
};

const zooRabat: Place = {
  id: 'zoo-rabat',
  name: 'Zoo de Rabat',
  location: 'Temara - Rabat',
  rating: 4.7,
  reviewsLabel: '103 avis',
  reviewsCount: 103,
  category: 'Decouverte',
  badge: 'Famille',
  theme: 'theme-zoo',
  icon: 'paw-outline',
  spotlight: 'Animaux bien soignes, grands espaces et parcours ombrages',
  shortDescription: 'Une sortie familiale complete avec observation, pedagogie et detente.',
  longDescription: 'Le Zoo de Rabat propose un parcours fluide avec animaux d Afrique, signaletique claire et zones de repos. L experience fonctionne tres bien pour les familles et les groupes.',
  address: 'Route de Casablanca, Temara',
  hours: '09:00 - 18:30',
  starsLabel: '★★★★☆',
  highlights: ['Famille', 'Audio guide', 'Accessibilite'],
};

export const HOME_PLACES: Place[] = [
  rabatKasbah,
  marrakechMedina,
  chefchaouenMedina,
  agadirBeach,
];

export const MAP_PLACES: Place[] = [
  rabatKasbah,
  zooRabat,
  agadirBeach,
  chefchaouenMedina,
];

export const FAVORITE_PLACES: Place[] = [
  chefchaouenMedina,
  zooRabat,
  rabatKasbah,
];

export const ALL_PLACES: Place[] = [
  rabatKasbah,
  marrakechMedina,
  chefchaouenMedina,
  agadirBeach,
  zooRabat,
];

export const QUICK_FILTERS = ['Culture', 'Plage', 'Famille', 'Road trip'];

export const MAP_FILTERS = ['Populaires', 'Culture', 'Famille', 'Nature'];

export const MAP_MARKERS = [
  { placeId: 'rabat-kasbah', top: 24, left: 46 },
  { placeId: 'zoo-rabat', top: 40, left: 63 },
  { placeId: 'agadir-beach', top: 71, left: 33 },
  { placeId: 'chefchaouen-medina', top: 16, left: 24 },
];

export const AUDIO_WAVE = [20, 34, 26, 48, 30, 42, 18, 28, 24, 38, 16, 30];

export const REVIEWS: Review[] = [
  {
    author: 'Alex Martin',
    role: 'Guide local',
    ratingLabel: '★★★★★',
    comment: 'Super endroit. Les animaux sont bien soignes et l espace est vaste, ideal pour une sortie en famille.',
    likes: 12,
    replies: 3,
    avatar: 'A',
  },
  {
    author: 'Sophie Dubois',
    role: 'Voyageuse',
    ratingLabel: '★★★★☆',
    comment: 'Tres bonne organisation, visite agreable et parcours bien signale. L audio guide ajoute un vrai plus.',
    likes: 9,
    replies: 1,
    avatar: 'S',
  },
];

export const NOTIFICATIONS: NotificationItem[] = [
  {
    icon: 'flash-outline',
    title: 'Nouveau circuit suggere',
    description: 'Une balade culturelle de 3 heures a Rabat a ete preparee selon vos favoris.',
    time: 'Il y a 8 min',
    tone: 'primary',
  },
  {
    icon: 'volume-high-outline',
    title: 'Audio guide disponible',
    description: 'Le module audio du Zoo de Rabat est pret a etre ecoute hors connexion.',
    time: 'Il y a 42 min',
    tone: 'secondary',
  },
  {
    icon: 'heart-outline',
    title: 'Favori synchronise',
    description: 'Chefchaouen a ete ajoute a votre collection de lieux inspires.',
    time: 'Aujourd hui',
    tone: 'success',
  },
];

export const PROFILE_STATS: ProfileStat[] = [
  { label: 'Lieux visites', value: '12' },
  { label: 'Favoris', value: '04' },
  { label: 'Audio guides', value: '07' },
];

export const PROFILE_ACTIONS: ProfileAction[] = [
  {
    icon: 'options-outline',
    title: 'Preferences',
    subtitle: 'Culture, famille, audio guide',
  },
  {
    icon: 'download-outline',
    title: 'Mode hors ligne',
    subtitle: '2 cartes et 7 fiches telechargees',
  },
  {
    icon: 'help-buoy-outline',
    title: 'Assistance',
    subtitle: 'Aide et conseils de voyage',
  },
];

export function getPlaceById(id: string): Place {
  return ALL_PLACES.find((place) => place.id === id) ?? zooRabat;
}
