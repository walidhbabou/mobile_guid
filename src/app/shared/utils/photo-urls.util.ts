/**
 * Utilitaire pour traiter les photo_urls qui peuvent être passées en tant que:
 * - Array natif: string[]
 * - JSON stringifié: "[\"url1\", \"url2\"]"
 * - String simple: "url"
 * - Undefined: undefined
 */
export function parsePhotoUrls(value: unknown): string[] {
  // Si c'est déjà un array, retourner tel quel
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  }

  // Si c'est une string
  if (typeof value === 'string' && value.trim().length > 0) {
    // Tenter de parser comme JSON
    if (value.trim().startsWith('[')) {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
          return parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
        }
      } catch {
        // Ignorer l'erreur JSON et traiter comme une simple string
      }
    }
    // Retourner comme array à un seul élément
    return [value.trim()];
  }

  return [];
}

/**
 * Obtient la meilleure URL d'image disponible
 * Priorité: imageUrl -> photo_url -> photo_urls[0] -> fallbackImageUrl
 */
export function getBestImageUrl(entity: {
  imageUrl?: string;
  photo_url?: string;
  photo_urls?: string[] | string;
  fallbackImageUrl?: string;
}): string | undefined {
  if (entity.imageUrl) {
    return entity.imageUrl;
  }

  if (entity.photo_url) {
    return entity.photo_url;
  }

  const photoUrls = parsePhotoUrls(entity.photo_urls);
  if (photoUrls.length > 0) {
    return photoUrls[0];
  }

  return entity.fallbackImageUrl;
}

/**
 * Vérifie si une entité a une image disponible
 */
export function hasImage(entity: {
  imageUrl?: string;
  photo_url?: string;
  photo_urls?: string[] | string;
  fallbackImageUrl?: string;
}): boolean {
  return !!getBestImageUrl(entity);
}
