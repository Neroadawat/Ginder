/**
 * Session Navigator — Create → Lobby → Swipe → Result / SpinWheel flow.
 */

import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';

import CreateSessionScreen from '@/screens/session/CreateSessionScreen';
import LobbyScreen from '@/screens/session/LobbyScreen';
import SessionSwipeScreen from '@/screens/session/SessionSwipeScreen';
import SessionResultScreen from '@/screens/session/SessionResultScreen';
import SpinWheelScreen from '@/screens/session/SpinWheelScreen';
import JoinSessionScreen from '@/screens/session/JoinSessionScreen';
import {SessionStackParamList} from './types';

const Stack = createNativeStackNavigator<SessionStackParamList>();

const SessionNavigator = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        gestureEnabled: false, // Prevent accidental swipe-back during session
      }}>
      <Stack.Screen name="CreateSession" component={CreateSessionScreen} />
      <Stack.Screen name="JoinSession" component={JoinSessionScreen} />
      <Stack.Screen name="Lobby" component={LobbyScreen} />
      <Stack.Screen name="SessionSwipe" component={SessionSwipeScreen} />
      <Stack.Screen name="SessionResult" component={SessionResultScreen} />
      <Stack.Screen
        name="SpinWheel"
        component={SpinWheelScreen}
        options={{animation: 'fade'}}
      />
    </Stack.Navigator>
  );
};

export default SessionNavigator;
