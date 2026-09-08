/**
 * RestaurantCardContent — what a swipe card shows.
 *
 * Requirement 8.5 fixes the field list: one photo, name, category, distance,
 * price range and rating. Nothing else, to keep the card readable at a glance.
 */

import React from 'react';
import {Image, StyleSheet, Text, View} from 'react-native';

import {RestaurantCard} from '@/types/restaurant';
import {getPlaceholderImage} from '@/constants/placeholders';

interface Props {
  restaurant: RestaurantCard;
}

const RestaurantCardContent = ({restaurant}: Props) => {
  // Requirement 8.7: fall back to a category-specific placeholder.
  const imageUri = restaurant.photo_url || getPlaceholderImage(restaurant.primary_category);

  return (
    <View style={styles.container}>
      <Image
        source={{uri: imageUri}}
        style={styles.image}
        resizeMode="cover"
        accessibilityLabel={`Photo of ${restaurant.name}`}
      />

      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {restaurant.name}
        </Text>

        <View style={styles.metaRow}>
          <Text style={styles.category}>{restaurant.primary_category}</Text>
          {restaurant.distance_km != null && (
            <Text style={styles.distance}>📍 {restaurant.distance_km} km</Text>
          )}
        </View>

        <View style={styles.metaRow}>
          {/* Rendered from the server-provided symbol so the 0-4 to ฿ mapping
              lives in exactly one place. */}
          {restaurant.price_symbol && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{restaurant.price_symbol}</Text>
            </View>
          )}

          {/* Requirement 8.6: hide the rating entirely when unknown. */}
          {restaurant.rating != null && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>⭐ {restaurant.rating.toFixed(1)}</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  image: {
    flex: 1,
    width: '100%',
  },
  info: {
    padding: 16,
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
    color: '#333',
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  category: {
    fontSize: 14,
    color: '#666',
  },
  distance: {
    fontSize: 14,
    color: '#999',
  },
  badge: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  badgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
});

export default RestaurantCardContent;
