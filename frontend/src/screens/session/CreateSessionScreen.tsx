import {t, useTranslation} from '@/i18n';
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
import {categoryLabel} from '@/utils/category';
import {useLocationStore} from '@/stores/locationStore';
import {ensureFreshLocation} from '@/services/location';
import {SessionStackParamList} from '@/navigation/types';
import {
  DEFAULT_RADIUS_KM,
  PRICE_LEVELS,
  RADIUS_OPTIONS_KM,
  RATING_OPTIONS,
  SESSION_DURATION_OPTIONS,
  formatRadius,
} from '@/constants/filters';

type NavigationProp = NativeStackNavigationProp<
  SessionStackParamList,
  'CreateSession'
>;

const ALL_LABEL = 'ทั้งหมด';

const CreateSessionScreen = () => {
  useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const isLocating = useLocationStore(state => state.isLocating);
  const locationError = useLocationStore(state => state.error);
  const createMutation = useCreateSession();
  const {data: currentSession, isLoading: isCheckingSession} =
    useCurrentSession();
  const {data: categories} = useCategories();

  const [radiusKm, setRadiusKm] = useState<number>(DEFAULT_RADIUS_KM);
  const [durationSeconds, setDurationSeconds] = useState(60);
  const [category, setCategory] = useState<string | null>(null);
  // Same filter set as Solo Mode (requirement 5.5): price tier, minimum
  // rating and "open now", on top of category and radius above.
  const [priceLevel, setPriceLevel] = useState<number | null>(null);
  const [minRating, setMinRating] = useState<number | null>(null);
  const [openNow, setOpenNow] = useState(false);

  const categoryOptions = [ALL_LABEL, ...(categories ?? [])];

  const handleCreate = async () => {
    const location = await ensureFreshLocation();
    if (!location) {
      return;
    }

    createMutation.mutate(
      {
        latitude: location.latitude,
        longitude: location.longitude,
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
      <Text style={styles.title}>{t('สร้างห้องกับเพื่อน')}</Text>
      <Text style={styles.subtitle}>{t('ตั้งค่าการค้นหาร้านและเวลาโหวต')}</Text>

      {currentSession && (
        <View style={styles.resumeCard}>
          <View style={styles.resumeCopy}>
            <Text style={styles.resumeTitle}>
              {t('คุณมีห้องที่ยังไม่จบอยู่')}
            </Text>
            <Text style={styles.resumeHint}>
              {t('กลับเข้าห้องเดิมก่อนสร้างห้องใหม่')}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.resumeButton}
            onPress={() => {
              if (currentSession.session.status === 'lobby') {
                navigation.replace('Lobby', {
                  sessionId: currentSession.session.id,
                });
              } else {
                navigation.replace('SessionSwipe', {
                  sessionId: currentSession.session.id,
                });
              }
            }}>
            <Text style={styles.resumeText}>{t('กลับเข้าห้อง')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Radius */}
      <Text style={styles.sectionTitle}>{t('รัศมีค้นหา')}</Text>
      <View style={styles.chipRow}>
        {RADIUS_OPTIONS_KM.map(r => (
          <TouchableOpacity
            key={r}
            style={[styles.chip, radiusKm === r && styles.chipActive]}
            onPress={() => setRadiusKm(r)}
            accessibilityRole="button"
            accessibilityState={{selected: radiusKm === r}}>
            <Text
              style={[
                styles.chipText,
                radiusKm === r && styles.chipTextActive,
              ]}>
              {formatRadius(r)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Category */}
      <Text style={styles.sectionTitle}>{t('ประเภทอาหาร')}</Text>
      <View style={styles.chipRow}>
        {categoryOptions.map(option => {
          const selected =
            option === ALL_LABEL ? !category : category === option;
          return (
            <TouchableOpacity
              key={option}
              style={[styles.chip, selected && styles.chipActive]}
              onPress={() => setCategory(option === ALL_LABEL ? null : option)}
              accessibilityRole="button"
              accessibilityState={{selected}}>
              <Text
                style={[styles.chipText, selected && styles.chipTextActive]}>
                {categoryLabel(option)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Price */}
      <Text style={styles.sectionTitle}>{t('ช่วงราคา')}</Text>
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
              <Text
                style={[styles.chipText, selected && styles.chipTextActive]}>
                {t(option.label)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Rating */}
      <Text style={styles.sectionTitle}>{t('คะแนนขั้นต่ำ')}</Text>
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
              <Text
                style={[styles.chipText, selected && styles.chipTextActive]}>
                {t(option.label)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Open now */}
      <View style={styles.switchRow}>
        <View style={styles.switchLabel}>
          <Text style={styles.sectionTitle}>{t('เปิดอยู่ตอนนี้')}</Text>
          <Text style={styles.sectionHint}>
            {t('เฉพาะร้านที่มีข้อมูลเวลาเปิดและกำลังเปิดอยู่')}
          </Text>
        </View>
        <Switch
          value={openNow}
          onValueChange={setOpenNow}
          trackColor={{false: '#403B3B', true: COLORS.accent}}
          thumbColor="#FFF"
          accessibilityLabel={t('Only show places open now')}
        />
      </View>

      {/* Timer */}
      <Text style={styles.sectionTitle}>{t('เวลาโหวต')}</Text>
      <View style={styles.chipRow}>
        {SESSION_DURATION_OPTIONS.map(option => (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.chip,
              durationSeconds === option.value && styles.chipActive,
            ]}
            onPress={() => setDurationSeconds(option.value)}
            accessibilityRole="button"
            accessibilityState={{selected: durationSeconds === option.value}}>
            <Text
              style={[
                styles.chipText,
                durationSeconds === option.value && styles.chipTextActive,
              ]}>
              {t(option.label)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Create Button */}
      <TouchableOpacity
        style={styles.createButton}
        onPress={handleCreate}
        disabled={
          createMutation.isPending ||
          isCheckingSession ||
          isLocating ||
          Boolean(currentSession)
        }
        accessibilityRole="button"
        accessibilityLabel={t('Create session')}>
        {createMutation.isPending || isCheckingSession || isLocating ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <Text style={styles.createText}>{t('สร้างห้อง')}</Text>
        )}
      </TouchableOpacity>
      {createMutation.isError && (
        <Text style={styles.error}>{t(createMutation.error.message)}</Text>
      )}
      {locationError && <Text style={styles.error}>{t(locationError)}</Text>}
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
  resumeButton: {
    backgroundColor: COLORS.accent,
    borderRadius: 11,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  resumeText: {color: '#FFF', fontSize: 12, fontWeight: '800'},
  error: {color: '#FF7777', fontSize: 13, textAlign: 'center', marginTop: 12},
});

export default CreateSessionScreen;
