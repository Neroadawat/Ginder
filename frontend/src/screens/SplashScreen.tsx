/**
 * Splash Screen — shown while the app restores its session and finds location.
 */

import React from 'react';
import {ActivityIndicator, StyleSheet, Text, View} from 'react-native';

const SplashScreen = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.logo}>🍽️ Ginder</Text>
      <Text style={styles.tagline}>หาร้านมื้อต่อไปไปด้วยกัน</Text>
      <ActivityIndicator
        size="large"
        color="#FF6B6B"
        style={styles.spinner}
        accessibilityLabel="กำลังโหลด"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    fontSize: 40,
    fontWeight: '700',
    color: '#FF6B6B',
  },
  tagline: {
    fontSize: 16,
    color: '#666',
    marginTop: 8,
  },
  spinner: {
    marginTop: 32,
  },
});

export default SplashScreen;
