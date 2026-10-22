import {useCallback} from 'react';
import {BackHandler} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';

/** Android edge-back/button must not dismiss a running party into Solo. */
export const useSessionBackGuard = () => {
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener(
        'hardwareBackPress',
        () => true,
      );
      return () => subscription.remove();
    }, []),
  );
};
