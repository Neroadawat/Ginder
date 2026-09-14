/**
 * RestaurantListItem — a restaurant row in Explore results or the Likes tab.
 *
 * Tapping it opens Google Maps navigation (requirement 11.3).
 */

import React from 'react';
import {Image, Linking, StyleSheet, Text, TouchableOpacity, View} from 'react-native';

import {RestaurantCard} from '@/types/restaurant';
import {getRestaurantImageUri} from '@/constants/restaurantImages';

interface Props {
  restaurant: RestaurantCard;
}

const RestaurantListItem = ({restaurant}: Props) => {
  const canNavigate = Boolean(restaurant.google_maps_url);

  const handleNavigate = () => {
    if (restaurant.google_maps_url) {
      Linking.openURL(restaurant.google_maps_url);
    }
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={handleNavigate}
      disabled={!canNavigate}
      accessibilityRole="button"
      accessibilityLabel={
        canNavigate
          ? `Navigate to ${restaurant.name}, ${restaurant.primary_category}`
          : `${restaurant.name}, ${restaurant.primary_category}`
      }>
      <Image source={{uri: getRestaurantImageUri(restaurant)}} style={styles.image} resizeMode="cover" />

      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {restaurant.name}
        </Text>
        <Text style={styles.category}>{restaurant.primary_category}</Text>

        <View style={styles.metaRow}>
          {restaurant.price_symbol && (
            <Text style={styles.meta}>{restaurant.price_symbol}</Text>
          )}
          {restaurant.rating != null && (
            <Text style={styles.meta}>⭐ {restaurant.rating.toFixed(1)}</Text>
          )}
          {restaurant.distance_km != null && (
            <Text style={styles.meta}>{restaurant.distance_km} km</Text>
          )}
        </View>
      </View>

      {canNavigate && <Text style={styles.navigateIcon}>📍</Text>}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 10,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  image: {
    width: 90,
    height: 90,
  },
  placeholderImage: {
    width: 90,
    height: 90,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderEmoji: {
    fontSize: 32,
  },
  info: {
    flex: 1,
    padding: 12,
    justifyContent: 'center',
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  category: {
    fontSize: 13,
    color: '#999',
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  meta: {
    fontSize: 13,
    color: '#666',
  },
  navigateIcon: {
    fontSize: 18,
    paddingHorizontal: 14,
  },
});

export default RestaurantListItem;
