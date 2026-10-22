import {t, useTranslation} from '@/i18n';
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
import Svg, {Circle, Path, Text as SvgText} from 'react-native-svg';

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
export const SPIN_DURATION_MS = 4000;

interface Props {
  /** Names of the restaurants on the wheel, in a stable order. */
  candidateNames: string[];
  /** Index of the winning slice. Omit while the result is still unknown. */
  winnerIndex?: number;
}

const SpinWheel = ({candidateNames, winnerIndex}: Props) => {
  useTranslation();
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
        accessibilityLabel={t('Wheel with {count} restaurants', {
          count: candidateNames.length,
        })}>
        <Svg width={220} height={220} viewBox="0 0 220 220">
          {candidateNames.map((name, index) => {
            const angle = (2 * Math.PI) / candidateNames.length;
            const start = index * angle - Math.PI / 2;
            const end = start + angle;
            const middle = start + angle / 2;
            const x = (a: number, radius: number) => 110 + radius * Math.cos(a);
            const y = (a: number, radius: number) => 110 + radius * Math.sin(a);
            return (
              <React.Fragment key={`${name}-${index}`}>
                {candidateNames.length === 1 ? (
                  <Circle cx={110} cy={110} r={104} fill={SLICE_COLORS[0]} />
                ) : (
                  <Path
                    d={`M110 110 L${x(start, 104)} ${y(
                      start,
                      104,
                    )} A104 104 0 ${angle > Math.PI ? 1 : 0} 1 ${x(
                      end,
                      104,
                    )} ${y(end, 104)} Z`}
                    fill={SLICE_COLORS[index % SLICE_COLORS.length]}
                    stroke="#FFF"
                    strokeWidth={1}
                  />
                )}
                <SvgText
                  x={x(middle, 78)}
                  y={y(middle, 78) + 4}
                  textAnchor="middle"
                  fontSize={13}
                  fontWeight="700"
                  fill="#171717">
                  {index + 1}
                </SvgText>
              </React.Fragment>
            );
          })}
          <Circle cx={110} cy={110} r={38} fill="#FFF" />
          <SvgText
            x={110}
            y={115}
            textAnchor="middle"
            fontSize={16}
            fill="#171717">
            {t('สุ่มร้าน')}
          </SvgText>
        </Svg>
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
              {index + 1}. {name}
            </Text>
          </View>
        ))}
        {hiddenCount > 0 && (
          <Text style={styles.legendMore}>
            {t('and ')}
            {hiddenCount}
            {t(' more')}
          </Text>
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
    backgroundColor: '#D9D9D9',
    borderWidth: 4,
    borderColor: '#F2F2F2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pointer: {
    position: 'absolute',
    top: -12,
  },
  pointerText: {
    fontSize: 26,
    color: '#FFF',
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
    color: '#FFF',
  },
  legendMore: {
    fontSize: 13,
    color: '#999',
    marginLeft: 24,
  },
});

export default SpinWheel;
