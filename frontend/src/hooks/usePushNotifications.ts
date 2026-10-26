import {useEffect} from 'react';
import {Alert, AppState} from 'react-native';
import {useNavigation, NavigationProp} from '@react-navigation/native';
import {useQueryClient} from '@tanstack/react-query';
import {useAuthStore} from '@/stores/authStore';
import {
  setupFCM,
  setupForegroundMessageHandler,
  setupNotificationOpenHandler,
} from '@/services/fcm';
import type {RemoteMessage} from '@react-native-firebase/messaging';
import {RootStackParamList} from '@/navigation/types';
import {useSessionStore} from '@/stores/sessionStore';
import {isCurrentAccountInvite} from '@/utils/pushNotification';
import {t} from '@/i18n';

const openedMessages = new Set<string>();

export const usePushNotifications = () => {
  const userId = useAuthStore(state => state.userId);
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  const queryClient = useQueryClient();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  useEffect(() => {
    if (!isAuthenticated || !userId) {
      return;
    }
    let cancelled = false;
    let unsubscribeToken: (() => void) | undefined;
    setupFCM(userId)
      .then(unsubscribe => {
        if (cancelled) {
          unsubscribe();
        } else {
          unsubscribeToken = unsubscribe;
        }
      })
      .catch(() => {});
    const refresh = () => {
      queryClient.invalidateQueries({queryKey: ['notifications']});
      queryClient.invalidateQueries({queryKey: ['session']});
    };
    const currentInvite = (message: RemoteMessage) =>
      !cancelled &&
      useAuthStore.getState().userId === userId &&
      isCurrentAccountInvite(message, userId);
    const openInvitations = (message: RemoteMessage) => {
      if (!currentInvite(message) || useSessionStore.getState().isInSession) {
        return;
      }
      const key = message.messageId ? `${userId}:${message.messageId}` : null;
      if (key && openedMessages.has(key)) {
        return;
      }
      if (key) {
        openedMessages.add(key);
        if (openedMessages.size > 100) {
          openedMessages.delete(openedMessages.values().next().value!);
        }
      }
      refresh();
      navigation.navigate('Main', {
        screen: 'ProfileTab',
        params: {screen: 'Notifications'},
      });
    };
    const unsubscribeMessage = setupForegroundMessageHandler(message => {
      if (!currentInvite(message)) {
        return;
      }
      refresh();
      // Never interrupt active party play or navigate away from its timer.
      if (!useSessionStore.getState().isInSession) {
        Alert.alert(t('คำเชิญ'), t('คุณได้รับคำเชิญเข้าห้องใหม่'), [
          {text: t('ยกเลิก'), style: 'cancel'},
          {text: t('ดูคำเชิญ'), onPress: () => openInvitations(message)},
        ]);
      }
    });
    const unsubscribeOpen = setupNotificationOpenHandler(openInvitations);
    const appState = AppState.addEventListener('change', state => {
      if (state === 'active') {
        refresh();
      }
    });
    return () => {
      cancelled = true;
      unsubscribeToken?.();
      unsubscribeMessage();
      unsubscribeOpen();
      appState.remove();
    };
  }, [isAuthenticated, userId, queryClient, navigation]);
};
