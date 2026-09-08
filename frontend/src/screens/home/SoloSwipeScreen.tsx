/**
 * Solo Swipe Screen — Default app screen. Swipe restaurants solo.
 */

import React, {useCallback} from 'react';
import {View, Text, TouchableOpacity, StyleSheet, ActivityIndicator} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';

import SwipeCard from '@/components/SwipeCard';
import {useSoloDeck} from '@/hooks/useRestaurants';
import {useSoloLike} from '@/hooks/useVotes';
import {useFilterStore} from '@/stores/filterStore';
import {HomeStackParamList} from '@/navigation/types';
import {RestaurantCard} from '@/types/restaurant';

type NavigationProp = NativeStackNavigationProp<HomeStackParamList, 'SoloSwipe'>;

const SoloSwipeScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const category = useFilterStore(state => state.category);
  const priceLevel = useFilterStore(state => state.priceLevel);
  const minRating = useFilterStore(state => state.minRating);
  const radiusKm = useFilterStore(state => state.radiusKm);
  const openNow = useFilterStore(state => state.openNow);

  const {
    data: deck,
    isLoading,
    refetch,
  } = useSoloDeck({category, priceLevel, minRating, radiusKm, openNow});
  const soloLikeMutation = useSoloLike();

  const handleSwipe = useCallback(
    (restaurant: RestaurantCard, liked: boolean) => {
      if (liked) {
        soloLikeMutation.mutate({restaurant_id: restaurant.id});
      }
    },
    [soloLikeMutation],
  );

  const handleDeckEmpty = useCallback(() => {
    navigation.navigate('ExpandRadius');
  }, [navigation]);

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#FF6B6B" />
        <Text style={styles.loadingText}>Finding restaurants...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🍽️ Ginder</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('FilterSettings')}
          style={styles.filterButton}
          accessibilityRole="button"
          accessibilityLabel="Open filter settings">
          <Text style={styles.filterIcon}>⚙️</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.cardContainer}>
        {deck && deck.restaurants.length > 0 ? (
          <SwipeCard
            restaurants={deck.restaurants}
            onSwipe={handleSwipe}
            onDeckEmpty={handleDeckEmpty}
          />
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🔍</Text>
            <Text style={styles.emptyTitle}>No restaurants found</Text>
            <Text style={styles.emptySubtitle}>
              Try expanding your search radius or changing filters
            </Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => refetch()}
              accessibilityRole="button">
              <Text style={styles.retryText}>Refresh</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: '#FFF',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FF6B6B',
  },
  filterButton: {
    padding: 8,
  },
  filterIcon: {
    fontSize: 24,
  },
  cardContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  emptyState: {
    alignItems: 'center',
    padding: 32,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#FF6B6B',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 32,
  },
  retryText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default SoloSwipeScreen;
