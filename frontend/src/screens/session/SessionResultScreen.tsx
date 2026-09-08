/**
 * Session Result Screen — the winning restaurant.
 *
 * Requirement 13.1: offers a Location button that opens Google Maps navigation.
 */

import React from 'react';
import {
  ActivityIndicator,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {RouteProp, useNavigation, useRoute} from '@react-navigation/native';

import {useSessionResult} from '@/hooks/useSessions';
import {useSessionStore} from '@/stores/sessionStore';
import {RESOLUTION_LABELS} from '@/constants/resolution';
import {SessionStackParamList} from '@/navigation/types';
import {COLORS} from '@/constants/theme';

type RouteProps = RouteProp<SessionStackParamList, 'SessionResult'>;

const SessionResultScreen = () => {
  const route = useRoute<RouteProps>();
  const navigation = useNavigation();
  const clearSession = useSessionStore(state => state.clearSession);

  const {
    data: result,
    isLoading,
    isError,
  } = useSessionResult(route.params.sessionId);

  const handleBackHome = () => {
    // The session is over, so the Likes tab should switch back to solo history.
    clearSession();
    navigation.getParent()?.goBack();
  };

  const openMaps = () => {
    if (result?.google_maps_url) {
      Linking.openURL(result.google_maps_url);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator
          size="large"
          color="#FF6B6B"
          accessibilityLabel="Loading result"
        />
      </View>
    );
  }

  if (isError || !result) {
    return (
      <View style={styles.container}>
        <Text style={styles.emoji}>😕</Text>
        <Text style={styles.title}>No result yet</Text>
        <Text style={styles.subtitle}>
          This session has not finished, or the result could not be loaded.
        </Text>
        <TouchableOpacity
          style={styles.homeButton}
          onPress={handleBackHome}
          accessibilityRole="button">
          <Text style={styles.homeText}>Back to Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const hasWinner = result.restaurant_id !== null;

  return (
    <View style={styles.container}>
      <Text style={styles.kicker}>{hasWinner ? 'It’s a' : 'Session'}</Text>
      <Text style={styles.title}>{hasWinner ? 'Match' : 'Complete'}</Text>
      <Text style={styles.subtitle}>
        {RESOLUTION_LABELS[result.resolution_type] ?? result.resolution_type}
      </Text>

      <View style={styles.resultCard}>
        <Text style={styles.restaurantName}>{result.restaurant_name}</Text>
      </View>

      {result.google_maps_url && (
        <TouchableOpacity
          style={styles.mapsButton}
          onPress={openMaps}
          accessibilityRole="button"
          accessibilityLabel={`Navigate to ${result.restaurant_name}`}>
          <Text style={styles.mapsText}>📍 Open in Google Maps</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={styles.homeButton}
        onPress={handleBackHome}
        accessibilityRole="button">
        <Text style={styles.homeText}>Back to Home</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.accentDark,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emoji: {fontSize: 64},
  kicker: {
    fontSize: 58,
    color: '#FF1717',
    fontWeight: '900',
  },
  title: {
    fontSize: 62,
    fontStyle: 'italic',
    fontWeight: '900',
    color: '#FF1717',
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#FFF',
    marginBottom: 28,
    textAlign: 'center',
  },
  resultCard: {
    backgroundColor: 'rgba(0,0,0,0.18)',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
    marginBottom: 24,
  },
  restaurantName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFF',
    textAlign: 'center',
  },
  mapsButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#FFF',
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
    color: '#FFF',
    fontSize: 16,
  },
});

export default SessionResultScreen;
