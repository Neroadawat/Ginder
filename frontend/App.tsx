import React from 'react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {DarkTheme, NavigationContainer} from '@react-navigation/native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {StyleSheet} from 'react-native';

import RootNavigator from '@/navigation/RootNavigator';
import {linking} from '@/navigation/linking';
import SplashScreen from '@/screens/SplashScreen';
import {useAppBootstrap} from '@/hooks/useAppBootstrap';
import {COLORS} from '@/constants/theme';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 1000 * 60 * 5, // 5 minutes
    },
  },
});

const navigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: COLORS.background,
    card: COLORS.surface,
    border: COLORS.border,
    primary: COLORS.accent,
    text: COLORS.text,
  },
};

const App = () => {
  // Restores consent and auth state, and checks (without prompting) whether
  // location was already granted.
  const {isReady, requestLocation} = useAppBootstrap();

  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          {!isReady ? (
            <SplashScreen />
          ) : (
            <NavigationContainer linking={linking} theme={navigationTheme}>
              <RootNavigator onRequestLocation={requestLocation} />
            </NavigationContainer>
          )}
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default App;
