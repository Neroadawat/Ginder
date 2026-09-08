/**
 * SpinWheel — the tie-breaker wheel.
 *
 * Shows the actual candidates that went into the draw: only the tied
 * restaurants for a tie-break, or the whole deck when nobody liked anything
 * (requirement 9.4, 9.5).
 *
 * The winner is decided on the server, so this animation is presentation only.
 * It lands on the real winner's slice rather than picking one itself, which is
 * what lets every participant watch the same outcome.
 */

import React, {useEffect, useMemo, useRef} from 'react';
import {Animated, Easing, StyleSheet, Text, View} from 'react-native';

const SLICE_COLORS = [
  '#FF6B6B',
  '#FFA36B',
  '#FFD36B',
  '#8FD46B',
  '#6BC7D4',
  '#6B8FD4',
  '#A96BD4',
  '#D46BA9',
];

const FULL_SPINS = 4;
const SPIN_DURATION_MS = 4000;

interface Props {
  /** Names of the restaurants on the wheel, in a stable order. */
  candidateNames: string[];
  /** Index of the winning slice. Omit while the result is still unknown. */
  winnerIndex?: number;
}

const SpinWheel = ({candidateNames, winnerIndex}: Props) => {
  const rotation = useRef(new Animated.Value(0)).current;

  // Where the wheel should come to rest so the winner sits under the pointer.
  const targetDegrees = useMemo(() => {
    const baseSpins = FULL_SPINS * 360;
    if (winnerIndex === undefined || candidateNames.length === 0) {
      return baseSpins;
    }
    const sliceAngle = 360 / candidateNames.length;
    // Aim at the middle of the winner's slice.
    const offset = winnerIndex * sliceAngle + sliceAngle / 2;
    return baseSpins + (360 - offset);
  }, [candidateNames.length, winnerIndex]);

  useEffect(() => {
    rotation.setValue(0);
    Animated.timing(rotation, {
      toValue: 1,
      duration: SPIN_DURATION_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [rotation, targetDegrees]);

  const spin = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', `${targetDegrees}deg`],
  });

  const visible = candidateNames.slice(0, SLICE_COLORS.length);
  const hiddenCount = candidateNames.length - visible.length;

  return (
    <View style={styles.container}>
      <Animated.View
        style={[styles.wheel, {transform: [{rotate: spin}]}]}
        accessibilityLabel={`Wheel with ${candidateNames.length} restaurants`}>
        <View style={styles.wheelInner}>
          <Text style={styles.wheelEmoji}>🎡</Text>
        </View>
      </Animated.View>

      <View style={styles.pointer}>
        <Text style={styles.pointerText}>▼</Text>
      </View>

      {/* The legend stays upright while the wheel turns, so names remain
          readable throughout the spin. */}
      <View style={styles.legend}>
        {visible.map((name, index) => (
          <View key={`${name}-${index}`} style={styles.legendRow}>
            <View
              style={[styles.swatch, {backgroundColor: SLICE_COLORS[index]}]}
            />
            <Text style={styles.legendText} numberOfLines={1}>
              {name}
            </Text>
          </View>
        ))}
        {hiddenCount > 0 && (
          <Text style={styles.legendMore}>and {hiddenCount} more</Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    width: '100%',
  },
  wheel: {
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: '#FFF0F0',
    borderWidth: 4,
    borderColor: '#FF6B6B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  wheelInner: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  wheelEmoji: {
    fontSize: 72,
  },
  pointer: {
    position: 'absolute',
    top: -12,
  },
  pointerText: {
    fontSize: 26,
    color: '#FF6B6B',
  },
  legend: {
    marginTop: 24,
    width: '100%',
    gap: 8,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  swatch: {
    width: 14,
    height: 14,
    borderRadius: 4,
  },
  legendText: {
    flex: 1,
    fontSize: 14,
    color: '#444',
  },
  legendMore: {
    fontSize: 13,
    color: '#999',
    marginLeft: 24,
  },
});

export default SpinWheel;
