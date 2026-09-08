/**
 * Profile Stack — Profile, Settings, Friend List, Notifications.
 */

import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';

import ProfileHomeScreen from '@/screens/profile/ProfileHomeScreen';
import SettingsScreen from '@/screens/profile/SettingsScreen';
import FriendListScreen from '@/screens/profile/FriendListScreen';
import NotificationsScreen from '@/screens/profile/NotificationsScreen';
import HistoryScreen from '@/screens/history/HistoryScreen';
import {ProfileStackParamList} from '../types';

const Stack = createNativeStackNavigator<ProfileStackParamList>();

const ProfileNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{headerShown: false}}>
      <Stack.Screen name="ProfileHome" component={ProfileHomeScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="FriendList" component={FriendListScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="History" component={HistoryScreen} />
    </Stack.Navigator>
  );
};

export default ProfileNavigator;
