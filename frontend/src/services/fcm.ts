/**
 * Firebase Cloud Messaging setup — push notification handling.
 */

import messaging from '@react-native-firebase/messaging';

import {userApi} from './api/userApi';

/**
 * Request push notification permission and register FCM token.
 */
export async function setupFCM(): Promise<void> {
  const authStatus = await messaging().requestPermission();
  const enabled =
    authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
    authStatus === messaging.AuthorizationStatus.PROVISIONAL;

  if (enabled) {
    const token = await messaging().getToken();
    if (token) {
      await userApi.updateFCMToken(token);
    }

    // Listen for token refresh
    messaging().onTokenRefresh(async (newToken) => {
      await userApi.updateFCMToken(newToken);
    });
  }
}

/**
 * Handle incoming foreground messages.
 */
export function setupForegroundMessageHandler(): () => void {
  return messaging().onMessage(async (remoteMessage) => {
    // TODO: Show in-app notification banner
    console.log('FCM foreground message:', remoteMessage);
  });
}

/**
 * Handle background/quit state messages (must be called at app entry).
 */
export function setupBackgroundMessageHandler(): void {
  messaging().setBackgroundMessageHandler(async (remoteMessage) => {
    // TODO: Process background notification
    console.log('FCM background message:', remoteMessage);
  });
}
