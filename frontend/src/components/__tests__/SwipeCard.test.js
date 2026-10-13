const React = require('react');
const {act, create} = require('react-test-renderer');
const mockAnimations = [];
const mockJS = [];
jest.mock('react-native-reanimated', () => {
  const ReactLocal = require('react');
  const {View} = require('react-native');
  return {
    __esModule: true,
    default: {View},
    useSharedValue: value => ReactLocal.useRef({value}).current,
    // Re-read shared values like the UI-thread animated style does.
    useAnimatedStyle: fn => new Proxy({}, {get: (_, key) => fn()[key]}),
    withTiming: (value, config, callback) => {
      mockAnimations.push(callback);
      return value;
    },
    withSpring: value => value,
    runOnJS:
      fn =>
      (...args) =>
        mockJS.push(() => fn(...args)),
    interpolate: () => 0,
    Extrapolation: {CLAMP: 'clamp'},
    Easing: {out: x => x, cubic: x => x},
  };
});
jest.mock('react-native-gesture-handler', () => ({
  GestureDetector: ({children}) => children,
  Gesture: {
    Pan: () => {
      const gesture = {
        enabled: () => gesture,
        onUpdate: () => gesture,
        onEnd: () => gesture,
      };
      return gesture;
    },
  },
}));
jest.mock('../AppIcon', () => () => null);
jest.mock('../RestaurantCardContent', () => {
  const {View} = require('react-native');
  return ({restaurant}) => <View testID={restaurant.id} />;
});
jest.mock('../../constants/restaurantImages', () => ({
  getRestaurantImageUri: () => 'local-image',
}));
const SwipeCard = require('../SwipeCard').default;
const restaurants = ['a', 'b', 'c'].map(id => ({id, name: id}));
let tree;
afterEach(() => {
  act(() => tree?.unmount());
  mockAnimations.length = 0;
  mockJS.length = 0;
});

it('keeps the preloaded next image mounted, and submits only once during exit', async () => {
  const onSwipe = jest.fn();
  act(() => {
    tree = create(
      <SwipeCard
        restaurants={restaurants}
        onSwipe={onSwipe}
        onDeckEmpty={jest.fn()}
      />,
    );
  });
  const nextImage = tree.root.findByProps({testID: 'b'});
  const button = tree.root.findByProps({accessibilityLabel: 'บันทึกร้านนี้'});
  act(() => {
    button.props.onPress();
    button.props.onPress();
  });
  expect(mockAnimations).toHaveLength(1);
  act(() => mockAnimations.shift()(true));
  // Simulate delayed JS: the outgoing card must stay offscreen.
  const outgoing = tree.root.findByProps({testID: 'a'}).parent.parent;
  expect(outgoing.props.style[2].transform[0].translateX).not.toBe(0);
  await act(async () => {
    await mockJS.shift()();
  });
  expect(onSwipe).toHaveBeenCalledTimes(1);
  expect(tree.root.findAllByProps({testID: 'a'})).toHaveLength(0);
  expect(tree.root.findByProps({testID: 'b'})).toBe(nextImage);
});

it.each([false, 'reject'])(
  'restores the card when the vote fails: %s',
  async result => {
    const onSwipe = jest.fn(() =>
      result === 'reject'
        ? Promise.reject(new Error('offline'))
        : Promise.resolve(false),
    );
    const onDeckEmpty = jest.fn();
    act(() => {
      tree = create(
        <SwipeCard
          restaurants={[restaurants[0]]}
          onSwipe={onSwipe}
          onDeckEmpty={onDeckEmpty}
        />,
      );
    });
    act(() =>
      tree.root
        .findByProps({accessibilityLabel: 'ข้ามร้านนี้'})
        .props.onPress(),
    );
    act(() => mockAnimations.shift()(true));
    await act(async () => {
      await mockJS.shift()();
    });
    expect(tree.root.findByProps({testID: 'a'})).toBeTruthy();
    expect(onDeckEmpty).not.toHaveBeenCalled();
  },
);

it('does not vote when the exit animation is cancelled', () => {
  const onSwipe = jest.fn();
  act(() => {
    tree = create(
      <SwipeCard
        restaurants={restaurants}
        onSwipe={onSwipe}
        onDeckEmpty={jest.fn()}
      />,
    );
  });
  act(() =>
    tree.root
      .findByProps({accessibilityLabel: 'บันทึกร้านนี้'})
      .props.onPress(),
  );
  act(() => mockAnimations.shift()(false));
  expect(mockJS).toHaveLength(0);
  expect(onSwipe).not.toHaveBeenCalled();
});

it('disables likes for ephemeral Google places but still allows skipping', () => {
  const onSwipe = jest.fn();
  const liveRestaurant = {
    id: 'google-live',
    name: 'Google live place',
    source: 'google_live',
    can_like: false,
  };
  act(() => {
    tree = create(
      <SwipeCard
        restaurants={[liveRestaurant]}
        onSwipe={onSwipe}
        onDeckEmpty={jest.fn()}
      />,
    );
  });

  const likeButton = tree.root.findByProps({
    accessibilityLabel: 'ยังบันทึกร้านจาก Google แบบสดไม่ได้',
  });
  expect(likeButton.props.disabled).toBe(true);
  act(() => likeButton.props.onPress());
  expect(mockAnimations).toHaveLength(0);

  act(() =>
    tree.root
      .findByProps({accessibilityLabel: 'ข้ามร้านนี้'})
      .props.onPress(),
  );
  expect(mockAnimations).toHaveLength(1);
});

it('mounts only the current card and the next two cards for lazy photo loading', () => {
  const fourRestaurants = ['a', 'b', 'c', 'd'].map(id => ({id, name: id}));
  act(() => {
    tree = create(
      <SwipeCard
        restaurants={fourRestaurants}
        onSwipe={jest.fn()}
        onDeckEmpty={jest.fn()}
      />,
    );
  });

  expect(tree.root.findAllByProps({testID: 'a'}).length).toBeGreaterThan(0);
  expect(tree.root.findAllByProps({testID: 'b'}).length).toBeGreaterThan(0);
  expect(tree.root.findAllByProps({testID: 'c'}).length).toBeGreaterThan(0);
  expect(tree.root.findAllByProps({testID: 'd'})).toHaveLength(0);
});
