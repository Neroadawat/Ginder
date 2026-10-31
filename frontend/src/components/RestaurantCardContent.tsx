import {t, useTranslation} from '@/i18n';
/**
 * RestaurantCardContent — what a swipe card shows.
 *
 * Requirement 8.5 fixes the field list: one photo, name, category, distance,
 * price range and rating. Nothing else, to keep the card readable at a glance.
 */

import React from 'react';
import {
  Image,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import {RestaurantCard} from '@/types/restaurant';
import {getRestaurantImageUri} from '@/constants/restaurantImages';
import {formatDistance} from '@/utils/distance';
import PhotoAttribution from './PhotoAttribution';
import DataAttribution from './DataAttribution';
import {categoryLabel} from '@/utils/category';

interface Props {
  restaurant: RestaurantCard;
}

const RestaurantCardContent = ({restaurant}: Props) => {
  useTranslation();
  const imageUri = getRestaurantImageUri(restaurant);
  const hasRestaurantPhoto =
    restaurant.source !== 'google_live' &&
    Boolean(
      restaurant.photo_url &&
        restaurant.photo_source &&
        restaurant.photo_attribution,
    );

  return (
    <View style={styles.image}>
      <Image
        key={imageUri}
        source={{
          uri: imageUri,
          cache: 'default',
        }}
        fadeDuration={0}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
        accessibilityLabel={t('ภาพประกอบร้าน {p0}', {p0: restaurant.name})}
      />
      <View style={styles.scrim} />
      <View style={styles.info}>
        <View style={styles.openPill}>
          <View style={styles.openDot} />
          <Text style={styles.openText}>{t('ร้านอาหาร')}</Text>
        </View>
        <Text style={styles.name} numberOfLines={1}>
          {restaurant.name}
        </Text>

        <View style={styles.metaRow}>
          <Text style={styles.category}>
            {categoryLabel(restaurant.primary_category)}
          </Text>
          {restaurant.price_symbol && (
            <Text style={styles.price}>{restaurant.price_symbol}</Text>
          )}
          {restaurant.rating != null && (
            <Text style={styles.rating}>
              {t('คะแนน ')}
              {restaurant.rating.toFixed(1)}
            </Text>
          )}
        </View>
        {restaurant.distance_km != null && (
          <Text style={styles.distance}>
            {t('ห่าง ')}
            {formatDistance(restaurant.distance_km)}
          </Text>
        )}
        {restaurant.address && (
          <Text style={styles.distance} numberOfLines={2}>
            {restaurant.address}
          </Text>
        )}
        {!hasRestaurantPhoto && (
          <Text style={styles.illustration}>{t('Illustrative image')}</Text>
        )}
        <PhotoAttribution
          restaurant={restaurant}
          light
          photoVisible={hasRestaurantPhoto}
        />
        <DataAttribution source={restaurant.source} light />
        {restaurant.source === 'google_live' && (
          <TouchableOpacity
            style={styles.mapsLink}
            disabled={!restaurant.google_maps_url}
            accessibilityRole="link"
            accessibilityLabel={t('Open in Google Maps')}
            onPress={() => {
              if (restaurant.google_maps_url) {
                Linking.openURL(restaurant.google_maps_url);
              }
            }}>
            <Text style={styles.googleAttribution}>Google Maps</Text>
          </TouchableOpacity>
        )}
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
  scrim: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
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
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  category: {
    flexShrink: 1,
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
  googleAttribution: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '400',
    marginTop: 6,
  },
  illustration: {color: '#E6E1E1', fontSize: 11, marginTop: 6},
  mapsLink: {minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start'},
});

export default RestaurantCardContent;
