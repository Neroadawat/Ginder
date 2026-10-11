import React from 'react';
import {
  Linking,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  TouchableOpacity,
} from 'react-native';

import {RestaurantCard} from '@/types/restaurant';

interface Props {
  restaurant: RestaurantCard;
  light?: boolean;
  style?: StyleProp<TextStyle>;
  photoVisible?: boolean;
}

const PhotoAttribution = ({
  restaurant,
  light = false,
  style,
  photoVisible = Boolean(restaurant.photo_url),
}: Props) => {
  if (!photoVisible || !restaurant.photo_attribution) {
    return null;
  }

  const rawSourceUrl =
    restaurant.source === 'google_live'
      ? restaurant.google_photo_maps_uri
      : restaurant.photo_source;
  const sourceUrl = rawSourceUrl?.startsWith('//')
    ? `https:${rawSourceUrl}`
    : rawSourceUrl?.startsWith('http')
    ? rawSourceUrl
    : null;
  const credit = `Photo: ${restaurant.photo_attribution}`;
  const textStyle = [styles.text, light && styles.light, style];

  if (!sourceUrl) {
    return <Text style={textStyle}>{credit}</Text>;
  }

  return (
    <TouchableOpacity
      accessibilityRole="link"
      accessibilityLabel={`${credit}. Open photo source`}
      onPress={() => Linking.openURL(sourceUrl)}>
      <Text style={textStyle}>{credit}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  text: {
    color: '#777',
    fontSize: 9,
    marginTop: 4,
  },
  light: {
    color: '#EEE',
  },
});

export default PhotoAttribution;
