/**
 * Root Navigator — picks the right branch of the startup flow.
 *
 * Requirement 2.5 fixes the order:
 *
 *   Consent → Authentication → Location Permission → Main App
 *
 * Consent comes first because the Privacy Policy is what explains why the app
 * needs a location; asking for GPS before that would be backwards. The location
 * gate comes after login because Login and Sign Up do not use location, and
 * walling them off would leave a user who denied with no way to read the terms
 * or switch accounts.
 */

import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';

import ConsentScreen from '@/screens/ConsentScreen';
import PermissionGateScreen from '@/screens/PermissionGateScreen';
import {useAuthStore} from '@/stores/authStore';
import {useConsentStore} from '@/stores/consentStore';
import {selectHasLocation, useLocationStore} from '@/stores/locationStore';
import AuthNavigator from './AuthNavigator';
import MainTabNavigator from './MainTabNavigator';
import SessionNavigator from './SessionNavigator';
import {RootStackParamList} from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

interface Props {
  /** Prompts for location and fetches a fix, triggered from the gate screen. */
  onRequestLocation: () => Promise<void>;
}

const RootNavigator = ({onRequestLocation}: Props) => {
  const hasConsented = useConsentStore(state => state.hasConsented);
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  const hasLocation = useLocationStore(selectHasLocation);

  if (!hasConsented) {
    return (
      <Stack.Navigator screenOptions={{headerShown: false}}>
        <Stack.Screen name="Consent" component={ConsentScreen} />
      </Stack.Navigator>
    );
  }

  if (!isAuthenticated) {
    return (
      <Stack.Navigator screenOptions={{headerShown: false}}>
        <Stack.Screen name="Auth" component={AuthNavigator} />
      </Stack.Navigator>
    );
  }

  if (!hasLocation) {
    return (
      <Stack.Navigator screenOptions={{headerShown: false}}>
        <Stack.Screen name="PermissionGate">
          {() => <PermissionGateScreen onRequestPermission={onRequestLocation} />}
        </Stack.Screen>
      </Stack.Navigator>
    );
  }

  return (
    <Stack.Navigator screenOptions={{headerShown: false}}>
      <Stack.Screen name="Main" component={MainTabNavigator} />
      <Stack.Screen
        name="Session"
        component={SessionNavigator}
        options={{animation: 'slide_from_right'}}
      />
    </Stack.Navigator>
  );
};

export default RootNavigator;
