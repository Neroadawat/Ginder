import {useEffect} from 'react';
import {AppState} from 'react-native';
import {useQueryClient} from '@tanstack/react-query';
import {useAuthStore} from '@/stores/authStore';
import {setupFCM, setupForegroundMessageHandler} from '@/services/fcm';

export const usePushNotifications = () => {
  const userId = useAuthStore(state => state.userId);
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  const queryClient = useQueryClient();
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
    const unsubscribeMessage = setupForegroundMessageHandler(refresh);
    const appState = AppState.addEventListener('change', state => {
      if (state === 'active') {
        refresh();
      }
    });
    return () => {
      cancelled = true;
      unsubscribeToken?.();
      unsubscribeMessage();
      appState.remove();
    };
  }, [isAuthenticated, userId, queryClient]);
};
