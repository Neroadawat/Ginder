/**
 * Home Stack — Solo Mode swipe, filter settings, expand radius.
 */

import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';

import SoloSwipeScreen from '@/screens/home/SoloSwipeScreen';
import FilterSettingsScreen from '@/screens/home/FilterSettingsScreen';
import ExpandRadiusScreen from '@/screens/home/ExpandRadiusScreen';
import {HomeStackParamList} from '../types';

const Stack = createNativeStackNavigator<HomeStackParamList>();

const HomeNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{headerShown: false}}>
      <Stack.Screen name="SoloSwipe" component={SoloSwipeScreen} />
      <Stack.Screen
        name="FilterSettings"
        component={FilterSettingsScreen}
        options={{presentation: 'modal'}}
      />
      <Stack.Screen
        name="ExpandRadius"
        component={ExpandRadiusScreen}
        options={{presentation: 'modal'}}
      />
    </Stack.Navigator>
  );
};

export default HomeNavigator;
