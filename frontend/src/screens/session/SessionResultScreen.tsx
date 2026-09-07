/**
 * Session Result Screen — Shows the winning restaurant after session ends.
 */

import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet, Linking, ActivityIndicator} from 'react-native';
import {useRoute, useNavigation, RouteProp} from '@react-navigation/native';

import {useSession} from '@/hooks/useSessions';

type RouteProps = RouteProp<{SessionResult: {sessionId: string}}, 'SessionResult'>;

const RESOLUTION_MESSAGES: Record<string, string> = {
  unanimous: '🎉 Everyone agreed!',
  majority: '🗳️ Most votes won',
  spin_wheel_tie: '🎡 Decided by spin wheel',
  spin_wheel_no_match: '🎡 Random pick from the wheel',
  early_termination: '⏱️ Session ended early',
};

const SessionResultScreen = () => {
  const route = useRoute<RouteProps>();
  const navigation = useNavigation();

  // TODO: Fetch actual match result via dedicated hook
  // For now, placeholder UI
  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>🎊</Text>
      <Text style={styles.title}>Session Complete!</Text>
      <Text style={styles.subtitle}>Here's your result</Text>

      <View style={styles.resultCard}>
        <Text style={styles.restaurantName}>Restaurant Name</Text>
        <Text style={styles.category}>Category • 1.2 km</Text>
        <Text style={styles.resolution}>🗳️ Majority Vote</Text>
      </View>

      <TouchableOpacity
        style={styles.mapsButton}
        onPress={() => {
          // TODO: Open Google Maps with actual restaurant URL
        }}
        accessibilityRole="button"
        accessibilityLabel="Navigate to restaurant">
        <Text style={styles.mapsText}>📍 Open in Google Maps</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.homeButton}
        onPress={() => navigation.getParent()?.goBack()}
        accessibilityRole="button">
        <Text style={styles.homeText}>Back to Home</Text>
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
    fontSize: 80,
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 32,
  },
  resultCard: {
    backgroundColor: '#FFF0F0',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FF6B6B',
    marginBottom: 24,
  },
  restaurantName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  category: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  resolution: {
    fontSize: 14,
    color: '#FF6B6B',
    fontWeight: '500',
  },
  mapsButton: {
    backgroundColor: '#FF6B6B',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  mapsText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  homeButton: {
    padding: 12,
  },
  homeText: {
    color: '#999',
    fontSize: 16,
  },
});

export default SessionResultScreen;
