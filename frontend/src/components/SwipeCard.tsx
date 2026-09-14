/** Restaurant cards keep their own image view and animation while in the stack. */
import React, {forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState} from 'react';
import {Image, View, Text, StyleSheet, Dimensions, TouchableOpacity} from 'react-native';
import {GestureDetector, Gesture} from 'react-native-gesture-handler';
import Animated, {useSharedValue, useAnimatedStyle, withSpring, withTiming, Easing, runOnJS, interpolate, Extrapolation} from 'react-native-reanimated';
import {RestaurantCard as RestaurantCardType} from '@/types/restaurant';
import {getRestaurantImageUri} from '@/constants/restaurantImages';
import RestaurantCardContent from './RestaurantCardContent';
import AppIcon from './AppIcon';

const {width: SCREEN_WIDTH} = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.3;
interface SwipeCardProps {
  restaurants: RestaurantCardType[];
  /** Return false to restore the card when the server rejects a vote. */
  onSwipe: (restaurant: RestaurantCardType, liked: boolean) => void | Promise<boolean>;
  onDeckEmpty: () => void;
}
interface CardHandle { swipe: (liked: boolean) => void; }
interface CardLayerProps {
  restaurant: RestaurantCardType;
  active: boolean;
  disabled: boolean;
  onComplete: (liked: boolean) => void;
}

const CardLayer = forwardRef<CardHandle, CardLayerProps>(({restaurant, active, disabled, onComplete}, ref) => {
  const translateX = useSharedValue(0);
  const exiting = useSharedValue(false);
  const animateOut = (liked: boolean) => {
    'worklet';
    if (exiting.value) {
      return;
    }
    exiting.value = true;
    translateX.value = withTiming(liked ? SCREEN_WIDTH * 1.5 : -SCREEN_WIDTH * 1.5,
      {duration: 200, easing: Easing.out(Easing.cubic)}, finished => {
        if (finished) {
          // Leave this card offscreen until React removes it. Never reset the
          // outgoing image into view while the JS thread is changing cards.
          runOnJS(onComplete)(liked);
        } else {
          exiting.value = false;
        }
      });
  };
  useImperativeHandle(ref, () => ({swipe: liked => {
    if (active && !disabled) {
      animateOut(liked);
    }
  }}));
  const gesture = Gesture.Pan()
    .enabled(active && !disabled)
    .onUpdate(event => {
      if (!exiting.value) {
        translateX.value = event.translationX;
      }
    })
    .onEnd(event => {
      if (exiting.value) {
        return;
      }
      if (Math.abs(event.translationX) > SWIPE_THRESHOLD) {
        animateOut(event.translationX > 0);
      } else {
        translateX.value = withSpring(0);
      }
    });
  const animatedStyle = useAnimatedStyle(() => ({transform: [
    {translateX: translateX.value},
    {rotate: `${interpolate(translateX.value, [-SCREEN_WIDTH, 0, SCREEN_WIDTH], [-15, 0, 15], Extrapolation.CLAMP)}deg`},
  ]}));
  const likeOpacity = useAnimatedStyle(() => ({opacity: interpolate(translateX.value, [0, SWIPE_THRESHOLD], [0, 1], Extrapolation.CLAMP)}));
  const skipOpacity = useAnimatedStyle(() => ({opacity: interpolate(translateX.value, [-SWIPE_THRESHOLD, 0], [1, 0], Extrapolation.CLAMP)}));
  return (
    <GestureDetector gesture={gesture}>
      <Animated.View pointerEvents={active ? 'auto' : 'none'} style={[styles.card, styles.nextCard, animatedStyle]}>
        <Animated.View style={[styles.overlay, styles.likeOverlay, likeOpacity]}>
          <Text style={styles.overlayText}>LIKE ❤️</Text>
        </Animated.View>
        <Animated.View style={[styles.overlay, styles.skipOverlay, skipOpacity]}>
          <Text style={styles.overlayText}>SKIP ✕</Text>
        </Animated.View>
        <RestaurantCardContent restaurant={restaurant} />
      </Animated.View>
    </GestureDetector>
  );
});

const SwipeCard = ({restaurants, onSwipe, onDeckEmpty}: SwipeCardProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const activeCardRef = useRef<CardHandle>(null);
  const handleSwipeComplete = useCallback(async (liked: boolean) => {
    if (submittingRef.current) {
      return;
    }
    const restaurant = restaurants[currentIndex];
    if (!restaurant) {
      return;
    }
    submittingRef.current = true;
    setIsSubmitting(true);
    const swipedIndex = currentIndex;
    setCurrentIndex(swipedIndex + 1);
    try {
      const accepted = await onSwipe(restaurant, liked);
      if (accepted === false) {
        setCurrentIndex(swipedIndex);
      } else if (swipedIndex + 1 >= restaurants.length) {
        onDeckEmpty();
      }
    } catch {
      // A rejected request must restore the removed card as well.
      setCurrentIndex(swipedIndex);
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  }, [currentIndex, restaurants, onSwipe, onDeckEmpty]);

  useEffect(() => {
    restaurants.slice(currentIndex + 1, currentIndex + 3).forEach(item => {
      const uri = getRestaurantImageUri(item);
      if (/^https?:/.test(uri)) {
        Image.prefetch(uri).catch(() => undefined);
      }
    });
  }, [currentIndex, restaurants]);

  if (currentIndex >= restaurants.length) {
    return null;
  }
  return (
    <View style={styles.container}>
      <View style={styles.cardStack}>
        {restaurants.slice(currentIndex, currentIndex + 3).map((restaurant, offset) => (
          <CardLayer
            key={restaurant.id}
            ref={offset === 0 ? activeCardRef : undefined}
            restaurant={restaurant}
            active={offset === 0}
            disabled={isSubmitting}
            onComplete={handleSwipeComplete}
          />
        )).reverse()}
      </View>
      <View style={styles.actions}>
        <TouchableOpacity style={[styles.actionButton, styles.skipButton]} onPress={() => activeCardRef.current?.swipe(false)} disabled={isSubmitting} accessibilityLabel="Skip restaurant">
          <AppIcon name="close" size={34} />
        </TouchableOpacity>
        <View style={styles.counterPill}><Text style={styles.counter}>{currentIndex + 1} of {restaurants.length}</Text></View>
        <TouchableOpacity style={[styles.actionButton, styles.likeButton]} onPress={() => activeCardRef.current?.swipe(true)} disabled={isSubmitting} accessibilityLabel="Like restaurant">
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
