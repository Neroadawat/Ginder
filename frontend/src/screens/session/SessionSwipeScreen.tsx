import {t, useTranslation} from '@/i18n';
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
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {RouteProp, useNavigation, useRoute} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';

import MatchPopup from '@/components/MatchPopup';
import SessionTimer from '@/components/SessionTimer';
import SwipeCard from '@/components/SwipeCard';
import {useSessionDeck} from '@/hooks/useRestaurants';
import {
  useLiveSessionResult,
  useReportDeckFinished,
  useSession,
} from '@/hooks/useSessions';
import {useSwipe, useVoteProgress} from '@/hooks/useVotes';
import {useSessionWebSocket} from '@/hooks/useWebSocket';
import {useSessionBackGuard} from '@/hooks/useSessionBackGuard';
import {SessionStackParamList} from '@/navigation/types';
import {ResolutionResponse} from '@/types/api';
import {RestaurantCard} from '@/types/restaurant';
import {COLORS} from '@/constants/theme';

type RouteProps = RouteProp<SessionStackParamList, 'SessionSwipe'>;
type NavigationProp = NativeStackNavigationProp<
  SessionStackParamList,
  'SessionSwipe'
>;

const SessionSwipeScreen = () => {
  useTranslation();
  const route = useRoute<RouteProps>();
  const navigation = useNavigation<NavigationProp>();
  const {sessionId} = route.params;
  useSessionBackGuard();

  const {data: deck, isLoading} = useSessionDeck(sessionId);
  const {data: progress, isLoading: isProgressLoading} =
    useVoteProgress(sessionId);
  const swipeMutation = useSwipe(sessionId);
  const reportFinished = useReportDeckFinished();

  const [matched, setMatched] = useState<RestaurantCard | null>(null);
  const [isWaiting, setIsWaiting] = useState(false);
  const [hasExpired, setHasExpired] = useState(false);
  const {data: lobby} = useSession(sessionId);
  const isResolving =
    !!matched || hasExpired || lobby?.session.status === 'finished';
  const resultQuery = useLiveSessionResult(sessionId, isResolving && !matched);
  const hasReportedEmpty = useRef(false);

  // Guards against double-navigating when a websocket event and a REST reply
  // both report the session ending.
  const hasNavigated = useRef(false);

  const goToResolution = useCallback(
    (resolution: ResolutionResponse) => {
      if (hasNavigated.current) {
        return;
      }
      if (resolution.resolution_type === 'unanimous') {
        if (!deck) {
          setHasExpired(true);
          return;
        }
        const restaurant = deck?.restaurants.find(
          item => item.id === resolution.restaurant_id,
        );
        if (restaurant) {
          setMatched(restaurant);
          return;
        }
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
    [deck, navigation, sessionId],
  );

  const goToResult = useCallback(() => {
    if (hasNavigated.current) {
      return;
    }
    hasNavigated.current = true;
    navigation.replace('SessionResult', {sessionId});
  }, [navigation, sessionId]);

  useEffect(() => {
    if (resultQuery.data && !matched) {
      goToResolution(resultQuery.data);
    }
  }, [resultQuery.data, matched, goToResolution]);

  const handleTimerExpired = useCallback(() => {
    setHasExpired(true);
  }, []);

  // Process every terminal message, including consecutive match/result events.
  useSessionWebSocket(sessionId, event => {
    if (event.event === 'spin_wheel' || event.event === 'result') {
      goToResolution(event.data as unknown as ResolutionResponse);
      return;
    }
    if (event.event === 'unanimous_match' || event.event === 'timer_end') {
      // The canonical result (with resolution type) drives presentation.
      setHasExpired(true);
    }
  });

  const handleSwipe = useCallback(
    (restaurant: RestaurantCard, liked: boolean) => {
      if (isResolving) {
        return Promise.resolve(false);
      }
      return new Promise<boolean>(resolve => {
        swipeMutation.mutate(
          {restaurant_id: restaurant.id, liked},
          {
            onSuccess: response => {
              if (response.unanimous_match && response.matched_restaurant_id) {
                setHasExpired(true);
              }
              resolve(true);
            },
            onError: swipeError => {
              Alert.alert(t('บันทึกการปัดไม่สำเร็จ'), t(swipeError.message));
              resolve(false);
            },
          },
        );
      });
    },
    [swipeMutation, isResolving],
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
  const remainingRestaurants =
    deck?.restaurants.filter(restaurant => !completedIds.has(restaurant.id)) ??
    [];
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
        <Text style={styles.loadingText}>{t('กำลังโหลดร้าน...')}</Text>
      </View>
    );
  }

  const hasCards = remainingCount > 0;

  return (
    <View style={styles.container}>
      <SessionTimer
        sessionId={sessionId}
        initialEndsAt={route.params.endsAt}
        onExpire={handleTimerExpired}
      />

      <View style={styles.cardContainer}>
        {isResolving ? (
          <View style={styles.waiting}>
            <ActivityIndicator size="large" color={COLORS.accent} />
            <Text style={styles.waitingTitle}>{t('กำลังสรุปผล')}</Text>
            <Text style={styles.waitingText}>
              {resultQuery.isError
                ? t('ยังรับผลไม่ได้ กำลังเชื่อมต่ออีกครั้ง...')
                : t('หมดเวลาแล้ว กำลังรับผลจากห้อง')}
            </Text>
            {resultQuery.isError && (
              <TouchableOpacity
                style={styles.retryButton}
                onPress={() => resultQuery.refetch()}>
                <Text style={styles.retryText}>{t('ลองอีกครั้ง')}</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : hasCards && !isWaiting ? (
          <SwipeCard
            restaurants={remainingRestaurants}
            onSwipe={handleSwipe}
            onDeckEmpty={handleDeckEmpty}
          />
        ) : (
          <View style={styles.waiting}>
            <Text style={styles.waitingTitle}>
              {hasCards ? t('ดูครบแล้ว!') : t('ไม่พบร้านอาหาร')}
            </Text>
            <Text style={styles.waitingText}>
              {hasCards ? t('กำลังรอเพื่อนปัดให้ครบ') : t('กำลังรอผลของห้อง')}
            </Text>
            {reportFinished.isError && (
              <TouchableOpacity
                style={styles.retryButton}
                onPress={retryFinish}>
                <Text style={styles.retryText}>{t('เชื่อมต่ออีกครั้ง')}</Text>
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
  retryButton: {
    marginTop: 20,
    borderRadius: 14,
    backgroundColor: COLORS.accent,
    paddingHorizontal: 20,
    paddingVertical: 11,
  },
  retryText: {color: '#FFF', fontSize: 13, fontWeight: '800'},
});

export default SessionSwipeScreen;
