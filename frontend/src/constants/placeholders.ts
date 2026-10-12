/**
 * Placeholder imagery for restaurants with no photo (requirement 8.7).
 *
 * Kept in one module so the card, the list row and any future surface all fall
 * back to the same image for a given category.
 */

import {Image} from 'react-native';
const PLACEHOLDER_BY_CATEGORY: Record<string, number> = {
  Thai: require('../assets/placeholders/thai.png'),
  Japanese: require('../assets/placeholders/japanese.png'),
  Korean: require('../assets/placeholders/korean.png'),
  Chinese: require('../assets/placeholders/chinese.png'),
  Italian: require('../assets/placeholders/italian.png'),
  'Fast Food': require('../assets/placeholders/fast-food.png'),
  Cafe: require('../assets/placeholders/cafe.png'),
  Dessert: require('../assets/placeholders/dessert.png'),
  'Food Court': require('../assets/placeholders/food-court.png'),
  Steak: require('../assets/placeholders/steak.png'),
  'Hot Pot': require('../assets/placeholders/hot-pot.png'),
  Indian: require('../assets/placeholders/indian.png'),
};

const FALLBACK = require('../assets/placeholders/other.png');

/** Placeholder image URL for a display category. */
export const getPlaceholderImage = (category: string): string =>
  Image.resolveAssetSource(PLACEHOLDER_BY_CATEGORY[category] ?? FALLBACK)
    ?.uri ?? '';

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
  'Food Court': '🍱',
  Steak: '🥩',
  'Hot Pot': '🍲',
  Indian: '🍛',
};

export const getCategoryEmoji = (category: string): string =>
  CATEGORY_EMOJI[category] ?? '🍽️';
