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
  Switch,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';

import {useCreateSession, useCurrentSession} from '@/hooks/useSessions';
import {COLORS} from '@/constants/theme';
import {useCategories} from '@/hooks/useRestaurants';
import {useLocationStore} from '@/stores/locationStore';
import {SessionStackParamList} from '@/navigation/types';
import {
  DEFAULT_RADIUS_KM,
  PRICE_LEVELS,
  RADIUS_OPTIONS_KM,
  RATING_OPTIONS,
  SESSION_DURATION_OPTIONS,
  formatRadius,
} from '@/constants/filters';

type NavigationProp = NativeStackNavigationProp<SessionStackParamList, 'CreateSession'>;

const ALL_LABEL = 'All';

const CreateSessionScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const latitude = useLocationStore(state => state.latitude);
  const longitude = useLocationStore(state => state.longitude);
  const createMutation = useCreateSession();
  const {data: currentSession, isLoading: isCheckingSession} = useCurrentSession();
  const {data: categories} = useCategories();

  const [radiusKm, setRadiusKm] = useState<number>(DEFAULT_RADIUS_KM);
  const [durationSeconds, setDurationSeconds] = useState(300);
  const [category, setCategory] = useState<string | null>(null);
  // Same filter set as Solo Mode (requirement 5.5): price tier, minimum
  // rating and "open now", on top of category and radius above.
  const [priceLevel, setPriceLevel] = useState<number | null>(null);
  const [minRating, setMinRating] = useState<number | null>(null);
  const [openNow, setOpenNow] = useState(false);

  const categoryOptions = [ALL_LABEL, ...(categories ?? [])];

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
        price_filter: priceLevel,
        rating_filter: minRating,
        open_now_filter: openNow,
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

      {currentSession && (
        <View style={styles.resumeCard}>
          <View style={styles.resumeCopy}>
            <Text style={styles.resumeTitle}>You already have an open session</Text>
            <Text style={styles.resumeHint}>Resume it before creating another one.</Text>
          </View>
          <TouchableOpacity
            style={styles.resumeButton}
            onPress={() => {
              if (currentSession.session.status === 'lobby') {
                navigation.replace('Lobby', {sessionId: currentSession.session.id});
              } else {
                navigation.replace('SessionSwipe', {sessionId: currentSession.session.id});
              }
            }}>
            <Text style={styles.resumeText}>Resume</Text>
          </TouchableOpacity>
        </View>
      )}

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

      {/* Category */}
      <Text style={styles.sectionTitle}>Category</Text>
      <View style={styles.chipRow}>
        {categoryOptions.map(option => {
          const selected = option === ALL_LABEL ? !category : category === option;
          return (
            <TouchableOpacity
              key={option}
              style={[styles.chip, selected && styles.chipActive]}
              onPress={() => setCategory(option === ALL_LABEL ? null : option)}
              accessibilityRole="button"
              accessibilityState={{selected}}>
              <Text style={[styles.chipText, selected && styles.chipTextActive]}>
                {option}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Price */}
      <Text style={styles.sectionTitle}>Price Range</Text>
      <View style={styles.chipRow}>
        {PRICE_LEVELS.map(option => {
          const selected = priceLevel === option.value;
          return (
            <TouchableOpacity
              key={option.label}
              style={[styles.chip, selected && styles.chipActive]}
              onPress={() => setPriceLevel(option.value)}
              accessibilityRole="button"
              accessibilityState={{selected}}>
              <Text style={[styles.chipText, selected && styles.chipTextActive]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Rating */}
      <Text style={styles.sectionTitle}>Minimum Rating</Text>
      <View style={styles.chipRow}>
        {RATING_OPTIONS.map(option => {
          const selected = minRating === option.value;
          return (
            <TouchableOpacity
              key={option.label}
              style={[styles.chip, selected && styles.chipActive]}
              onPress={() => setMinRating(option.value)}
              accessibilityRole="button"
              accessibilityState={{selected}}>
              <Text style={[styles.chipText, selected && styles.chipTextActive]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Open now */}
      <View style={styles.switchRow}>
        <View style={styles.switchLabel}>
          <Text style={styles.sectionTitle}>Open now</Text>
          <Text style={styles.sectionHint}>Only show places serving at this moment</Text>
        </View>
        <Switch
          value={openNow}
          onValueChange={setOpenNow}
          trackColor={{false: '#403B3B', true: COLORS.accent}}
          thumbColor="#FFF"
          accessibilityLabel="Only show places open now"
        />
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
        disabled={createMutation.isPending || isCheckingSession || Boolean(currentSession)}
        accessibilityRole="button"
        accessibilityLabel="Create session">
        {createMutation.isPending || isCheckingSession ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <Text style={styles.createText}>Create Session</Text>
        )}
      </TouchableOpacity>
      {createMutation.isError && (
        <Text style={styles.error}>{createMutation.error.message}</Text>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: 24,
    paddingTop: 80,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.text,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginTop: 4,
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 12,
    marginTop: 20,
  },
  sectionHint: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: -8,
    marginBottom: 4,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  switchLabel: {
    flex: 1,
    paddingRight: 16,
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
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  chipActive: {
    borderColor: '#FF6B6B',
    backgroundColor: '#381B1B',
  },
  chipText: {
    fontSize: 14,
    color: COLORS.textMuted,
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
  resumeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,
  },
  resumeCopy: {flex: 1},
  resumeTitle: {color: COLORS.text, fontSize: 14, fontWeight: '800'},
  resumeHint: {color: COLORS.textMuted, fontSize: 11, marginTop: 3},
  resumeButton: {backgroundColor: COLORS.accent, borderRadius: 11, paddingHorizontal: 14, paddingVertical: 9},
  resumeText: {color: '#FFF', fontSize: 12, fontWeight: '800'},
  error: {color: '#FF7777', fontSize: 13, textAlign: 'center', marginTop: 12},
});

export default CreateSessionScreen;
