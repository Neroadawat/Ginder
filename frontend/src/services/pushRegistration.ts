import axios from 'axios';
import {getApps} from '@react-native-firebase/app';
import {deleteToken, getMessaging} from '@react-native-firebase/messaging';
import {API_BASE_URL, FCM_ENABLED} from './config';

/** Clear the signed-out account without touching a later login. */
export async function clearFCMRegistration(
  accessToken: string | null,
  signedOutUserId: string | null,
  currentUserId: () => string | null,
): Promise<void> {
  if (!FCM_ENABLED || getApps().length === 0) {
    return;
  }
  try {
    if (accessToken) {
      await axios.put(
        `${API_BASE_URL}/users/me/fcm-token`,
        {fcm_token: null},
        {
          headers: {Authorization: `Bearer ${accessToken}`},
          timeout: 10000,
        },
      );
    }
  } finally {
    const activeUserId = currentUserId();
    if (!activeUserId || activeUserId === signedOutUserId) {
      await deleteToken(getMessaging());
    }
  }
}
