const React = require('react');
const {Image, Linking, Text} = require('react-native');
const {act, create} = require('react-test-renderer');

jest.mock('../../constants/placeholders', () => ({
  getPlaceholderImage: () => 'placeholder-image',
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
  address: 'Pathum Thani',
  google_maps_url:
    'https://www.google.com/maps/search/?api=1&query_place_id=test',
  // An old response must not cause a Google image download in the new client.
  photo_url: 'https://google.example/old-photo',
  photo_source: 'https://google.example',
  photo_attribution: 'Old credit',
  google_photo_name: 'places/test/photos/old',
};
let tree;
afterEach(() => {
  act(() => tree?.unmount());
  tree = undefined;
  jest.restoreAllMocks();
});

it('uses a labelled illustration for Google metadata even with old photo fields', () => {
  act(() => {
    tree = create(<RestaurantCardContent restaurant={liveRestaurant} />);
  });
  expect(tree.root.findByType(Image).props.source.uri).toBe(
    'placeholder-image',
  );
  expect(
    tree.root.findByProps({testID: 'photo-attribution'}).props.photoVisible,
  ).toBe(false);
  const texts = tree.root.findAllByType(Text).map(node => node.props.children);
  expect(texts).toContain('Pathum Thani');
  expect(texts).toContain('Illustrative image');
});

it('opens the Google Maps URL without fetching place details or photos', () => {
  const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  act(() => {
    tree = create(<RestaurantCardContent restaurant={liveRestaurant} />);
  });
  act(() => {
    tree.root
      .findByProps({accessibilityLabel: 'Open in Google Maps'})
      .props.onPress();
  });
  expect(openURL).toHaveBeenCalledWith(liveRestaurant.google_maps_url);
});

it('preserves a credited photo for a local restaurant', () => {
  act(() => {
    tree = create(
      <RestaurantCardContent
        restaurant={{
          ...liveRestaurant,
          source: 'manual',
          photo_url: 'https://example.com/owned-photo.jpg',
          photo_source: 'https://example.com',
          photo_attribution: 'Ginder team',
        }}
      />,
    );
  });
  expect(tree.root.findByType(Image).props.source.uri).toBe(
    'https://example.com/owned-photo.jpg',
  );
  expect(
    tree.root.findByProps({testID: 'photo-attribution'}).props.photoVisible,
  ).toBe(true);
  expect(
    tree.root
      .findAllByType(Text)
      .some(node => node.props.children === 'Illustrative image'),
  ).toBe(false);
});
