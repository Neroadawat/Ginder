import type {RemoteMessage} from '@react-native-firebase/messaging';

/** A queued push must never act on a different account after login/logout. */
export const isCurrentAccountInvite = (
  message: RemoteMessage,
  userId: string | null,
): boolean =>
  Boolean(
    userId &&
      message.data?.recipient_id === userId &&
      message.data?.type === 'session_invite',
  );
