/**
 * SwipeCard — Tinder-style swipeable restaurant card stack.
 * Uses react-native-gesture-handler + reanimated for smooth gestures.
 */

import React, {useCallback, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import {GestureDetector, Gesture} from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';

import {RestaurantCard as RestaurantCardType} from '@/types/restaurant';
import RestaurantCardContent from './RestaurantCardContent';
import AppIcon from './AppIcon';

const {width: SCREEN_WIDTH} = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.3;

interface SwipeCardProps {
  restaurants: RestaurantCardType[];
  onSwipe: (restaurant: RestaurantCardType, liked: boolean) => void;
  onDeckEmpty: () => void;
}

const SwipeCard = ({restaurants, onSwipe, onDeckEmpty}: SwipeCardProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const translateX = useSharedValue(0);

  const handleSwipeComplete = useCallback(
    (liked: boolean) => {
      const restaurant = restaurants[currentIndex];
      if (restaurant) {
        onSwipe(restaurant, liked);
      }

      if (currentIndex + 1 >= restaurants.length) {
        onDeckEmpty();
      }

      setCurrentIndex(prev => prev + 1);
    },
    [currentIndex, restaurants, onSwipe, onDeckEmpty],
  );

  const gesture = Gesture.Pan()
    .onUpdate(event => {
      translateX.value = event.translationX;
    })
    .onEnd(event => {
      if (event.translationX > SWIPE_THRESHOLD) {
        translateX.value = withSpring(SCREEN_WIDTH * 1.5, {}, () => {
          runOnJS(handleSwipeComplete)(true);
          translateX.value = 0;
        });
      } else if (event.translationX < -SWIPE_THRESHOLD) {
        translateX.value = withSpring(-SCREEN_WIDTH * 1.5, {}, () => {
          runOnJS(handleSwipeComplete)(false);
          translateX.value = 0;
        });
      } else {
        translateX.value = withSpring(0);
      }
    });

  const animatedStyle = useAnimatedStyle(() => {
    const rotate = interpolate(
      translateX.value,
      [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
      [-15, 0, 15],
      Extrapolation.CLAMP,
    );
    return {
      transform: [{translateX: translateX.value}, {rotate: `${rotate}deg`}],
    };
  });

  const likeOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [0, SWIPE_THRESHOLD],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }));

  const skipOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [-SWIPE_THRESHOLD, 0],
      [1, 0],
      Extrapolation.CLAMP,
    ),
  }));

  if (currentIndex >= restaurants.length) {
    return null;
  }

  const currentRestaurant = restaurants[currentIndex];

  return (
    <View style={styles.container}>
      <GestureDetector gesture={gesture}>
        <Animated.View style={[styles.card, animatedStyle]}>
          {/* Like / Skip overlays */}
          <Animated.View
            style={[styles.overlay, styles.likeOverlay, likeOpacity]}>
            <Text style={styles.overlayText}>LIKE ❤️</Text>
          </Animated.View>
          <Animated.View
            style={[styles.overlay, styles.skipOverlay, skipOpacity]}>
            <Text style={styles.overlayText}>SKIP ✕</Text>
          </Animated.View>

          <RestaurantCardContent restaurant={currentRestaurant} />
        </Animated.View>
      </GestureDetector>
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.skipButton]}
          onPress={() => handleSwipeComplete(false)}
          accessibilityLabel="Skip restaurant">
          <AppIcon name="close" size={34} />
        </TouchableOpacity>
        <View style={styles.counterPill}>
          <Text style={styles.counter}>
            {currentIndex + 1} of {restaurants.length}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.actionButton, styles.likeButton]}
          onPress={() => handleSwipeComplete(true)}
          accessibilityLabel="Like restaurant">
          <AppIcon name="heart" size={28} color="#FFF" filled />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    backgroundColor: '#050505',
  },
  card: {
    flex: 1,
    width: '100%',
    backgroundColor: '#111',
    overflow: 'hidden',
  },
  overlay: {
    position: 'absolute',
    top: 20,
    zIndex: 10,
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 3,
  },
  likeOverlay: {
    right: 20,
    borderColor: '#38A169',
    backgroundColor: 'rgba(56, 161, 105, 0.1)',
  },
  skipOverlay: {
    left: 20,
    borderColor: '#E53E3E',
    backgroundColor: 'rgba(229, 62, 62, 0.1)',
  },
  overlayText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#333',
  },
  counter: {
    fontSize: 12,
    color: '#D8D2D2',
  },
  actions: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 78,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 20,
  },
  actionButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#353131',
    elevation: 5,
  },
  skipButton: {backgroundColor: '#090909'},
  likeButton: {backgroundColor: '#E52B2F'},
  counterPill: {
    backgroundColor: 'rgba(5,5,5,0.78)',
    borderWidth: 1,
    borderColor: '#3A3636',
    borderRadius: 22,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
});

export default SwipeCard;
