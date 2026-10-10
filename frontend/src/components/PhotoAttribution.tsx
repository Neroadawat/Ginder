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
}

const PhotoAttribution = ({restaurant, light = false, style}: Props) => {
  if (!restaurant.photo_url || !restaurant.photo_attribution) {
    return null;
  }

  const sourceUrl = restaurant.photo_source?.startsWith('http')
    ? restaurant.photo_source
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
