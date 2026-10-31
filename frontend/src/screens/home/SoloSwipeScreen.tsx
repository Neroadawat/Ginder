import {t, useTranslation} from '@/i18n';
/**
 * Solo Swipe Screen — Default app screen. Swipe restaurants solo.
 */

import React, {useCallback} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';

import SwipeCard from '@/components/SwipeCard';
import {useSoloDeck} from '@/hooks/useRestaurants';
import {useSoloSwipe} from '@/hooks/useVotes';
import {useFilterStore} from '@/stores/filterStore';
import {HomeStackParamList, RootStackParamList} from '@/navigation/types';
import {RestaurantCard} from '@/types/restaurant';
import AppIcon from '@/components/AppIcon';
import {COLORS} from '@/constants/theme';
import {getCurrentLocation} from '@/services/location';
import {useLocationStore} from '@/stores/locationStore';
import {isLocationFresh} from '@/utils/location';

type NavigationProp = NativeStackNavigationProp<
  HomeStackParamList,
  'SoloSwipe'
>;

const externalMessage = (status: string | undefined): string => {
  switch (status) {
    case 'quota_exhausted':
      return t(
        'โควตาค้นหาร้านภายนอกของเดือนนี้หมดแล้ว กรุณาใช้ข้อมูลร้านในระบบ',
      );
    case 'rate_limited':
      return t('เพิ่งค้นหาพื้นที่นี้ไป กรุณารอสักครู่ก่อนลองอีกครั้ง');
    case 'failed':
      return t('ค้นหาร้านภายนอกไม่สำเร็จ แต่ข้อมูลร้านในระบบยังใช้งานได้');
    case 'disabled':
      return t('พื้นที่นี้ยังไม่มีข้อมูลในระบบ และยังไม่ได้เปิดการค้นหาภายนอก');
    case 'filters_unsupported':
      return t(
        'ตัวกรองนี้ใช้กับผลลัพธ์สดไม่ได้ ลองปิดตัวกรองราคา เรตติ้ง หรือเปิดอยู่',
      );
    default:
      return t('ลองขยายรัศมีหรือปรับตัวกรองเพื่อค้นหาร้านเพิ่มเติม');
  }
};

const SoloSwipeScreen = () => {
  useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const category = useFilterStore(state => state.category);
  const priceLevel = useFilterStore(state => state.priceLevel);
  const minRating = useFilterStore(state => state.minRating);
  const radiusKm = useFilterStore(state => state.radiusKm);
  const openNow = useFilterStore(state => state.openNow);
  const capturedAt = useLocationStore(state => state.capturedAt);
  const isLocating = useLocationStore(state => state.isLocating);
  const locationError = useLocationStore(state => state.error);
  const needsFreshGps = !isLocationFresh(capturedAt);

  const {
    data: deck,
    isLoading,
    isError,
    error,
    isFetching,
    refetch,
  } = useSoloDeck({
    category,
    priceLevel,
    minRating,
    radiusKm,
    openNow,
  });
  const soloSwipeMutation = useSoloSwipe();
  const hasGoogleLive = deck?.restaurants.some(
    restaurant => restaurant.source === 'google_live',
  );

  const openPartyMenu = () => {
    if (hasGoogleLive) {
      Alert.alert(
        t('ร้านนี้ยังใช้กับห้องเพื่อนไม่ได้'),
        t(
          'ผลจาก Google Maps เป็นข้อมูลชั่วคราว ห้องเพื่อนใช้ร้านที่บันทึกในระบบเท่านั้น',
        ),
      );
      return;
    }
    const rootNavigation = navigation.getParent()?.getParent() as
      | NativeStackNavigationProp<RootStackParamList>
      | undefined;
    Alert.alert(
      t('เลือกร้านกับเพื่อน'),
      t('สร้างห้องใหม่หรือเข้าห้องด้วยรหัสคำเชิญ'),
      [
        {text: t('ยกเลิก'), style: 'cancel'},
        {
          text: t('เข้าห้อง'),
          onPress: () =>
            rootNavigation?.navigate('Session', {
              screen: 'JoinSession',
              params: {},
            }),
        },
        {
          text: t('สร้างห้อง'),
          onPress: () =>
            rootNavigation?.navigate('Session', {screen: 'CreateSession'}),
        },
      ],
    );
  };

  const handleSwipe = useCallback(
    (restaurant: RestaurantCard, liked: boolean) => {
      if (restaurant.source === 'google_live') {
        return !liked;
      }
      soloSwipeMutation.mutate({restaurant_id: restaurant.id, liked});
      return true;
    },
    [soloSwipeMutation],
  );

  const handleDeckEmpty = useCallback(() => {
    navigation.navigate('ExpandRadius');
  }, [navigation]);

  if (needsFreshGps && locationError && !isLocating) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyTitle}>{t('ไม่สามารถอัปเดตตำแหน่งได้')}</Text>
        <Text style={styles.emptySubtitle}>{t(locationError ?? '')}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={getCurrentLocation}
          accessibilityRole="button">
          <Text style={styles.retryText}>{t('ลองค้นหาตำแหน่งอีกครั้ง')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (isLoading || isLocating || needsFreshGps) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#FF6B6B" />
        <Text style={styles.loadingText}>
          {needsFreshGps ? t('กำลังอัปเดตตำแหน่ง...') : t('กำลังค้นหาร้าน...')}
        </Text>
      </View>
    );
  }

  // A failed request has no deck. Never present it as a completed deck.
  if (isError && !deck) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyTitle}>{t('โหลดร้านอาหารไม่สำเร็จ')}</Text>
        <Text style={styles.emptySubtitle}>
          {error instanceof Error
            ? t(error.message)
            : t('กรุณาตรวจการเชื่อมต่อแล้วลองอีกครั้ง')}
        </Text>
        <TouchableOpacity
          style={styles.retryButton}
          disabled={isFetching}
          onPress={() => refetch()}
          accessibilityRole="button">
          <Text style={styles.retryText}>
            {isFetching ? t('กำลังค้นหาร้าน...') : t('ลองอีกครั้ง')}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.topControls}>
        <TouchableOpacity
          onPress={() => navigation.navigate('FilterSettings')}
          style={styles.circleButton}
          accessibilityRole="button"
          accessibilityLabel={t('Open filter settings')}>
          <AppIcon name="filter" />
        </TouchableOpacity>
        <View style={styles.modePill}>
          <Text style={styles.modeText}>{t('คนเดียว')}</Text>
        </View>
        <View style={styles.deckPill}>
          <Text style={styles.deckText}>
            {deck?.total ?? 0}
            {t(' ร้าน')}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.partyButton}
          onPress={openPartyMenu}
          accessibilityRole="button"
          accessibilityLabel={t('Play with friends')}>
          <Text style={styles.partyText}>+</Text>
        </TouchableOpacity>
      </View>

      {deck?.coverage_status === 'partial' && !hasGoogleLive && (
        <TouchableOpacity
          style={styles.coverageNotice}
          onPress={() => navigation.navigate('ExpandRadius')}
          accessibilityRole="button">
          <Text style={styles.coverageText}>
            {deck.suggested_radius_km
              ? t('พบร้านใหม่ {p0} ร้าน ลองขยายเป็น {p1} กม.', {
                  p0: deck.total,
                  p1: deck.suggested_radius_km,
                })
              : t('พบร้านใหม่ {p0} ร้าน ลองปรับตัวกรอง', {p0: deck.total})}
          </Text>
        </TouchableOpacity>
      )}

      {hasGoogleLive && (
        <View style={styles.liveNotice}>
          <Text style={styles.liveNoticeText}>
            {t(
              'ข้อมูลสดจาก Google Maps · ยังบันทึกถูกใจหรือใช้กับห้องเพื่อนไม่ได้',
            )}
            {deck?.quota_warning ? t(' · ใกล้ถึงขีดจำกัดเดือนนี้') : ''}
          </Text>
        </View>
      )}

      <View style={styles.cardContainer}>
        {deck && deck.restaurants.length > 0 ? (
          <SwipeCard
            restaurants={deck.restaurants}
            onSwipe={handleSwipe}
            onDeckEmpty={handleDeckEmpty}
          />
        ) : (
          <ScrollView
            style={styles.emptyScroll}
            contentContainerStyle={styles.emptyState}>
            <View style={styles.emptyContent}>
              <View style={styles.emptyIcon}>
                <AppIcon name="location" size={32} color={COLORS.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>{t('No restaurants found')}</Text>
              <Text style={styles.emptySubtitle}>
                {externalMessage(deck?.external_status)}
              </Text>
              <View style={styles.emptyActions}>
                <TouchableOpacity
                  style={[styles.emptyAction, styles.primaryAction]}
                  onPress={() => navigation.navigate('ExpandRadius')}
                  accessibilityRole="button">
                  <Text style={styles.actionLabel}>{t('ขยายรัศมีค้นหา')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.emptyAction,
                    styles.secondaryAction,
                    isFetching && styles.disabledAction,
                  ]}
                  disabled={isFetching}
                  accessibilityState={{disabled: isFetching, busy: isFetching}}
                  onPress={() => refetch()}
                  accessibilityRole="button">
                  {isFetching && (
                    <ActivityIndicator color={COLORS.text} size="small" />
                  )}
                  <Text style={styles.actionLabel}>
                    {isFetching ? t('กำลังค้นหาร้าน...') : t('ลองอีกครั้ง')}
                  </Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={styles.filterAction}
                onPress={() => navigation.navigate('FilterSettings')}
                accessibilityRole="button">
                <Text style={styles.filterActionLabel}>
                  {t('Adjust filters')}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  topControls: {
    position: 'absolute',
    top: 42,
    left: 14,
    right: 14,
    zIndex: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  circleButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(5,5,5,0.82)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modePill: {
    backgroundColor: '#101010',
    borderRadius: 18,
    paddingHorizontal: 15,
    paddingVertical: 9,
  },
  modeText: {color: '#FFF', fontSize: 13, fontWeight: '700'},
  deckPill: {
    marginLeft: 'auto',
    backgroundColor: 'rgba(5,5,5,0.72)',
    borderRadius: 18,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  deckText: {color: '#DDD', fontSize: 12, fontWeight: '600'},
  coverageNotice: {
    position: 'absolute',
    top: 94,
    left: 24,
    right: 24,
    zIndex: 29,
    borderRadius: 12,
    backgroundColor: 'rgba(20,20,20,0.86)',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  coverageText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  liveNotice: {
    position: 'absolute',
    top: 94,
    left: 24,
    right: 24,
    zIndex: 29,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#5E5E5E',
    backgroundColor: 'rgba(20,20,20,0.92)',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  liveNoticeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '400',
    textAlign: 'center',
  },
  partyButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#151313',
    borderWidth: 1,
    borderColor: '#3A3535',
    alignItems: 'center',
    justifyContent: 'center',
  },
  partyText: {color: '#FFF', fontSize: 28, lineHeight: 30, fontWeight: '300'},
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text,
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
  emptyState: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 120,
    paddingBottom: 112,
  },
  emptyScroll: {
    flex: 1,
    width: '100%',
  },
  emptyContent: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyActions: {
    width: '100%',
    gap: 12,
  },
  emptyAction: {
    minHeight: 52,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryAction: {
    backgroundColor: COLORS.accent,
  },
  secondaryAction: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  disabledAction: {
    opacity: 0.6,
  },
  actionLabel: {
    color: COLORS.text,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
    textAlign: 'center',
  },
  filterAction: {
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterActionLabel: {
    color: COLORS.textMuted,
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '600',
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  retryButton: {
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 32,
  },
  retryText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default SoloSwipeScreen;
