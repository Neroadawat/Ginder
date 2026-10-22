import {t, useTranslation} from '@/i18n';
/**
 * Settings Screen — Logout, delete account.
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Linking,
  ScrollView,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';

import {useAuthStore} from '@/stores/authStore';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import {useDeleteAccount} from '@/hooks/useUser';
import {useGoogleUsage} from '@/hooks/useUsage';
import {PRIVACY_POLICY_URL, TERMS_OF_SERVICE_URL} from '@/services/config';

const SettingsScreen = () => {
  useTranslation();
  const navigation = useNavigation();
  const logout = useAuthStore(state => state.logout);
  const deleteMutation = useDeleteAccount();
  const {data: googleUsage} = useGoogleUsage();

  const handleLogout = () => {
    Alert.alert(t('ออกจากระบบ'), t('ต้องการออกจากระบบหรือไม่?'), [
      {text: t('ยกเลิก'), style: 'cancel'},
      {
        text: t('ออกจากระบบ'),
        style: 'destructive',
        onPress: logout,
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      t('ลบบัญชี'),
      t('บัญชีและข้อมูลส่วนบุคคลจะถูกลบถาวรและกู้คืนไม่ได้'),
      [
        {text: t('ยกเลิก'), style: 'cancel'},
        {
          text: t('ลบบัญชี'),
          style: 'destructive',
          onPress: () => {
            deleteMutation.mutate(undefined, {
              onSuccess: async () => logout(),
            });
          },
        },
      ],
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          accessibilityRole="button">
          <Text style={styles.backText}>{t('← กลับ')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('ตั้งค่า')}</Text>
      </View>

      {googleUsage && (
        <View style={styles.usageCard}>
          <Text style={styles.usageTitle}>
            {t('Google Places · ')}
            {googleUsage.period}
          </Text>
          <Text style={styles.usageText}>
            {t('Nearby Search: ')}
            {googleUsage.nearby_search.count} /{' '}
            {googleUsage.nearby_search.hard_limit}
          </Text>
          <Text style={styles.usageText}>
            {t('Place Photos: ')}
            {googleUsage.place_photo.count} /{' '}
            {googleUsage.place_photo.hard_limit}
          </Text>
          <Text style={styles.usageStatus}>
            {googleUsage.enabled
              ? t('Live fallback enabled')
              : t('Live fallback disabled')}
          </Text>
        </View>
      )}

      <View style={[styles.section, styles.languageSection]}>
        <Text style={styles.menuText}>{t('Language')}</Text>
        <LanguageSwitcher />
      </View>
      <View style={styles.section}>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={handleLogout}
          accessibilityRole="button">
          <Text style={styles.menuText}>{t('ออกจากระบบ')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItemDanger}
          onPress={handleDeleteAccount}
          accessibilityRole="button">
          <Text style={styles.menuTextDanger}>{t('ลบบัญชี')}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}
          accessibilityRole="link">
          <Text style={styles.menuText}>{t('ความเป็นส่วนตัว')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.menuItemDanger}
          onPress={() => Linking.openURL(TERMS_OF_SERVICE_URL)}
          accessibilityRole="link">
          <Text style={styles.menuText}>{t('ข้อกำหนดการใช้งาน')}</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.attribution}
        onPress={() =>
          Linking.openURL('https://www.openstreetmap.org/copyright')
        }
        accessibilityRole="link"
        accessibilityLabel={t(
          'Open OpenStreetMap copyright and licence information',
        )}>
        <Text style={styles.attributionText}>
          {t('Restaurant data © OpenStreetMap contributors')}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  content: {paddingBottom: 32},
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: '#FFF',
  },
  backText: {
    fontSize: 16,
    color: '#FF6B6B',
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#333',
  },
  section: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    margin: 16,
    overflow: 'hidden',
  },
  languageSection: {padding: 16},
  menuItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  menuText: {
    fontSize: 16,
    color: '#333',
  },
  menuItemDanger: {
    padding: 16,
  },
  menuTextDanger: {
    fontSize: 16,
    color: '#E53E3E',
    fontWeight: '600',
  },
  attribution: {
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  usageCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
  },
  usageTitle: {fontSize: 15, fontWeight: '700', color: '#333'},
  usageText: {fontSize: 13, color: '#555', marginTop: 6},
  usageStatus: {fontSize: 12, color: '#777', marginTop: 10},
  attributionText: {
    color: '#666',
    fontSize: 12,
    textDecorationLine: 'underline',
  },
});

export default SettingsScreen;
