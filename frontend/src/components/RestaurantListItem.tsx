/**
 * RestaurantListItem — Restaurant displayed in a list (Explore / Category results).
 */

import React from 'react';
import {View, Text, Image, StyleSheet, TouchableOpacity, Linking} from 'react-native';

import {RestaurantCard} from '@/types/restaurant';

const PRICE_LABELS: Record<number, string> = {1: '฿', 2: '฿฿', 3: '฿฿฿'};

interface Props {
  restaurant: RestaurantCard;
}

const RestaurantListItem = ({restaurant}: Props) => {
  const handleNavigate = () => {
    if (restaurant.google_maps_url) {
      Linking.openURL(restaurant.google_maps_url);
    }
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={handleNavigate}
      accessibilityRole="button"
      accessibilityLabel={`${restaurant.name}, ${restaurant.category}`}>
      {restaurant.image_url ? (
        <Image
          source={{uri: restaurant.image_url}}
          style={styles.image}
          resizeMode="cover"
        />
      ) : (
        <View style={styles.placeholderImage}>
          <Text style={styles.placeholderEmoji}>🍽️</Text>
        </View>
      )}

      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {restaurant.name}
        </Text>
        <Text style={styles.category}>{restaurant.category}</Text>

        <View style={styles.metaRow}>
          {restaurant.price_level != null && (
            <Text style={styles.meta}>
              {PRICE_LABELS[restaurant.price_level]}
            </Text>
          )}
          {restaurant.rating != null && (
            <Text style={styles.meta}>⭐ {restaurant.rating.toFixed(1)}</Text>
          )}
          {restaurant.distance_km != null && (
            <Text style={styles.meta}>{restaurant.distance_km} km</Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
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
});

export default RestaurantListItem;
