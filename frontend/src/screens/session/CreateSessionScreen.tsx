/**
 * Create Session Screen — Host creates a party session with radius and timer settings.
 */

import React, {useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';

import {useCreateSession} from '@/hooks/useSessions';
import {useLocationStore} from '@/stores/locationStore';
import {SessionStackParamList} from '@/navigation/types';
import {
  DEFAULT_RADIUS_KM,
  RADIUS_OPTIONS_KM,
  SESSION_DURATION_OPTIONS,
  formatRadius,
} from '@/constants/filters';

type NavigationProp = NativeStackNavigationProp<SessionStackParamList, 'CreateSession'>;

const CreateSessionScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const latitude = useLocationStore(state => state.latitude);
  const longitude = useLocationStore(state => state.longitude);
  const createMutation = useCreateSession();

  const [radiusKm, setRadiusKm] = useState<number>(DEFAULT_RADIUS_KM);
  const [durationSeconds, setDurationSeconds] = useState(300);
  const [category, setCategory] = useState<string | null>(null);

  const handleCreate = () => {
    if (latitude === null || longitude === null) {
      return; // Guarded by the permission gate, but stay defensive.
    }

    createMutation.mutate(
      {
        latitude,
        longitude,
        radius_km: radiusKm,
        duration_seconds: durationSeconds,
        category_filter: category,
      },
      {
        onSuccess: data => {
          navigation.replace('Lobby', {sessionId: data.id});
        },
      },
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>🎉 Create Session</Text>
      <Text style={styles.subtitle}>Set up a group food hunt</Text>

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
            <Text style={[styles.chipText, radiusKm === r && styles.chipTextActive]}>
              {formatRadius(r)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Timer */}
      <Text style={styles.sectionTitle}>Session Timer</Text>
      <View style={styles.chipRow}>
        {SESSION_DURATION_OPTIONS.map(t => (
          <TouchableOpacity
            key={t.value}
            style={[styles.chip, durationSeconds === t.value && styles.chipActive]}
            onPress={() => setDurationSeconds(t.value)}
            accessibilityRole="button"
            accessibilityState={{selected: durationSeconds === t.value}}>
            <Text
              style={[
                styles.chipText,
                durationSeconds === t.value && styles.chipTextActive,
              ]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Create Button */}
      <TouchableOpacity
        style={styles.createButton}
        onPress={handleCreate}
        disabled={createMutation.isPending}
        accessibilityRole="button"
        accessibilityLabel="Create session">
        {createMutation.isPending ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <Text style={styles.createText}>Create Session</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  content: {
    padding: 24,
    paddingTop: 80,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#333',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
    marginTop: 20,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 18,
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
  createButton: {
    backgroundColor: '#FF6B6B',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    marginTop: 40,
  },
  createText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
  },
});

export default CreateSessionScreen;
