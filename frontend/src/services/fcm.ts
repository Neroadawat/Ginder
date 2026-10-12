/**
 * Firebase Cloud Messaging setup — push notification handling.
 */

import {
  AuthorizationStatus,
  getMessaging,
  getToken,
  onMessage,
  onTokenRefresh,
  requestPermission,
  setBackgroundMessageHandler,
} from '@react-native-firebase/messaging';

import {userApi} from './api/userApi';

/**
 * Request push notification permission and register FCM token.
 */
export async function setupFCM(): Promise<void> {
  const messaging = getMessaging();
  const authStatus = await requestPermission(messaging);
  const enabled =
    authStatus === AuthorizationStatus.AUTHORIZED ||
    authStatus === AuthorizationStatus.PROVISIONAL;

  if (enabled) {
    const token = await getToken(messaging);
    if (token) {
      await userApi.updateFCMToken(token);
    }

    // Listen for token refresh
    onTokenRefresh(messaging, async newToken => {
      await userApi.updateFCMToken(newToken);
    });
  }
}

/**
 * Handle incoming foreground messages.
 */
export function setupForegroundMessageHandler(): () => void {
  return onMessage(getMessaging(), async remoteMessage => {
    // TODO: Show in-app notification banner
    console.log('FCM foreground message:', remoteMessage);
  });
}

/**
 * Handle background/quit state messages (must be called at app entry).
 */
export function setupBackgroundMessageHandler(): void {
  setBackgroundMessageHandler(getMessaging(), async remoteMessage => {
    // TODO: Process background notification
    console.log('FCM background message:', remoteMessage);
  });
}
