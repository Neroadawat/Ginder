import {t, useTranslation} from '@/i18n';
/**
 * Main Tab Navigator — Bottom tabs for Home, Explore, Likes, History, Profile.
 */

import React from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';

import HomeNavigator from './stacks/HomeStack';
import ExploreNavigator from './stacks/ExploreStack';
import LikesScreen from '@/screens/likes/LikesScreen';
import HistoryScreen from '@/screens/history/HistoryScreen';
import ProfileNavigator from './stacks/ProfileStack';
import {MainTabParamList} from './types';
import AppIcon, {AppIconName} from '@/components/AppIcon';
import {COLORS} from '@/constants/theme';
import {useNotifications} from '@/hooks/useNotifications';
import {useCurrentSession} from '@/hooks/useSessions';
import {usePushNotifications} from '@/hooks/usePushNotifications';

const Tab = createBottomTabNavigator<MainTabParamList>();

const ICONS: Record<keyof MainTabParamList, AppIconName> = {
  HomeTab: 'swipe',
  ExploreTab: 'explore',
  LikesTab: 'heart',
  HistoryTab: 'history',
  ProfileTab: 'profile',
};

const tabScreenOptions = ({
  route,
}: {
  route: {name: keyof MainTabParamList};
}) => ({
  headerShown: false,
  sceneContainerStyle: {backgroundColor: COLORS.background},
  tabBarIcon: ({color, focused}: {color: string; focused: boolean}) => (
    <AppIcon
      name={ICONS[route.name]}
      color={color}
      filled={focused && route.name === 'LikesTab'}
    />
  ),
  tabBarActiveTintColor: COLORS.text,
  tabBarInactiveTintColor: '#D6D1D1',
  tabBarActiveBackgroundColor: '#4A4747',
  tabBarStyle: {
    position: 'absolute' as const,
    left: 16,
    right: 16,
    bottom: 12,
    backgroundColor: '#171616',
    borderTopWidth: 1,
    borderColor: '#3A3636',
    borderRadius: 30,
    height: 58,
    paddingBottom: 4,
    overflow: 'hidden' as const,
  },
  tabBarLabelStyle: {fontSize: 12, fontWeight: '600' as const},
  tabBarItemStyle: {borderRadius: 28},
  tabBarHideOnKeyboard: true,
});

const MainTabNavigator = () => {
  useTranslation();
  usePushNotifications();
  const {data: notifications} = useNotifications();
  useCurrentSession();
  return (
    <Tab.Navigator screenOptions={tabScreenOptions}>
      <Tab.Screen
        name="HomeTab"
        component={HomeNavigator}
        options={{tabBarLabel: t('หาร้าน')}}
      />
      <Tab.Screen
        name="ExploreTab"
        component={ExploreNavigator}
        options={{tabBarLabel: t('หมวดหมู่')}}
      />
      <Tab.Screen
        name="LikesTab"
        component={LikesScreen}
        options={{tabBarLabel: t('ถูกใจ')}}
      />
      <Tab.Screen
        name="HistoryTab"
        component={HistoryScreen}
        options={{tabBarLabel: t('ประวัติ')}}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileNavigator}
        options={{
          tabBarLabel: t('โปรไฟล์'),
          tabBarBadge: notifications?.unread_count || undefined,
          tabBarBadgeStyle: {
            backgroundColor: COLORS.accent,
            color: '#FFF',
            fontSize: 10,
          },
        }}
      />
    </Tab.Navigator>
  );
};

export default MainTabNavigator;
