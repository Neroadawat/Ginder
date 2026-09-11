/**
 * SwipeCard — Tinder-style swipeable restaurant card stack.
 * Uses react-native-gesture-handler + reanimated for smooth gestures.
 */

import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  Image,
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
  withTiming,
  Easing,
  runOnJS,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';

import {RestaurantCard as RestaurantCardType} from '@/types/restaurant';
import RestaurantCardContent from './RestaurantCardContent';
import AppIcon from './AppIcon';
import {getPlaceholderImage} from '@/constants/placeholders';

const {width: SCREEN_WIDTH} = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.3;

interface SwipeCardProps {
  restaurants: RestaurantCardType[];
  /** Return false to keep the current card visible (for example, API failure). */
  onSwipe: (restaurant: RestaurantCardType, liked: boolean) => void | Promise<boolean>;
  onDeckEmpty: () => void;
}

const SwipeCard = ({restaurants, onSwipe, onDeckEmpty}: SwipeCardProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const translateX = useSharedValue(0);

  const handleSwipeComplete = useCallback(
    async (liked: boolean) => {
      if (submittingRef.current) {
        return;
      }
      const restaurant = restaurants[currentIndex];
      if (restaurant) {
        submittingRef.current = true;
        setIsSubmitting(true);
        // Reveal the already-rendered next card immediately. The request can
        // finish in the background without making the UI wait on the network.
        const swipedIndex = currentIndex;
        setCurrentIndex(swipedIndex + 1);
        try {
          const accepted = await onSwipe(restaurant, liked);
          if (accepted === false) {
            setCurrentIndex(swipedIndex);
            return;
          }
          if (swipedIndex + 1 >= restaurants.length) {
            onDeckEmpty();
          }
        } finally {
          submittingRef.current = false;
          setIsSubmitting(false);
        }
      }
    },
    [currentIndex, restaurants, onSwipe, onDeckEmpty],
  );

  const gesture = Gesture.Pan()
    .enabled(!isSubmitting)
    .onUpdate(event => {
      translateX.value = event.translationX;
    })
    .onEnd(event => {
      if (event.translationX > SWIPE_THRESHOLD) {
        translateX.value = withTiming(SCREEN_WIDTH * 1.5, {duration: 165, easing: Easing.out(Easing.cubic)}, () => {
          runOnJS(handleSwipeComplete)(true);
          translateX.value = 0;
        });
      } else if (event.translationX < -SWIPE_THRESHOLD) {
        translateX.value = withTiming(-SCREEN_WIDTH * 1.5, {duration: 165, easing: Easing.out(Easing.cubic)}, () => {
          runOnJS(handleSwipeComplete)(false);
          translateX.value = 0;
        });
      } else {
        translateX.value = withSpring(0);
      }
    });

  useEffect(() => {
    restaurants.slice(currentIndex + 1, currentIndex + 3).forEach(item => {
      Image.prefetch(
        item.photo_url || getPlaceholderImage(item.primary_category),
      ).catch(() => undefined);
    });
  }, [currentIndex, restaurants]);

  const animateButtonSwipe = (liked: boolean) => {
    if (submittingRef.current) {
      return;
    }
    translateX.value = withTiming(
      liked ? SCREEN_WIDTH * 1.5 : -SCREEN_WIDTH * 1.5,
      {duration: 165, easing: Easing.out(Easing.cubic)},
      () => {
        runOnJS(handleSwipeComplete)(liked);
        translateX.value = 0;
      },
    );
  };

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
  const nextRestaurant = restaurants[currentIndex + 1];

  return (
    <View style={styles.container}>
      <View style={styles.cardStack}>
        {nextRestaurant && (
          <View style={[styles.card, styles.nextCard]} pointerEvents="none">
            <RestaurantCardContent restaurant={nextRestaurant} />
          </View>
        )}
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
      </View>
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.skipButton]}
          onPress={() => animateButtonSwipe(false)}
          disabled={isSubmitting}
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
          onPress={() => animateButtonSwipe(true)}
          disabled={isSubmitting}
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
  cardStack: {flex: 1, width: '100%', backgroundColor: '#111'},
  nextCard: {...StyleSheet.absoluteFillObject},
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
