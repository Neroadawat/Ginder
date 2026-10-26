const React = require('react');
const {Text, TouchableOpacity} = require('react-native');
const {act, create} = require('react-test-renderer');
const mockRefetch = jest.fn();
let mockQuery;
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({navigate: jest.fn()}),
}));
jest.mock('../../../hooks/useRestaurants', () => ({
  useSoloDeck: () => mockQuery,
}));
jest.mock('../../../hooks/useVotes', () => ({
  useSoloSwipe: () => ({mutate: jest.fn()}),
}));
jest.mock('../../../services/location', () => ({
  getCurrentLocation: jest.fn(),
}));
jest.mock('../../../components/SwipeCard', () => () => null);
jest.mock('../../../components/AppIcon', () => () => null);
const {useLocationStore} = require('../../../stores/locationStore');
const SoloSwipeScreen = require('../SoloSwipeScreen').default;

beforeEach(() => {
  mockRefetch.mockClear();
  useLocationStore.getState().setLocation(14.0708, 100.6065);
  mockQuery = {
    isLoading: false,
    isFetching: false,
    isError: false,
    refetch: mockRefetch,
  };
});

test('failed loading shows the error and retry, not an exhausted deck', () => {
  mockQuery.isError = true;
  mockQuery.error = new Error(
    'Cannot connect to the server. Check that the backend is running.',
  );
  let tree;
  act(() => {
    tree = create(<SoloSwipeScreen />);
  });
  const labels = tree.root.findAllByType(Text).map(node => node.props.children);
  expect(labels).toContain('Could not load restaurants');
  expect(labels).toContain(mockQuery.error.message);
  expect(labels).not.toContain('You have seen every restaurant in this deck');
  act(() => tree.root.findByType(TouchableOpacity).props.onPress());
  expect(mockRefetch).toHaveBeenCalledTimes(1);
  act(() => tree.unmount());
});

test('successful empty results can be requested again without changing the filters', () => {
  mockQuery.data = {restaurants: [], total: 0, coverage_status: 'partial'};
  let tree;
  act(() => {
    tree = create(<SoloSwipeScreen />);
  });
  const retry = tree.root
    .findAllByType(TouchableOpacity)
    .find(node =>
      node
        .findAllByType(Text)
        .some(label => label.props.children === 'Try again'),
    );
  expect(retry).toBeDefined();
  act(() => retry.props.onPress());
  expect(mockRefetch).toHaveBeenCalledTimes(1);
  act(() => tree.unmount());
});
