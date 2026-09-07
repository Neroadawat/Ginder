/**
 * Filter Settings Screen — Set category, price, rating, radius for solo/session.
 */

import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet, ScrollView} from 'react-native';
import {useNavigation} from '@react-navigation/native';

import {useFilterStore} from '@/stores/filterStore';
import {PRICE_LEVELS, RADIUS_OPTIONS_KM, formatRadius} from '@/constants/filters';

const CATEGORIES = ['All', 'Thai', 'Japanese', 'Korean', 'Fast Food', 'Cafe', 'Dessert', 'Italian', 'Chinese'];

const FilterSettingsScreen = () => {
  const navigation = useNavigation();
  const {category, priceLevel, radiusKm, setCategory, setPriceLevel, setRadiusKm} =
    useFilterStore();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Filters</Text>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          accessibilityRole="button">
          <Text style={styles.doneText}>Done</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Category */}
        <Text style={styles.sectionTitle}>Category</Text>
        <View style={styles.chipRow}>
          {CATEGORIES.map(cat => (
            <TouchableOpacity
              key={cat}
              style={[
                styles.chip,
                (cat === 'All' ? !category : category === cat) && styles.chipActive,
              ]}
              onPress={() => setCategory(cat === 'All' ? null : cat)}
              accessibilityRole="button"
              accessibilityState={{selected: cat === 'All' ? !category : category === cat}}>
              <Text
                style={[
                  styles.chipText,
                  (cat === 'All' ? !category : category === cat) && styles.chipTextActive,
                ]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Price Level */}
        <Text style={styles.sectionTitle}>Price Range</Text>
        <View style={styles.chipRow}>
          {PRICE_LEVELS.map(p => (
            <TouchableOpacity
              key={p.label}
              style={[styles.chip, priceLevel === p.value && styles.chipActive]}
              onPress={() => setPriceLevel(p.value)}
              accessibilityRole="button"
              accessibilityState={{selected: priceLevel === p.value}}>
              <Text
                style={[
                  styles.chipText,
                  priceLevel === p.value && styles.chipTextActive,
                ]}>
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Radius */}
        <Text style={styles.sectionTitle}>Search Radius</Text>
        <View style={styles.chipRow}>
          {RADIUS_OPTIONS_KM.map(r => (
            <TouchableOpacity
              key={r}
              style={[styles.chip, radiusKm === r && styles.chipActive]}
              onPress={() => setRadiusKm(r)}
              accessibilityRole="button"
              accessibilityState={{selected: radiusKm === r}}>
              <Text
                style={[
                  styles.chipText,
                  radiusKm === r && styles.chipTextActive,
                ]}>
                {formatRadius(r)}
              </Text>
            </TouchableOpacity>
          ))}
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
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
  },
  doneText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF6B6B',
  },
  content: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 20,
    marginBottom: 12,
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
