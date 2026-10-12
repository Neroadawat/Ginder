const React = require('react');
const {Image} = require('react-native');
const {act, create} = require('react-test-renderer');

let mockPhotoResult;
jest.mock('../../hooks/useGooglePhoto', () => ({
  useGooglePhoto: () => mockPhotoResult,
}));
jest.mock('../../constants/restaurantImages', () => ({
  getRestaurantImageUri: () => 'placeholder-image',
}));
jest.mock('../PhotoAttribution', () => {
  const {View: MockView} = require('react-native');
  return props => <MockView testID="photo-attribution" {...props} />;
});

const RestaurantCardContent = require('../RestaurantCardContent').default;

const liveRestaurant = {
  id: 'live-1',
  name: 'Live restaurant',
  source: 'google_live',
  primary_category: 'Thai',
  distance_km: 0.4,
  rating: null,
  price_symbol: null,
};

afterEach(() => {
  mockPhotoResult = undefined;
});

it('shows a resolved live photo without using image cache', () => {
  mockPhotoResult = {
    data: {
      status: 'available',
      photo_uri: 'https://lh3.googleusercontent.com/photo',
    },
  };
  let tree;
  act(() => {
    tree = create(<RestaurantCardContent restaurant={liveRestaurant} />);
  });

  expect(tree.root.findByType(Image).props.source).toEqual({
    uri: 'https://lh3.googleusercontent.com/photo',
    cache: 'reload',
  });
  expect(
    tree.root.findByProps({testID: 'photo-attribution'}).props.photoVisible,
  ).toBe(true);
  act(() => tree.unmount());
});

it('keeps the placeholder when live photo resolution fails', () => {
  mockPhotoResult = {data: {status: 'quota_exhausted', photo_uri: null}};
  let tree;
  act(() => {
    tree = create(<RestaurantCardContent restaurant={liveRestaurant} />);
  });

  expect(tree.root.findByType(Image).props.source).toEqual({
    uri: 'placeholder-image',
    cache: 'default',
  });
  expect(
    tree.root.findByProps({testID: 'photo-attribution'}).props.photoVisible,
  ).toBe(false);
  act(() => tree.unmount());
});
