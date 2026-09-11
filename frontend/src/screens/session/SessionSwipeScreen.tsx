/**
 * Session Swipe Screen — swiping with live group voting.
 *
 * Ends in one of three ways (requirement 9):
 *
 * * everyone likes the same restaurant, which cuts the timer short
 * * everyone finishes their deck
 * * the countdown expires
 *
 * There is no early termination: the session runs on even once a unanimous
 * match has become impossible (requirement 9.1).
 */

import React, {useCallback, useEffect, useRef, useState} from 'react';
import {ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {RouteProp, useNavigation, useRoute} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';

import MatchPopup from '@/components/MatchPopup';
import SessionTimer from '@/components/SessionTimer';
import SwipeCard from '@/components/SwipeCard';
import {useSessionDeck} from '@/hooks/useRestaurants';
import {useReportDeckFinished} from '@/hooks/useSessions';
import {useSwipe, useVoteProgress} from '@/hooks/useVotes';
import {useSessionWebSocket} from '@/hooks/useWebSocket';
import {SessionStackParamList} from '@/navigation/types';
import {ResolutionResponse} from '@/types/api';
import {RestaurantCard} from '@/types/restaurant';
import {COLORS} from '@/constants/theme';

type RouteProps = RouteProp<SessionStackParamList, 'SessionSwipe'>;
type NavigationProp = NativeStackNavigationProp<SessionStackParamList, 'SessionSwipe'>;

const SessionSwipeScreen = () => {
  const route = useRoute<RouteProps>();
  const navigation = useNavigation<NavigationProp>();
  const {sessionId} = route.params;

  const {data: deck, isLoading} = useSessionDeck(sessionId);
  const {data: progress, isLoading: isProgressLoading} = useVoteProgress(sessionId);
  const swipeMutation = useSwipe(sessionId);
  const reportFinished = useReportDeckFinished();
  const {lastEvent} = useSessionWebSocket(sessionId);

  const [matched, setMatched] = useState<RestaurantCard | null>(null);
  const [isWaiting, setIsWaiting] = useState(false);
  const hasReportedEmpty = useRef(false);

  // Guards against double-navigating when a websocket event and a REST reply
  // both report the session ending.
  const hasNavigated = useRef(false);

  const goToResolution = useCallback(
    (resolution: ResolutionResponse) => {
      if (hasNavigated.current) {
        return;
      }
      hasNavigated.current = true;

      const usedWheel = resolution.wheel_candidate_ids.length > 0;

      if (usedWheel && resolution.restaurant_id) {
        navigation.replace('SpinWheel', {
          sessionId,
          candidateIds: resolution.wheel_candidate_ids,
          winnerId: resolution.restaurant_id,
          winnerName: resolution.restaurant_name,
        });
      } else {
        navigation.replace('SessionResult', {sessionId});
      }
    },
    [navigation, sessionId],
  );

  const goToResult = useCallback(() => {
    if (hasNavigated.current) {
      return;
    }
    hasNavigated.current = true;
    navigation.replace('SessionResult', {sessionId});
  }, [navigation, sessionId]);

  // Server-driven session events.
  useEffect(() => {
    if (!lastEvent) {
      return;
    }

    if (lastEvent.event === 'unanimous_match') {
      const restaurant = deck?.restaurants.find(
        r => r.id === lastEvent.data.restaurant_id,
      );
      if (restaurant) {
        setMatched(restaurant);
      } else {
        goToResult();
      }
      return;
    }

    if (lastEvent.event === 'spin_wheel') {
      goToResolution(lastEvent.data as unknown as ResolutionResponse);
      return;
    }

    if (lastEvent.event === 'result' || lastEvent.event === 'timer_end') {
      goToResult();
    }
  }, [lastEvent, deck, goToResolution, goToResult]);

  const handleSwipe = useCallback(
    (restaurant: RestaurantCard, liked: boolean) => {
      return new Promise<boolean>(resolve => {
        swipeMutation.mutate(
          {restaurant_id: restaurant.id, liked},
          {
            onSuccess: response => {
              if (response.unanimous_match && response.matched_restaurant_id) {
                setMatched(restaurant);
              }
              resolve(true);
            },
            onError: swipeError => {
              Alert.alert('Swipe not saved', swipeError.message);
              resolve(false);
            },
          },
        );
      });
    },
    [swipeMutation],
  );

  // Deck exhausted: report it and wait for the others (requirement 12.1).
  const handleDeckEmpty = useCallback(() => {
    if (hasReportedEmpty.current) {
      return;
    }
    hasReportedEmpty.current = true;
    setIsWaiting(true);

    reportFinished.mutate(sessionId, {
      onSuccess: response => {
        if (response.session_finished && response.resolution) {
          goToResolution(response.resolution);
        }
      },
    });
  }, [goToResolution, reportFinished, sessionId]);

  const retryFinish = () => {
    hasReportedEmpty.current = false;
    reportFinished.reset();
    handleDeckEmpty();
  };

  const completedIds = new Set(progress?.restaurant_ids ?? []);
  const remainingRestaurants = deck?.restaurants.filter(
    restaurant => !completedIds.has(restaurant.id),
  ) ?? [];
  const remainingCount = remainingRestaurants.length;

  useEffect(() => {
    if (!isLoading && !isProgressLoading && deck && remainingCount === 0) {
      handleDeckEmpty();
    }
  }, [deck, handleDeckEmpty, isLoading, isProgressLoading, remainingCount]);

  const handleMatchDismiss = () => {
    setMatched(null);
    goToResult();
  };

  if (isLoading || isProgressLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#FF6B6B" />
        <Text style={styles.loadingText}>Loading restaurants...</Text>
      </View>
    );
  }

  const hasCards = remainingCount > 0;

  return (
    <View style={styles.container}>
      <SessionTimer sessionId={sessionId} initialEndsAt={route.params.endsAt} />

      <View style={styles.cardContainer}>
        {hasCards && !isWaiting ? (
          <SwipeCard
            restaurants={remainingRestaurants}
            onSwipe={handleSwipe}
            onDeckEmpty={handleDeckEmpty}
          />
        ) : (
          <View style={styles.waiting}>
            <Text style={styles.waitingEmoji}>⏳</Text>
            <Text style={styles.waitingTitle}>
              {hasCards ? "That's everything!" : 'No restaurants found'}
            </Text>
            <Text style={styles.waitingText}>
              {hasCards
                ? 'Waiting for the others to finish'
                : 'Waiting for the session to wrap up'}
            </Text>
            {reportFinished.isError && (
              <TouchableOpacity style={styles.retryButton} onPress={retryFinish}>
                <Text style={styles.retryText}>Retry connection</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {matched && (
        <MatchPopup restaurant={matched} onDismiss={handleMatchDismiss} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
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
  waiting: {
    alignItems: 'center',
    padding: 32,
  },
  waitingEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  waitingTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 6,
  },
  waitingText: {
    fontSize: 15,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  retryButton: {marginTop: 20, borderRadius: 14, backgroundColor: COLORS.accent, paddingHorizontal: 20, paddingVertical: 11},
  retryText: {color: '#FFF', fontSize: 13, fontWeight: '800'},
});

export default SessionSwipeScreen;
