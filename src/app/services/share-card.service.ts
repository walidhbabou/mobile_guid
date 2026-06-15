import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Place } from '../data/tourism.data';

/**
 * Genere une carte visuelle stylisee (format portrait Instagram/WhatsApp) a
 * partir d'un lieu, puis la partage via la feuille de partage native ou le
 * Web Share API. Rendu avec l'API Canvas (fiable avec Ionic / shadow DOM).
 */
@Injectable({ providedIn: 'root' })
export class ShareCardService {
  private readonly WIDTH = 1080;
  private readonly HEIGHT = 1350;
  private readonly BRAND = 'GUIDINTELLIGENT';

  async sharePlaceCard(place: Place, imageUrl?: string): Promise<void> {
    const dataUrl = await this.renderCard(place, imageUrl);

    if (Capacitor.isNativePlatform()) {
      await this.shareNative(place, dataUrl);
    } else {
      await this.shareWeb(place, dataUrl);
    }
  }

  // ── Rendu de la carte ───────────────────────────────────────
  private async renderCard(place: Place, imageUrl?: string): Promise<string> {
    const canvas = document.createElement('canvas');
    canvas.width = this.WIDTH;
    canvas.height = this.HEIGHT;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas non disponible');
    }

    try {
      await (document as Document & { fonts?: FontFaceSet }).fonts?.ready;
    } catch {
      // polices non garanties : fallback sans-serif
    }

    // Fond degrade de marque (visible si pas de photo)
    this.paintBrandBackground(ctx);

    // Photo du lieu (chargee en blob pour eviter de "tainter" le canvas)
    const image = await this.loadImage(imageUrl);
    if (image) {
      this.drawCover(ctx, image, 0, 0, this.WIDTH, this.HEIGHT);
    }

    // Voile sombre bas pour lisibilite du texte
    const overlay = ctx.createLinearGradient(0, this.HEIGHT * 0.35, 0, this.HEIGHT);
    overlay.addColorStop(0, 'rgba(8, 15, 35, 0)');
    overlay.addColorStop(0.55, 'rgba(8, 15, 35, 0.55)');
    overlay.addColorStop(1, 'rgba(6, 12, 28, 0.92)');
    ctx.fillStyle = overlay;
    ctx.fillRect(0, 0, this.WIDTH, this.HEIGHT);

    // Pastille de marque (haut gauche)
    this.drawBrandPill(ctx);

    // Bloc texte (bas)
    this.drawTextBlock(ctx, place);

    return canvas.toDataURL('image/jpeg', 0.92);
  }

  private paintBrandBackground(ctx: CanvasRenderingContext2D): void {
    const gradient = ctx.createLinearGradient(0, 0, this.WIDTH, this.HEIGHT);
    gradient.addColorStop(0, '#2563EB');
    gradient.addColorStop(1, '#1E3A8A');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.WIDTH, this.HEIGHT);
  }

  private drawBrandPill(ctx: CanvasRenderingContext2D): void {
    const x = 56;
    const y = 56;
    const text = `✦ ${this.BRAND}`;
    ctx.font = '700 32px "Outfit", "Manrope", sans-serif';
    const paddingX = 28;
    const textWidth = ctx.measureText(text).width;
    const pillW = textWidth + paddingX * 2;
    const pillH = 64;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
    this.roundRect(ctx, x, y, pillW, pillH, 32);
    ctx.fill();

    ctx.fillStyle = '#1D4ED8';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(text, x + paddingX, y + pillH / 2 + 1);
  }

  private drawTextBlock(ctx: CanvasRenderingContext2D, place: Place): void {
    const left = 64;
    const right = this.WIDTH - 64;
    let y = this.HEIGHT - 96;

    // Signature bas
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.font = '600 28px "Manrope", sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.fillText('Découvrez ce lieu sur GuidIntelligent · Maroc', left, y);

    // Localisation
    y -= 56;
    const location = place.city || place.location || 'Maroc';
    ctx.font = '600 34px "Manrope", sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillText(`📍 ${location}`, left, y);

    // Note
    if (typeof place.rating === 'number' && place.rating > 0) {
      y -= 56;
      const stars = this.buildStars(place.rating);
      ctx.font = '700 38px "Manrope", sans-serif';
      ctx.fillStyle = '#FACC15';
      ctx.fillText(stars, left, y);
      const starsWidth = ctx.measureText(stars).width;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(`  ${place.rating.toFixed(1)} / 5`, left + starsWidth, y);
    }

    // Nom (jusqu'a 2 lignes, du bas vers le haut)
    y -= 24;
    const nameLines = this.wrapText(ctx, place.name, right - left, '800 76px "Outfit", "Manrope", sans-serif', 2);
    ctx.font = '800 76px "Outfit", "Manrope", sans-serif';
    ctx.fillStyle = '#FFFFFF';
    for (let i = nameLines.length - 1; i >= 0; i -= 1) {
      ctx.fillText(nameLines[i], left, y);
      y -= 84;
    }

    // Categorie (au dessus du nom)
    const category = (place.category || 'Lieu').toUpperCase();
    ctx.font = '800 30px "Outfit", "Manrope", sans-serif';
    ctx.fillStyle = '#93C5FD';
    ctx.fillText(category, left, y);
  }

  // ── Helpers dessin ──────────────────────────────────────────
  private buildStars(rating: number): string {
    const full = Math.max(0, Math.min(5, Math.round(rating)));
    return '★'.repeat(full) + '☆'.repeat(5 - full);
  }

  private wrapText(
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number,
    font: string,
    maxLines: number
  ): string[] {
    ctx.font = font;
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let current = '';

    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (ctx.measureText(candidate).width > maxWidth && current) {
        lines.push(current);
        current = word;
        if (lines.length === maxLines - 1) {
          break;
        }
      } else {
        current = candidate;
      }
    }

    let rest = current;
    const usedWords = lines.join(' ').split(/\s+/).filter(Boolean).length;
    if (lines.length === maxLines - 1) {
      rest = words.slice(usedWords).join(' ');
    }

    if (rest) {
      if (lines.length >= maxLines - 1 && ctx.measureText(rest).width > maxWidth) {
        rest = this.ellipsize(ctx, rest, maxWidth);
      }
      lines.push(rest);
    }

    return lines.slice(0, maxLines);
  }

  private ellipsize(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
    let result = text;
    while (result.length > 1 && ctx.measureText(`${result}…`).width > maxWidth) {
      result = result.slice(0, -1);
    }
    return `${result.trim()}…`;
  }

  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number, r: number
  ): void {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  private drawCover(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    x: number, y: number, w: number, h: number
  ): void {
    const ratio = Math.max(w / img.width, h / img.height);
    const dw = img.width * ratio;
    const dh = img.height * ratio;
    const dx = x + (w - dw) / 2;
    const dy = y + (h - dh) / 2;
    ctx.drawImage(img, dx, dy, dw, dh);
  }

  private async loadImage(imageUrl?: string): Promise<HTMLImageElement | null> {
    if (!imageUrl || imageUrl.startsWith('data:image/svg')) {
      return null;
    }

    try {
      // fetch -> blob -> objectURL : l'image reste "same-origin" pour le canvas.
      const response = await fetch(imageUrl);
      if (!response.ok) {
        return null;
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);

      const image = await new Promise<HTMLImageElement | null>((resolve) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => resolve(null);
        el.src = objectUrl;
      });

      URL.revokeObjectURL(objectUrl);
      return image;
    } catch {
      return null;
    }
  }

  // ── Partage ─────────────────────────────────────────────────
  private async shareNative(place: Place, dataUrl: string): Promise<void> {
    const base64 = dataUrl.split(',')[1];
    const fileName = `guidintelligent-${this.slug(place.name)}-${Date.now()}.jpg`;

    const written = await Filesystem.writeFile({
      path: fileName,
      data: base64,
      directory: Directory.Cache,
    });

    await Share.share({
      title: place.name,
      text: `${place.name} — ${place.city || place.location || 'Maroc'} · via GuidIntelligent`,
      files: [written.uri],
      dialogTitle: 'Partager ce lieu',
    });
  }

  private async shareWeb(place: Place, dataUrl: string): Promise<void> {
    const blob = await (await fetch(dataUrl)).blob();
    const file = new File([blob], `guidintelligent-${this.slug(place.name)}.jpg`, { type: 'image/jpeg' });

    const nav = navigator as Navigator & {
      canShare?: (data?: { files?: File[]; title?: string; text?: string }) => boolean;
      share?: (data?: { files?: File[]; title?: string; text?: string }) => Promise<void>;
    };

    if (nav.canShare?.({ files: [file] }) && nav.share) {
      await nav.share({
        title: place.name,
        text: `${place.name} · via GuidIntelligent`,
        files: [file],
      });
      return;
    }

    // Repli: telechargement de l'image
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = file.name;
    link.click();
  }

  private slug(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'lieu';
  }
}
