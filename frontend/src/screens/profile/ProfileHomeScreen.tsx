import {t, useTranslation} from '@/i18n';
import React from 'react';
import {
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';

import AppIcon from '@/components/AppIcon';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import {COLORS} from '@/constants/theme';
import {useProfile, useDeleteAccount} from '@/hooks/useUser';
import {useNotifications} from '@/hooks/useNotifications';
import {useCurrentSession} from '@/hooks/useSessions';
import {useAuthStore} from '@/stores/authStore';
import {ProfileStackParamList, RootStackParamList} from '@/navigation/types';
import {PRIVACY_POLICY_URL, TERMS_OF_SERVICE_URL} from '@/services/config';

type ProfileNav = NativeStackNavigationProp<
  ProfileStackParamList,
  'ProfileHome'
>;

const ProfileHomeScreen = () => {
  useTranslation();
  const navigation = useNavigation<ProfileNav>();
  const rootNav =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {data: profile} = useProfile();
  const logout = useAuthStore(state => state.logout);
  const deleteAccount = useDeleteAccount();
  const {data: notifications} = useNotifications();
  const {data: currentSession} = useCurrentSession();

  const confirmLogout = () =>
    Alert.alert(t('ออกจากระบบ'), t('ต้องการออกจากระบบหรือไม่?'), [
      {text: t('ยกเลิก')},
      {text: t('ออกจากระบบ'), style: 'destructive', onPress: logout},
    ]);
  const confirmDelete = () =>
    Alert.alert(
      t('ลบบัญชี'),
      t('บัญชีและข้อมูลส่วนบุคคลจะถูกลบถาวรและกู้คืนไม่ได้'),
      [
        {text: t('ยกเลิก')},
        {
          text: t('ลบบัญชี'),
          style: 'destructive',
          onPress: () => deleteAccount.mutate(undefined, {onSuccess: logout}),
        },
      ],
    );
  const legal = (url: string) =>
    Linking.openURL(url).catch(() =>
      Alert.alert(
        t('เปิดหน้าเว็บไม่สำเร็จ'),
        t('กรุณาตรวจการเชื่อมต่อแล้วลองอีกครั้ง'),
      ),
    );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.identity}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {profile?.display_name?.slice(0, 1).toUpperCase() || '?'}
          </Text>
        </View>
        <View style={styles.identityCopy}>
          <Text style={styles.name}>
            {profile?.display_name || 'Ginder user'}
          </Text>
          <Text style={styles.email}>{profile?.email}</Text>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => navigation.navigate('Settings')}>
            <Text style={styles.editText}>{t('ตั้งค่า')}</Text>
          </TouchableOpacity>
        </View>
      </View>
      <LanguageSwitcher />
      <Section title={t('บัญชี')}>
        {currentSession && (
          <Row
            label={
              currentSession.session.status === 'lobby'
                ? t('กลับเข้าห้องรอ')
                : t('กลับเข้าห้องที่กำลังเล่น')
            }
            onPress={() => {
              if (currentSession.session.status === 'lobby') {
                rootNav.navigate('Session', {
                  screen: 'Lobby',
                  params: {sessionId: currentSession.session.id},
                });
              } else {
                rootNav.navigate('Session', {
                  screen: 'SessionSwipe',
                  params: {sessionId: currentSession.session.id},
                });
              }
            }}
          />
        )}
        <Row
          label={t('สร้างห้องกับเพื่อน')}
          onPress={() => rootNav.navigate('Session', {screen: 'CreateSession'})}
        />
        <Row
          label={t('เข้าห้องด้วยรหัส')}
          onPress={() =>
            rootNav.navigate('Session', {screen: 'JoinSession', params: {}})
          }
        />
        <Row
          label={t('คำเชิญ{p0}', {
            p0: notifications?.unread_count
              ? ` (${notifications.unread_count})`
              : '',
          })}
          onPress={() => navigation.navigate('Notifications')}
        />
        <Row
          label={t('เพื่อน')}
          onPress={() => navigation.navigate('FriendList')}
        />
        <Row
          label={t('ประวัติร้านที่เลือก')}
          onPress={() => navigation.navigate('History')}
        />
      </Section>
      <Section title={t('เกี่ยวกับแอป')}>
        <Row
          label={t('ความเป็นส่วนตัว')}
          onPress={() => legal(PRIVACY_POLICY_URL)}
        />
        <Row
          label={t('ข้อกำหนดการใช้งาน')}
          onPress={() => legal(TERMS_OF_SERVICE_URL)}
        />
      </Section>
      <Section title={t('จัดการบัญชี')}>
        <Row label={t('ออกจากระบบ')} onPress={confirmLogout} arrow={false} />
        <Row
          label={t('ลบบัญชี')}
          onPress={confirmDelete}
          arrow={false}
          danger
        />
      </Section>
      <Text style={styles.version}>{t('เวอร์ชัน 1.0.0')}</Text>
    </ScrollView>
  );
};

const Section = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {children}
  </View>
);

const Row = ({
  label,
  onPress,
  danger = false,
  arrow = true,
}: {
  label: string;
  onPress: () => void;
  danger?: boolean;
  arrow?: boolean;
}) => (
  <TouchableOpacity style={styles.row} onPress={onPress}>
    <Text style={[styles.rowText, danger && styles.danger]}>{label}</Text>
    {arrow && <AppIcon name="arrow" size={17} color="#777" />}
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: COLORS.background},
  content: {paddingTop: 61, paddingHorizontal: 11, paddingBottom: 105},
  identity: {flexDirection: 'row', alignItems: 'center', marginBottom: 18},
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.accentDark,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  avatarText: {fontSize: 26, color: '#FFF', fontWeight: '800'},
  identityCopy: {flex: 1, alignItems: 'flex-start'},
  name: {fontSize: 16, fontWeight: '800', color: COLORS.text},
  email: {fontSize: 12, color: COLORS.textMuted, marginTop: 1},
  editButton: {
    backgroundColor: '#FFF',
    borderRadius: 18,
    paddingVertical: 7,
    paddingHorizontal: 17,
    marginTop: 5,
  },
  editText: {fontSize: 12, fontWeight: '800', color: '#111'},
  section: {marginTop: 9},
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 7,
  },
  row: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
    paddingHorizontal: 14,
  },
  rowText: {flex: 1, fontSize: 13, color: '#F4F1F1'},
  danger: {color: '#FF2B2B'},
  version: {
    color: COLORS.textMuted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 42,
  },
});

export default ProfileHomeScreen;
