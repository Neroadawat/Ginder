const React = require('react');
const {Text, TouchableOpacity} = require('react-native');
const {act, create} = require('react-test-renderer');
const mockRefetch = jest.fn();
const mockSearchGoogle = jest.fn();
const mockNavigate = jest.fn();
let mockQuery;
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({navigate: mockNavigate}),
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
const SwipeCard = require('../../../components/SwipeCard');
const SoloSwipeScreen = require('../SoloSwipeScreen').default;

beforeEach(() => {
  mockRefetch.mockClear();
  mockSearchGoogle.mockClear();
  mockNavigate.mockClear();
  useLocationStore.getState().setLocation(14.0708, 100.6065);
  mockQuery = {
    isLoading: false,
    isFetching: false,
    isError: false,
    dataUpdatedAt: 1,
    refetch: mockRefetch,
    searchGoogle: mockSearchGoogle,
  };
});

test('empty local results wait for the explicit Google search tap', () => {
  mockQuery.data = {restaurants: [], total: 0, external_status: 'search_available'};
  let tree;
  act(() => {
    tree = create(<SoloSwipeScreen />);
  });
  expect(mockSearchGoogle).not.toHaveBeenCalled();
  const button = tree.root.findAllByType(TouchableOpacity).find(node =>
    node.findAllByType(Text).some(
      label => label.props.children === 'Find more restaurants',
    ),
  );
  act(() => button.props.onPress());
  expect(mockSearchGoogle).toHaveBeenCalledTimes(1);
  expect(mockRefetch).not.toHaveBeenCalled();
  act(() => tree.unmount());
});

test('finishing a Google deck waits for a tap before offering a wider search', () => {
  mockQuery.data = {
    restaurants: [{source: 'google_live'}],
    total: 1,
  };
  let tree;
  act(() => {
    tree = create(<SoloSwipeScreen />);
  });
  act(() => tree.root.findByType(SwipeCard).props.onDeckEmpty());
  expect(mockRefetch).not.toHaveBeenCalled();
  expect(mockNavigate).not.toHaveBeenCalled();
  expect(tree.root.findAllByType(SwipeCard)).toHaveLength(0);
  const findMore = tree.root.findAllByType(TouchableOpacity).find(node =>
    node.findAllByType(Text).some(
      label => label.props.children === 'Find more restaurants',
    ),
  );
  act(() => findMore.props.onPress());
  expect(mockNavigate).toHaveBeenCalledWith('ExpandRadius');
  expect(mockRefetch).not.toHaveBeenCalled();
  act(() => {
    mockQuery.dataUpdatedAt = 2;
    tree.update(<SoloSwipeScreen />);
  });
  expect(tree.root.findAllByType(SwipeCard)).toHaveLength(1);
  act(() => tree.unmount());
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
