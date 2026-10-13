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
} from 'react-native';
import {useNavigation} from '@react-navigation/native';

import {useAuthStore} from '@/stores/authStore';
import {useDeleteAccount} from '@/hooks/useUser';
import {useGoogleUsage} from '@/hooks/useUsage';
import {PRIVACY_POLICY_URL, TERMS_OF_SERVICE_URL} from '@/services/config';
import {clearFCMRegistration} from '@/services/fcm';

const SettingsScreen = () => {
  const navigation = useNavigation();
  const logout = useAuthStore(state => state.logout);
  const deleteMutation = useDeleteAccount();
  const {data: googleUsage} = useGoogleUsage();

  const handleLogout = () => {
    Alert.alert('ออกจากระบบ', 'ต้องการออกจากระบบหรือไม่?', [
      {text: 'ยกเลิก', style: 'cancel'},
      {
        text: 'ออกจากระบบ',
        style: 'destructive',
        onPress: async () => {
          try {
            await clearFCMRegistration();
          } finally {
            await logout();
          }
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'ลบบัญชี',
      'บัญชีและข้อมูลส่วนบุคคลจะถูกลบถาวรและกู้คืนไม่ได้',
      [
        {text: 'ยกเลิก', style: 'cancel'},
        {
          text: 'ลบบัญชี',
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
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          accessibilityRole="button">
          <Text style={styles.backText}>← กลับ</Text>
        </TouchableOpacity>
        <Text style={styles.title}>ตั้งค่า</Text>
      </View>

      {googleUsage && (
        <View style={styles.usageCard}>
          <Text style={styles.usageTitle}>
            Google Places · {googleUsage.period}
          </Text>
          <Text style={styles.usageText}>
            Nearby Search: {googleUsage.nearby_search.count} /{' '}
            {googleUsage.nearby_search.hard_limit}
          </Text>
          <Text style={styles.usageText}>
            Place Photos: {googleUsage.place_photo.count} /{' '}
            {googleUsage.place_photo.hard_limit}
          </Text>
          <Text style={styles.usageStatus}>
            {googleUsage.enabled
              ? 'Live fallback enabled'
              : 'Live fallback disabled'}
          </Text>
        </View>
      )}

      <View style={styles.section}>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={handleLogout}
          accessibilityRole="button">
          <Text style={styles.menuText}>ออกจากระบบ</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItemDanger}
          onPress={handleDeleteAccount}
          accessibilityRole="button">
          <Text style={styles.menuTextDanger}>ลบบัญชี</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}
          accessibilityRole="link">
          <Text style={styles.menuText}>ความเป็นส่วนตัว</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.menuItemDanger}
          onPress={() => Linking.openURL(TERMS_OF_SERVICE_URL)}
          accessibilityRole="link">
          <Text style={styles.menuText}>ข้อกำหนดการใช้งาน</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.attribution}
        onPress={() =>
          Linking.openURL('https://www.openstreetmap.org/copyright')
        }
        accessibilityRole="link"
        accessibilityLabel="Open OpenStreetMap copyright and licence information">
        <Text style={styles.attributionText}>
          Restaurant data © OpenStreetMap contributors
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
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
