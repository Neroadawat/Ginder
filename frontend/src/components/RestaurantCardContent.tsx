/**
 * RestaurantCardContent — Content displayed inside a swipe card.
 * Shows: image, name, category, distance, price, rating.
 */

import React from 'react';
import {View, Text, Image, StyleSheet} from 'react-native';

import {RestaurantCard} from '@/types/restaurant';

const PLACEHOLDER_IMAGES: Record<string, string> = {
  Thai: 'https://via.placeholder.com/400x300/FF6B6B/FFF?text=Thai',
  Japanese: 'https://via.placeholder.com/400x300/FF6B6B/FFF?text=Japanese',
  Korean: 'https://via.placeholder.com/400x300/FF6B6B/FFF?text=Korean',
  'Fast Food': 'https://via.placeholder.com/400x300/FF6B6B/FFF?text=Fast+Food',
  Cafe: 'https://via.placeholder.com/400x300/FF6B6B/FFF?text=Cafe',
  Dessert: 'https://via.placeholder.com/400x300/FF6B6B/FFF?text=Dessert',
};

const PRICE_LABELS: Record<number, string> = {
  1: '฿',
  2: '฿฿',
  3: '฿฿฿',
};

interface Props {
  restaurant: RestaurantCard;
}

const RestaurantCardContent = ({restaurant}: Props) => {
  const imageUri =
    restaurant.image_url || PLACEHOLDER_IMAGES[restaurant.category] || PLACEHOLDER_IMAGES['Cafe'];

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
          <Text style={styles.category}>{restaurant.category}</Text>
          {restaurant.distance_km != null && (
            <Text style={styles.distance}>📍 {restaurant.distance_km} km</Text>
          )}
        </View>

        <View style={styles.metaRow}>
          {restaurant.price_level != null && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {PRICE_LABELS[restaurant.price_level] || '฿'}
              </Text>
            </View>
          )}
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
