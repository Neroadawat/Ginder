import React from 'react';
import {t, useTranslation} from '@/i18n';
import {
  Linking,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  TouchableOpacity,
  View,
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
  useTranslation();
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
  const credit = t('Photo: {credit}', {credit: restaurant.photo_attribution});
  const textStyle = [styles.text, light && styles.light, style];

  if (
    restaurant.source === 'google_live' &&
    restaurant.google_photo_authors?.length
  ) {
    return (
      <View>
        {restaurant.google_photo_authors.map((author, index) => {
          const authorCredit = t('Photo: {credit}', {
            credit: author.display_name,
          });
          if (!author.uri?.startsWith('https://')) {
            return (
              <Text key={index} style={textStyle}>
                {authorCredit}
              </Text>
            );
          }
          return (
            <TouchableOpacity
              key={index}
              accessibilityRole="link"
              accessibilityLabel={t('{credit}. Open photo source', {
                credit: authorCredit,
              })}
              onPress={() => Linking.openURL(author.uri!)}>
              <Text style={textStyle}>{authorCredit}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }

  if (!sourceUrl) {
    return <Text style={textStyle}>{credit}</Text>;
  }

  return (
    <TouchableOpacity
      accessibilityRole="link"
      accessibilityLabel={t('{credit}. Open photo source', {credit})}
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
