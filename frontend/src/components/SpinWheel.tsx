/**
 * SpinWheel — Animated spinning wheel for tie-breaker resolution.
 * Placeholder implementation — will be enhanced with SVG/canvas later.
 */

import React, {useEffect, useRef} from 'react';
import {View, Text, StyleSheet, Animated, Easing} from 'react-native';

const SpinWheel = () => {
  const rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Auto-spin animation
    Animated.timing(rotation, {
      toValue: 1,
      duration: 4000,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [rotation]);

  const spin = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '1440deg'], // 4 full spins
  });

  return (
    <View style={styles.container}>
      <Animated.View
        style={[styles.wheel, {transform: [{rotate: spin}]}]}
        accessibilityLabel="Spinning wheel animation">
        <Text style={styles.wheelEmoji}>🎡</Text>
      </Animated.View>
      <View style={styles.pointer}>
        <Text style={styles.pointerText}>▼</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  wheel: {
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: '#FFF0F0',
    borderWidth: 4,
    borderColor: '#FF6B6B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  wheelEmoji: {
    fontSize: 80,
  },
  pointer: {
    position: 'absolute',
    top: -10,
  },
  pointerText: {
    fontSize: 28,
    color: '#FF6B6B',
  },
});

export default SpinWheel;
