/**
 * Firebase Cloud Messaging setup — push notification handling.
 */

import {
  AuthorizationStatus,
  getMessaging,
  getToken,
  getInitialNotification,
  onMessage,
  onNotificationOpenedApp,
  onTokenRefresh,
  requestPermission,
  setBackgroundMessageHandler,
  RemoteMessage,
} from '@react-native-firebase/messaging';

import {userApi} from './api/userApi';
import {PermissionsAndroid, Platform} from 'react-native';
import {getApps} from '@react-native-firebase/app';
import {FCM_ENABLED} from './config';
import {useAuthStore} from '@/stores/authStore';

const isFCMAvailable = () => FCM_ENABLED && getApps().length > 0;

/**
 * Request push notification permission and register FCM token.
 */
export async function setupFCM(userId: string): Promise<() => void> {
  if (!isFCMAvailable()) {
    return () => {};
  }
  const messaging = getMessaging();
  const authStatus =
    Platform.OS === 'android'
      ? Number(Platform.Version) < 33 ||
        (await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
        )) === PermissionsAndroid.RESULTS.GRANTED
        ? AuthorizationStatus.AUTHORIZED
        : AuthorizationStatus.DENIED
      : await requestPermission(messaging);
  const enabled =
    authStatus === AuthorizationStatus.AUTHORIZED ||
    authStatus === AuthorizationStatus.PROVISIONAL;

  if (enabled) {
    const saveToken = async (value: string) => {
      if (useAuthStore.getState().userId !== userId) {
        return;
      }
      try {
        await userApi.updateFCMToken(value);
      } catch {
        // Retry registration on the next login without interrupting the app.
      }
    };
    const token = await getToken(messaging);
    if (token) {
      await saveToken(token);
    }

    // Listen for token refresh
    if (useAuthStore.getState().userId === userId) {
      return onTokenRefresh(messaging, saveToken);
    }
  }
  return () => {};
}

/**
 * Handle incoming foreground messages.
 */
export function setupForegroundMessageHandler(
  onUpdate: (message: RemoteMessage) => void,
): () => void {
  if (!isFCMAvailable()) {
    return () => {};
  }
  return onMessage(getMessaging(), async message => {
    onUpdate(message);
  });
}

/** Consume notification taps only while this authenticated screen is mounted. */
export function setupNotificationOpenHandler(
  onOpen: (message: RemoteMessage) => void,
): () => void {
  if (!isFCMAvailable()) {
    return () => {};
  }
  let cancelled = false;
  const messaging = getMessaging();
  const unsubscribe = onNotificationOpenedApp(messaging, message => {
    if (!cancelled) {
      onOpen(message);
    }
  });
  getInitialNotification(messaging)
    .then(message => {
      if (!cancelled && message) {
        onOpen(message);
      }
    })
    .catch(() => {});
  return () => {
    cancelled = true;
    unsubscribe();
  };
}

/**
 * Handle background/quit state messages (must be called at app entry).
 */
export function setupBackgroundMessageHandler(): void {
  if (isFCMAvailable()) {
    // Android displays notification payloads; refresh data when the app resumes.
    setBackgroundMessageHandler(getMessaging(), async () => {});
  }
}
