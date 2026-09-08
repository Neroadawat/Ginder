/**
 * Filter Settings — category, price, rating, opening hours and radius.
 *
 * The same filter set applies to Solo Mode and to party sessions
 * (requirement 5.5).
 */

import React from 'react';
import {ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';

import {useFilterStore} from '@/stores/filterStore';
import {useCategories} from '@/hooks/useRestaurants';
import {
  PRICE_LEVELS,
  RADIUS_OPTIONS_KM,
  RATING_OPTIONS,
  formatRadius,
} from '@/constants/filters';

const ALL_LABEL = 'All';

const FilterSettingsScreen = () => {
  const navigation = useNavigation();
  const {data: categories} = useCategories();

  const category = useFilterStore(state => state.category);
  const priceLevel = useFilterStore(state => state.priceLevel);
  const minRating = useFilterStore(state => state.minRating);
  const radiusKm = useFilterStore(state => state.radiusKm);
  const openNow = useFilterStore(state => state.openNow);

  const setCategory = useFilterStore(state => state.setCategory);
  const setPriceLevel = useFilterStore(state => state.setPriceLevel);
  const setMinRating = useFilterStore(state => state.setMinRating);
  const setRadiusKm = useFilterStore(state => state.setRadiusKm);
  const setOpenNow = useFilterStore(state => state.setOpenNow);
  const reset = useFilterStore(state => state.reset);

  // Categories come from the data itself, so the list never offers a category
  // with nothing behind it.
  const categoryOptions = [ALL_LABEL, ...(categories ?? [])];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={reset} accessibilityRole="button">
          <Text style={styles.resetText}>Reset</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Filters</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button">
          <Text style={styles.doneText}>Done</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Open now */}
        <View style={styles.switchRow}>
          <View style={styles.switchLabel}>
            <Text style={styles.sectionTitle}>Open now</Text>
            <Text style={styles.sectionHint}>
              Only show places serving at this moment
            </Text>
          </View>
          <Switch
            value={openNow}
            onValueChange={setOpenNow}
            trackColor={{false: '#DDD', true: '#FF6B6B'}}
            thumbColor="#FFF"
            accessibilityLabel="Only show places open now"
          />
        </View>

        {/* Category */}
        <Text style={styles.sectionTitle}>Category</Text>
        <View style={styles.chipRow}>
          {categoryOptions.map(option => {
            const selected = option === ALL_LABEL ? !category : category === option;
            return (
              <TouchableOpacity
                key={option}
                style={[styles.chip, selected && styles.chipActive]}
                onPress={() => setCategory(option === ALL_LABEL ? null : option)}
                accessibilityRole="button"
                accessibilityState={{selected}}>
                <Text style={[styles.chipText, selected && styles.chipTextActive]}>
                  {option}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Price */}
        <Text style={styles.sectionTitle}>Price Range</Text>
        <View style={styles.chipRow}>
          {PRICE_LEVELS.map(option => {
            const selected = priceLevel === option.value;
            return (
              <TouchableOpacity
                key={option.label}
                style={[styles.chip, selected && styles.chipActive]}
                onPress={() => setPriceLevel(option.value)}
                accessibilityRole="button"
                accessibilityState={{selected}}>
                <Text style={[styles.chipText, selected && styles.chipTextActive]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Rating */}
        <Text style={styles.sectionTitle}>Minimum Rating</Text>
        <View style={styles.chipRow}>
          {RATING_OPTIONS.map(option => {
            const selected = minRating === option.value;
            return (
              <TouchableOpacity
                key={option.label}
                style={[styles.chip, selected && styles.chipActive]}
                onPress={() => setMinRating(option.value)}
                accessibilityRole="button"
                accessibilityState={{selected}}>
                <Text style={[styles.chipText, selected && styles.chipTextActive]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Radius */}
        <Text style={styles.sectionTitle}>Search Radius</Text>
        <View style={styles.chipRow}>
          {RADIUS_OPTIONS_KM.map(option => {
            const selected = radiusKm === option;
            return (
              <TouchableOpacity
                key={option}
                style={[styles.chip, selected && styles.chipActive]}
                onPress={() => setRadiusKm(option)}
                accessibilityRole="button"
                accessibilityState={{selected}}>
                <Text style={[styles.chipText, selected && styles.chipTextActive]}>
                  {formatRadius(option)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  resetText: {
    fontSize: 15,
    color: '#999',
  },
  doneText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF6B6B',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
  },
  switchLabel: {
    flex: 1,
    paddingRight: 16,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#333',
    marginTop: 20,
    marginBottom: 12,
  },
  sectionHint: {
    fontSize: 13,
    color: '#999',
    marginTop: -8,
    marginBottom: 4,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#DDD',
    backgroundColor: '#F9F9F9',
  },
  chipActive: {
    borderColor: '#FF6B6B',
    backgroundColor: '#FFF0F0',
  },
  chipText: {
    fontSize: 14,
    color: '#666',
  },
  chipTextActive: {
    color: '#FF6B6B',
    fontWeight: '600',
  },
});

export default FilterSettingsScreen;
