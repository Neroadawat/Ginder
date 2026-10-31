const React = require('react');
const {act, create} = require('react-test-renderer');
const mockReplace = jest.fn();
const mockSwipe = jest.fn();
const mockReport = {mutate: jest.fn()};
const mockDeck = {
  restaurants: [
    {id: 'server-winner', name: 'Shared winner'},
    {id: 'other', name: 'Other'},
  ],
};
let mockEventHandler;
let mockResult;
let mockResultEnabled;
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({replace: mockReplace}),
  useRoute: () => ({params: {sessionId: 'room'}}),
}));
jest.mock('../../../hooks/useRestaurants', () => ({
  useSessionDeck: () => ({data: mockDeck, isLoading: false}),
}));
jest.mock('../../../hooks/useVotes', () => ({
  useSwipe: () => ({mutate: mockSwipe}),
  useVoteProgress: () => ({data: {restaurant_ids: []}, isLoading: false}),
}));
jest.mock('../../../hooks/useSessions', () => ({
  useSession: () => ({data: {session: {status: 'active'}}}),
  useReportDeckFinished: () => mockReport,
  useLiveSessionResult: (_, enabled) => {
    mockResultEnabled = enabled;
    return {data: mockResult};
  },
}));
jest.mock('../../../hooks/useWebSocket', () => ({
  useSessionWebSocket: (_, handler) => {
    mockEventHandler = handler;
  },
}));
jest.mock('../../../hooks/useSessionBackGuard', () => ({
  useSessionBackGuard: jest.fn(),
}));
jest.mock('../../../components/MatchPopup', () => 'MatchPopup');
jest.mock('../../../components/SwipeCard', () => 'SwipeCard');
jest.mock('../../../components/SessionTimer', () => 'SessionTimer');
const Screen = require('../SessionSwipeScreen').default;
const unanimous = {
  restaurant_id: 'server-winner',
  restaurant_name: 'Shared winner',
  resolution_type: 'unanimous',
  wheel_candidate_ids: [],
};
beforeEach(() => {
  mockReplace.mockReset();
  mockSwipe.mockReset();
  mockResult = undefined;
});

test('consecutive match/result events keep the same match popup until dismissed', () => {
  let tree;
  act(() => {
    tree = create(<Screen />);
  });
  act(() => {
    mockEventHandler({
      event: 'unanimous_match',
      data: {restaurant_id: 'server-winner'},
    });
    mockEventHandler({event: 'result', data: unanimous});
  });
  expect(tree.root.findByType('MatchPopup').props.restaurant.id).toBe(
    'server-winner',
  );
  expect(mockReplace).not.toHaveBeenCalled();
  act(() => tree.root.findByType('MatchPopup').props.onDismiss());
  expect(mockReplace).toHaveBeenCalledTimes(1);
  expect(mockReplace).toHaveBeenCalledWith('SessionResult', {
    sessionId: 'room',
  });
  act(() => tree.unmount());
});

test('REST recovery displays the same popup even when the match event was missed', () => {
  mockResult = unanimous;
  let tree;
  act(() => {
    tree = create(<Screen />);
  });
  expect(tree.root.findByType('MatchPopup').props.restaurant.id).toBe(
    'server-winner',
  );
  expect(mockReplace).not.toHaveBeenCalled();
  act(() => tree.unmount());
});

test('a swipe response waits for the canonical result instead of choosing the local card', () => {
  let tree;
  act(() => {
    tree = create(<Screen />);
  });
  mockSwipe.mockImplementation((_, callbacks) =>
    callbacks.onSuccess({
      unanimous_match: true,
      matched_restaurant_id: 'server-winner',
    }),
  );
  act(() => {
    tree.root
      .findByType('SwipeCard')
      .props.onSwipe(mockDeck.restaurants[1], true);
  });
  expect(mockResultEnabled).toBe(true);
  expect(tree.root.findAllByType('MatchPopup')).toHaveLength(0);
  act(() => tree.unmount());
});

test('a wheel always receives the server winner and navigates only once', () => {
  let tree;
  act(() => {
    tree = create(<Screen />);
  });
  act(() => {
    const event = {
      event: 'spin_wheel',
      data: {
        ...unanimous,
        resolution_type: 'spin_wheel_tie',
        wheel_candidate_ids: ['other', 'server-winner'],
      },
    };
    mockEventHandler(event);
    mockEventHandler(event);
  });
  expect(mockReplace).toHaveBeenCalledTimes(1);
  expect(mockReplace).toHaveBeenCalledWith('SpinWheel', {
    sessionId: 'room',
    candidateIds: ['other', 'server-winner'],
    winnerId: 'server-winner',
    winnerName: 'Shared winner',
  });
  act(() => tree.unmount());
});
