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

const Tab = createBottomTabNavigator<MainTabParamList>();

const MainTabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#FF6B6B',
        tabBarInactiveTintColor: '#999',
        tabBarStyle: {
          backgroundColor: '#FFF',
          borderTopWidth: 1,
          borderTopColor: '#EEE',
          paddingBottom: 5,
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
      }}>
      <Tab.Screen
        name="HomeTab"
        component={HomeNavigator}
        options={{tabBarLabel: 'Home'}}
      />
      <Tab.Screen
        name="ExploreTab"
        component={ExploreNavigator}
        options={{tabBarLabel: 'Explore'}}
      />
      <Tab.Screen
        name="LikesTab"
        component={LikesScreen}
        options={{tabBarLabel: 'Likes'}}
      />
      <Tab.Screen
        name="HistoryTab"
        component={HistoryScreen}
        options={{tabBarLabel: 'History'}}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileNavigator}
        options={{tabBarLabel: 'Profile'}}
      />
    </Tab.Navigator>
  );
};

export default MainTabNavigator;
