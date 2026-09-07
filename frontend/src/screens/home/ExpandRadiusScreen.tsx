/**
 * Expand Radius Screen — shown when the deck runs out.
 *
 * Requirement 2.5: instead of reshuffling the same restaurants, let the user
 * widen the search radius to pull in new ones.
 */

import React from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';

import {useFilterStore} from '@/stores/filterStore';
import {
  MAX_RADIUS_KM,
  formatRadius,
  getWiderRadiusOptions,
} from '@/constants/filters';

const ExpandRadiusScreen = () => {
  const navigation = useNavigation();
  const radiusKm = useFilterStore(state => state.radiusKm);
  const setRadiusKm = useFilterStore(state => state.setRadiusKm);

  const widerOptions = getWiderRadiusOptions(radiusKm);
  const atMaxRadius = widerOptions.length === 0;

  const handleExpand = (newRadius: number) => {
    setRadiusKm(newRadius);
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>🍽️</Text>
      <Text style={styles.title}>You've seen every restaurant</Text>

      {atMaxRadius ? (
        <Text style={styles.subtitle}>
          You're already searching the full {formatRadius(MAX_RADIUS_KM)} area.
          Try changing your filters to see more places.
        </Text>
      ) : (
        <Text style={styles.subtitle}>
          Currently searching within {formatRadius(radiusKm)}. Widen the radius
          to find more options.
        </Text>
      )}

      <View style={styles.options}>
        {widerOptions.map(r => (
          <TouchableOpacity
            key={r}
            style={styles.optionButton}
            onPress={() => handleExpand(r)}
            accessibilityRole="button"
            accessibilityLabel={`Search within ${formatRadius(r)}`}>
            <Text style={styles.optionText}>Search within {formatRadius(r)}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={styles.cancelButton}
        onPress={() => navigation.goBack()}
        accessibilityRole="button">
        <Text style={styles.cancelText}>Go Back</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emoji: {
    fontSize: 64,
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#333',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  options: {
    width: '100%',
    gap: 12,
  },
  optionButton: {
    backgroundColor: '#FF6B6B',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  optionText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    marginTop: 20,
    padding: 12,
  },
  cancelText: {
    color: '#999',
    fontSize: 16,
  },
});

export default ExpandRadiusScreen;
