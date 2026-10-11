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
      return 'โควตาค้นหาร้านภายนอกของเดือนนี้หมดแล้ว กรุณาใช้ข้อมูลร้านในระบบ';
    case 'rate_limited':
      return 'เพิ่งค้นหาพื้นที่นี้ไป กรุณารอสักครู่ก่อนลองอีกครั้ง';
    case 'failed':
      return 'ค้นหาร้านภายนอกไม่สำเร็จ แต่ข้อมูลร้านในระบบยังใช้งานได้';
    case 'disabled':
      return 'พื้นที่นี้ยังไม่มีข้อมูลในระบบ และยังไม่ได้เปิดการค้นหาภายนอก';
    case 'filters_unsupported':
      return 'ตัวกรองนี้ใช้กับผลลัพธ์สดไม่ได้ ลองปิดตัวกรองราคา เรตติ้ง หรือเปิดอยู่';
    default:
      return 'Expand the search radius or change filters to see more places.';
  }
};

const SoloSwipeScreen = () => {
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

  const {data: deck, isLoading} = useSoloDeck({
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
        'Group unavailable for live places',
        'Google Maps results are temporary previews. Group sessions use reviewed OSM or manual restaurants only.',
      );
      return;
    }
    const rootNavigation = navigation.getParent()?.getParent() as
      | NativeStackNavigationProp<RootStackParamList>
      | undefined;
    Alert.alert(
      'Play with friends',
      'Create a new lobby or join with an invite code.',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Join',
          onPress: () =>
            rootNavigation?.navigate('Session', {
              screen: 'JoinSession',
              params: {},
            }),
        },
        {
          text: 'Create',
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
        <Text style={styles.emptyEmoji}>📍</Text>
        <Text style={styles.emptyTitle}>ไม่สามารถอัปเดตตำแหน่งได้</Text>
        <Text style={styles.emptySubtitle}>{locationError}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={getCurrentLocation}
          accessibilityRole="button">
          <Text style={styles.retryText}>ลองค้นหาตำแหน่งอีกครั้ง</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (isLoading || isLocating || needsFreshGps) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#FF6B6B" />
        <Text style={styles.loadingText}>
          {needsFreshGps ? 'กำลังอัปเดตตำแหน่ง...' : 'Finding restaurants...'}
        </Text>
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
          accessibilityLabel="Open filter settings">
          <AppIcon name="filter" />
        </TouchableOpacity>
        <View style={styles.modePill}>
          <Text style={styles.modeText}>Solo</Text>
        </View>
        <View style={styles.deckPill}>
          <Text style={styles.deckText}>{deck?.total ?? 0} places</Text>
        </View>
        <TouchableOpacity
          style={styles.partyButton}
          onPress={openPartyMenu}
          accessibilityRole="button"
          accessibilityLabel="Play with friends">
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
              ? `Only ${deck.total} new places here. Expand to ${deck.suggested_radius_km} km for more.`
              : `Only ${deck.total} new places here. Try changing your filters.`}
          </Text>
        </TouchableOpacity>
      )}

      {hasGoogleLive && (
        <View style={styles.liveNotice}>
          <Text style={styles.liveNoticeText}>
            Live preview from Google Maps · Like and Group are unavailable
            {deck?.quota_warning ? ' · Monthly soft limit reached' : ''}
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
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🔍</Text>
            <Text style={styles.emptyTitle}>
              {deck?.coverage_status === 'unsupported'
                ? 'No new restaurants nearby'
                : 'You have seen this deck'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {externalMessage(deck?.external_status)}
            </Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => navigation.navigate('ExpandRadius')}
              accessibilityRole="button">
              <Text style={styles.retryText}>Expand search radius</Text>
            </TouchableOpacity>
          </View>
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
    alignItems: 'center',
    padding: 32,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: 24,
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
