/**
 * Session Swipe Screen — Swipe restaurants with real-time group voting.
 */

import React, {useCallback, useEffect, useState} from 'react';
import {View, Text, StyleSheet, ActivityIndicator} from 'react-native';
import {useRoute, useNavigation, RouteProp} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';

import SwipeCard from '@/components/SwipeCard';
import SessionTimer from '@/components/SessionTimer';
import MatchPopup from '@/components/MatchPopup';
import {useSessionDeck} from '@/hooks/useRestaurants';
import {useSwipe} from '@/hooks/useVotes';
import {useSessionWebSocket} from '@/hooks/useWebSocket';
import {SessionStackParamList} from '@/navigation/types';
import {RestaurantCard} from '@/types/restaurant';

type RouteProps = RouteProp<SessionStackParamList, 'SessionSwipe'>;
type NavigationProp = NativeStackNavigationProp<SessionStackParamList, 'SessionSwipe'>;

const SessionSwipeScreen = () => {
  const route = useRoute<RouteProps>();
  const navigation = useNavigation<NavigationProp>();
  const sessionId = route.params.sessionId;

  const {data: deck, isLoading} = useSessionDeck(sessionId);
  const swipeMutation = useSwipe(sessionId);
  const [showMatch, setShowMatch] = useState(false);
  const [matchedRestaurant, setMatchedRestaurant] = useState<RestaurantCard | null>(null);

  // WebSocket connection for real-time events
  const {lastEvent} = useSessionWebSocket(sessionId);

  useEffect(() => {
    if (lastEvent?.event === 'unanimous_match') {
      const matched = deck?.restaurants.find(
        r => r.id === lastEvent.data.restaurant_id,
      );
      if (matched) {
        setMatchedRestaurant(matched);
        setShowMatch(true);
      }
    }
    if (lastEvent?.event === 'timer_end' || lastEvent?.event === 'early_termination') {
      navigation.replace('SessionResult', {sessionId});
    }
    if (lastEvent?.event === 'result' && lastEvent.data.resolution_type?.includes('spin_wheel')) {
      navigation.replace('SpinWheel', {sessionId});
    }
  }, [lastEvent, deck, navigation, sessionId]);

  const handleSwipe = useCallback(
    (restaurant: RestaurantCard, liked: boolean) => {
      swipeMutation.mutate({restaurant_id: restaurant.id, liked});
    },
    [swipeMutation],
  );

  const handleDeckEmpty = useCallback(() => {
    // User finished swiping — wait for others or timer
  }, []);

  const handleMatchDismiss = () => {
    setShowMatch(false);
    navigation.replace('SessionResult', {sessionId});
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#FF6B6B" />
        <Text style={styles.loadingText}>Loading restaurants...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SessionTimer sessionId={sessionId} />

      <View style={styles.cardContainer}>
        {deck && deck.restaurants.length > 0 ? (
          <SwipeCard
            restaurants={deck.restaurants}
            onSwipe={handleSwipe}
            onDeckEmpty={handleDeckEmpty}
          />
        ) : (
          <View style={styles.waiting}>
            <Text style={styles.waitingEmoji}>⏳</Text>
            <Text style={styles.waitingText}>Waiting for results...</Text>
          </View>
        )}
      </View>

      {showMatch && matchedRestaurant && (
        <MatchPopup restaurant={matchedRestaurant} onDismiss={handleMatchDismiss} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
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
  waiting: {
    alignItems: 'center',
  },
  waitingEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  waitingText: {
    fontSize: 18,
    color: '#666',
  },
});

export default SessionSwipeScreen;
