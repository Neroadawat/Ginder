/**
 * Solo Swipe Screen — Default app screen. Swipe restaurants solo.
 */

import React, {useCallback} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';

import SwipeCard from '@/components/SwipeCard';
import {useSoloDeck} from '@/hooks/useRestaurants';
import {useSoloLike} from '@/hooks/useVotes';
import {useFilterStore} from '@/stores/filterStore';
import {HomeStackParamList, RootStackParamList} from '@/navigation/types';
import {RestaurantCard} from '@/types/restaurant';
import AppIcon from '@/components/AppIcon';
import {COLORS} from '@/constants/theme';

type NavigationProp = NativeStackNavigationProp<
  HomeStackParamList,
  'SoloSwipe'
>;

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

  const openPartyMenu = () => {
    const rootNavigation = navigation.getParent()?.getParent() as
      | NativeStackNavigationProp<RootStackParamList>
      | undefined;
    Alert.alert('Play with friends', 'Create a new lobby or join with an invite code.', [
      {text: 'Cancel', style: 'cancel'},
      {text: 'Join', onPress: () => rootNavigation?.navigate('Session', {screen: 'JoinSession', params: {}})},
      {text: 'Create', onPress: () => rootNavigation?.navigate('Session', {screen: 'CreateSession'})},
    ]);
  };

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
      <View style={styles.topControls}>
        <TouchableOpacity
          onPress={() => navigation.navigate('FilterSettings')}
          style={styles.circleButton}
          accessibilityRole="button"
          accessibilityLabel="Open filter settings">
          <AppIcon name="filter" />
        </TouchableOpacity>
        <View style={styles.modePill}>
          <Text style={styles.modeText}>Solo</Text>
        </View>
        <View style={styles.deckPill}>
          <Text style={styles.deckText}>{deck?.total ?? 0} places</Text>
        </View>
        <TouchableOpacity
          style={styles.partyButton}
          onPress={openPartyMenu}
          accessibilityRole="button"
          accessibilityLabel="Play with friends">
          <Text style={styles.partyText}>+</Text>
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
    backgroundColor: COLORS.background,
  },
  topControls: {
    position: 'absolute',
    top: 42,
    left: 14,
    right: 14,
    zIndex: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  circleButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(5,5,5,0.82)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modePill: {
    backgroundColor: '#101010',
    borderRadius: 18,
    paddingHorizontal: 15,
    paddingVertical: 9,
  },
  modeText: {color: '#FFF', fontSize: 13, fontWeight: '700'},
  deckPill: {
    marginLeft: 'auto',
    backgroundColor: 'rgba(5,5,5,0.72)',
    borderRadius: 18,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  deckText: {color: '#DDD', fontSize: 12, fontWeight: '600'},
  partyButton: {width: 42, height: 42, borderRadius: 21, backgroundColor: '#151313', borderWidth: 1, borderColor: '#3A3535', alignItems: 'center', justifyContent: 'center'},
  partyText: {color: '#FFF', fontSize: 28, lineHeight: 30, fontWeight: '300'},
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text,
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
    backgroundColor: COLORS.background,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: COLORS.textMuted,
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
    color: COLORS.text,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: COLORS.accent,
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
