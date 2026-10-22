import {t, useTranslation} from '@/i18n';
/**
 * Expand Radius Screen — shown when the deck runs out.
 *
 * Requirement 2.5: instead of reshuffling the same restaurants, let the user
 * widen the search radius to pull in new ones.
 */

import React from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';

import {useFilterStore} from '@/stores/filterStore';
import {
  MAX_RADIUS_KM,
  formatRadius,
  getWiderRadiusOptions,
} from '@/constants/filters';

const ExpandRadiusScreen = () => {
  useTranslation();
  const navigation = useNavigation();
  const radiusKm = useFilterStore(state => state.radiusKm);
  const setRadiusKm = useFilterStore(state => state.setRadiusKm);

  const widerOptions = getWiderRadiusOptions(radiusKm);
  const atMaxRadius = widerOptions.length === 0;

  const handleExpand = (newRadius: number) => {
    setRadiusKm(newRadius);
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('ดูร้านในสำรับครบแล้ว')}</Text>

      {atMaxRadius ? (
        <Text style={styles.subtitle}>
          {t('ค้นหาถึงระยะสูงสุด ')}
          {formatRadius(MAX_RADIUS_KM)}
          {t(' แล้ว ลองปรับตัวกรองเพื่อดูร้านเพิ่มเติม')}
        </Text>
      ) : (
        <Text style={styles.subtitle}>
          {t('กำลังค้นหาภายใน ')}
          {formatRadius(radiusKm)}
          {t(' ขยายรัศมี เพื่อค้นหาร้านเพิ่ม')}
        </Text>
      )}

      <View style={styles.options}>
        {widerOptions.map(r => (
          <TouchableOpacity
            key={r}
            style={styles.optionButton}
            onPress={() => handleExpand(r)}
            accessibilityRole="button"
            accessibilityLabel={t('Search within {radius}', {
              radius: formatRadius(r),
            })}>
            <Text style={styles.optionText}>
              {t('ค้นหาภายใน ')}
              {formatRadius(r)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={styles.cancelButton}
        onPress={() => navigation.goBack()}
        accessibilityRole="button">
        <Text style={styles.cancelText}>{t('กลับ')}</Text>
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
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#333',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  options: {
    width: '100%',
    gap: 12,
  },
  optionButton: {
    backgroundColor: '#FF6B6B',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  optionText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    marginTop: 20,
    padding: 12,
  },
  cancelText: {
    color: '#999',
    fontSize: 16,
  },
});

export default ExpandRadiusScreen;
