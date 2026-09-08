/**
 * Placeholder imagery for restaurants with no photo (requirement 8.7).
 *
 * Kept in one module so the card, the list row and any future surface all fall
 * back to the same image for a given category.
 */

const PLACEHOLDER_BY_CATEGORY: Record<string, string> = {
  Thai: 'https://placehold.co/600x450/FF6B6B/FFFFFF?text=Thai',
  Japanese: 'https://placehold.co/600x450/FF6B6B/FFFFFF?text=Japanese',
  Korean: 'https://placehold.co/600x450/FF6B6B/FFFFFF?text=Korean',
  Chinese: 'https://placehold.co/600x450/FF6B6B/FFFFFF?text=Chinese',
  Italian: 'https://placehold.co/600x450/FF6B6B/FFFFFF?text=Italian',
  'Fast Food': 'https://placehold.co/600x450/FF6B6B/FFFFFF?text=Fast+Food',
  Cafe: 'https://placehold.co/600x450/FF6B6B/FFFFFF?text=Cafe',
  Dessert: 'https://placehold.co/600x450/FF6B6B/FFFFFF?text=Dessert',
};

const FALLBACK = 'https://placehold.co/600x450/FF6B6B/FFFFFF?text=Restaurant';

/** Placeholder image URL for a display category. */
export const getPlaceholderImage = (category: string): string =>
  PLACEHOLDER_BY_CATEGORY[category] ?? FALLBACK;

/** Emoji used on the Explore tiles and empty list rows. */
export const CATEGORY_EMOJI: Record<string, string> = {
  Thai: '🇹🇭',
  Japanese: '🇯🇵',
  Korean: '🇰🇷',
  Chinese: '🥟',
  Italian: '🍝',
  'Fast Food': '🍔',
  Cafe: '☕',
  Dessert: '🍰',
};

export const getCategoryEmoji = (category: string): string =>
  CATEGORY_EMOJI[category] ?? '🍽️';
