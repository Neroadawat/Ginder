import React from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';

import AppIcon from '@/components/AppIcon';
import {COLORS} from '@/constants/theme';
import {useProfile, useDeleteAccount} from '@/hooks/useUser';
import {useAuthStore} from '@/stores/authStore';
import {ProfileStackParamList, RootStackParamList} from '@/navigation/types';

type ProfileNav = NativeStackNavigationProp<
  ProfileStackParamList,
  'ProfileHome'
>;

const ProfileHomeScreen = () => {
  const navigation = useNavigation<ProfileNav>();
  const rootNav =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {data: profile} = useProfile();
  const logout = useAuthStore(state => state.logout);
  const deleteAccount = useDeleteAccount();

  const confirmLogout = () =>
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      {text: 'Cancel'},
      {text: 'Log out', style: 'destructive', onPress: logout},
    ]);
  const confirmDelete = () =>
    Alert.alert(
      'Delete account',
      'This permanently deletes your account and personal data.',
      [
        {text: 'Cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteAccount.mutate(undefined, {onSuccess: logout}),
        },
      ],
    );
  const legal = (title: string) =>
    Alert.alert(
      title,
      `${title} is available during onboarding. The full published document will appear here before release.`,
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
            <Text style={styles.editText}>Edit profile</Text>
          </TouchableOpacity>
        </View>
      </View>
      <Section title="Account">
        <Row
          label="Create party session"
          onPress={() => rootNav.navigate('Session', {screen: 'CreateSession'})}
        />
        <Row
          label="Friends"
          onPress={() => navigation.navigate('FriendList')}
        />
        <Row
          label="Match history"
          onPress={() => navigation.navigate('History')}
        />
        <Row
          label="Notification settings"
          onPress={() => navigation.navigate('Settings')}
        />
      </Section>
      <Section title="About">
        <Row label="Privacy Policy" onPress={() => legal('Privacy Policy')} />
        <Row label="Terms" onPress={() => legal('Terms of Service')} />
      </Section>
      <Section title="Danger zone">
        <Row label="Logout" onPress={confirmLogout} arrow={false} />
        <Row
          label="Delete Account"
          onPress={confirmDelete}
          arrow={false}
          danger
        />
      </Section>
      <Text style={styles.version}>version 0.1.0</Text>
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
