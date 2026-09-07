/**
 * Explore Stack — Browse categories and filtered results.
 */

import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';

import ExploreCategoriesScreen from '@/screens/explore/ExploreCategoriesScreen';
import CategoryResultsScreen from '@/screens/explore/CategoryResultsScreen';
import {ExploreStackParamList} from '../types';

const Stack = createNativeStackNavigator<ExploreStackParamList>();

const ExploreNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{headerShown: false}}>
      <Stack.Screen name="ExploreCategories" component={ExploreCategoriesScreen} />
      <Stack.Screen name="CategoryResults" component={CategoryResultsScreen} />
    </Stack.Navigator>
  );
};

export default ExploreNavigator;
