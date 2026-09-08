/**
 * RestaurantCardContent — what a swipe card shows.
 *
 * Requirement 8.5 fixes the field list: one photo, name, category, distance,
 * price range and rating. Nothing else, to keep the card readable at a glance.
 */

import React from 'react';
import {ImageBackground, StyleSheet, Text, View} from 'react-native';

import {RestaurantCard} from '@/types/restaurant';
import {getPlaceholderImage} from '@/constants/placeholders';

interface Props {
  restaurant: RestaurantCard;
}

const RestaurantCardContent = ({restaurant}: Props) => {
  // Requirement 8.7: fall back to a category-specific placeholder.
  const imageUri =
    restaurant.photo_url || getPlaceholderImage(restaurant.primary_category);

  return (
    <ImageBackground
      source={{uri: imageUri}}
      style={styles.image}
      resizeMode="cover"
      accessibilityLabel={`Photo of ${restaurant.name}`}>
      <View style={styles.scrim} />
      <View style={styles.info}>
        <View style={styles.openPill}>
          <View style={styles.openDot} />
          <Text style={styles.openText}>Restaurant</Text>
        </View>
        <Text style={styles.name} numberOfLines={1}>
          {restaurant.name}
        </Text>

        <View style={styles.metaRow}>
          <Text style={styles.category}>{restaurant.primary_category}</Text>
          {restaurant.price_symbol && (
            <Text style={styles.price}>{restaurant.price_symbol}</Text>
          )}
          {restaurant.rating != null && (
            <Text style={styles.rating}>★ {restaurant.rating.toFixed(1)}</Text>
          )}
        </View>
        {restaurant.distance_km != null && (
          <Text style={styles.distance}>
            ⌖ {restaurant.distance_km} km away
          </Text>
        )}
      </View>
    </ImageBackground>
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
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.08)',
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
  },
  info: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 18,
    paddingTop: 62,
    paddingBottom: 142,
    backgroundColor: 'rgba(9,7,7,0.66)',
  },
  name: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFF',
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
    color: '#FFF',
  },
  distance: {
    fontSize: 13,
    color: '#E6E1E1',
    marginTop: 10,
  },
  price: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  rating: {
    color: '#FFD36B',
    fontSize: 14,
    fontWeight: '700',
  },
  openPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFF',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 8,
  },
  openDot: {width: 7, height: 7, borderRadius: 4, backgroundColor: '#38A169'},
  openText: {fontSize: 11, color: '#151313', fontWeight: '700'},
});

export default RestaurantCardContent;
