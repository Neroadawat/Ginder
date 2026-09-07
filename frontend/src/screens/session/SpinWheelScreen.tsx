/**
 * Spin Wheel Screen — Animated wheel for tie-breaking or no-match scenarios.
 * The wheel spins automatically and shows the result in real-time to all users.
 */

import React, {useEffect, useState} from 'react';
import {View, Text, StyleSheet, Animated} from 'react-native';
import {useRoute, useNavigation, RouteProp} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';

import SpinWheel from '@/components/SpinWheel';
import {useSessionWebSocket} from '@/hooks/useWebSocket';
import {SessionStackParamList} from '@/navigation/types';

type RouteProps = RouteProp<SessionStackParamList, 'SpinWheel'>;
type NavigationProp = NativeStackNavigationProp<SessionStackParamList, 'SpinWheel'>;

const SpinWheelScreen = () => {
  const route = useRoute<RouteProps>();
  const navigation = useNavigation<NavigationProp>();
  const sessionId = route.params.sessionId;
  const {lastEvent} = useSessionWebSocket(sessionId);
  const [winner, setWinner] = useState<string | null>(null);

  useEffect(() => {
    if (lastEvent?.event === 'result') {
      // After spin completes, show result briefly then navigate
      setWinner(lastEvent.data.restaurant_name);
      setTimeout(() => {
        navigation.replace('SessionResult', {sessionId});
      }, 3000);
    }
  }, [lastEvent, navigation, sessionId]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🎡 Spin the Wheel!</Text>
      <Text style={styles.subtitle}>
        {winner ? `Winner: ${winner}!` : 'Deciding your restaurant...'}
      </Text>

      <View style={styles.wheelContainer}>
        <SpinWheel />
      </View>
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
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 40,
  },
  wheelContainer: {
    width: 300,
    height: 300,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default SpinWheelScreen;
