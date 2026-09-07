/**
 * Root Navigator — decides between the auth flow, the location gate,
 * and the main app.
 *
 * Order matters: users log in first, then grant location. Asking for GPS
 * before they have seen what the app does is poor UX, but location is still
 * mandatory before reaching any restaurant feature (requirement 2.8).
 */

import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';

import {useAuthStore} from '@/stores/authStore';
import {selectHasLocation, useLocationStore} from '@/stores/locationStore';
import AuthNavigator from './AuthNavigator';
import MainTabNavigator from './MainTabNavigator';
import SessionNavigator from './SessionNavigator';
import PermissionGateScreen from '@/screens/PermissionGateScreen';
import {RootStackParamList} from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

interface Props {
  /** Re-runs the permission request and location fetch from the gate screen. */
  onRetryLocation: () => Promise<void>;
}

const RootNavigator = ({onRetryLocation}: Props) => {
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  const hasLocation = useLocationStore(selectHasLocation);

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
          {() => <PermissionGateScreen onRetry={onRetryLocation} />}
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
