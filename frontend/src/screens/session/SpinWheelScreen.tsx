/**
 * Spin Wheel Screen — tie-breaker and no-match draw.
 *
 * The server has already picked the winner; this screen replays that decision
 * so every participant sees the same wheel land on the same slice at the same
 * time (requirement 9.4, 9.6).
 */

import React, {useEffect, useMemo} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {RouteProp, useNavigation, useRoute} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';

import SpinWheel from '@/components/SpinWheel';
import {useSessionDeck} from '@/hooks/useRestaurants';
import {SessionStackParamList} from '@/navigation/types';

type RouteProps = RouteProp<SessionStackParamList, 'SpinWheel'>;
type NavigationProp = NativeStackNavigationProp<SessionStackParamList, 'SpinWheel'>;

/** Time the result stays on screen before moving to the summary. */
const RESULT_LINGER_MS = 3500;

const SpinWheelScreen = () => {
  const route = useRoute<RouteProps>();
  const navigation = useNavigation<NavigationProp>();
  const {sessionId, candidateIds, winnerId, winnerName} = route.params;

  // The deck already holds every restaurant in this session, so candidate names
  // can be resolved from it without another request.
  const {data: deck} = useSessionDeck(sessionId);

  const candidateNames = useMemo(() => {
    if (!deck) {
      return candidateIds.map((_, index) => `Option ${index + 1}`);
    }
    const byId = new Map(deck.restaurants.map(r => [r.id, r.name]));
    return candidateIds.map((id, index) => byId.get(id) ?? `Option ${index + 1}`);
  }, [candidateIds, deck]);

  const winnerIndex = useMemo(() => {
    const index = candidateIds.indexOf(winnerId);
    return index >= 0 ? index : undefined;
  }, [candidateIds, winnerId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      navigation.replace('SessionResult', {sessionId});
    }, RESULT_LINGER_MS);

    return () => clearTimeout(timer);
  }, [navigation, sessionId]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🎡 Spinning</Text>
      <Text style={styles.subtitle}>
        {candidateIds.length > 1
          ? `Breaking a tie between ${candidateIds.length} restaurants`
          : 'Picking your restaurant'}
      </Text>

      <View style={styles.wheelContainer}>
        <SpinWheel candidateNames={candidateNames} winnerIndex={winnerIndex} />
      </View>

      <Text style={styles.winner} accessibilityLiveRegion="polite">
        {winnerName}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: '#333',
  },
  subtitle: {
    fontSize: 15,
    color: '#666',
    marginTop: 6,
    marginBottom: 32,
    textAlign: 'center',
  },
  wheelContainer: {
    width: '100%',
    alignItems: 'center',
  },
  winner: {
    marginTop: 28,
    fontSize: 20,
    fontWeight: '700',
    color: '#FF6B6B',
    textAlign: 'center',
  },
});

export default SpinWheelScreen;
