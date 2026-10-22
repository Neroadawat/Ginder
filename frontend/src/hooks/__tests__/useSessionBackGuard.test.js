const React = require('react');
const {act, create} = require('react-test-renderer');
const {BackHandler} = require('react-native');

let mockFocused = true;
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: callback => {
    require('react').useEffect(
      () => (mockFocused ? callback() : undefined),
      [callback, mockFocused],
    );
  },
}));

const {useSessionBackGuard} = require('../useSessionBackGuard');
const Guard = () => {
  useSessionBackGuard();
  return null;
};

let remove;
let listener;
beforeEach(() => {
  mockFocused = true;
  remove = jest.fn();
  listener = jest
    .spyOn(BackHandler, 'addEventListener')
    .mockReturnValue({remove});
});
afterEach(() => jest.restoreAllMocks());

test('consumes Android edge-back and button-back while the party screen is focused', () => {
  let tree;
  act(() => {
    tree = create(<Guard />);
  });
  expect(listener).toHaveBeenCalledWith(
    'hardwareBackPress',
    expect.any(Function),
  );
  expect(listener.mock.calls[0][1]()).toBe(true);
  act(() => tree.unmount());
  expect(remove).toHaveBeenCalledTimes(1);
});

test('releases the guard on blur so the result and Solo screens can navigate normally', () => {
  let tree;
  act(() => {
    tree = create(<Guard />);
  });
  mockFocused = false;
  act(() => tree.update(<Guard />));
  expect(remove).toHaveBeenCalledTimes(1);
  act(() => tree.unmount());
});

test('does not capture back events for an unfocused screen', () => {
  mockFocused = false;
  let tree;
  act(() => {
    tree = create(<Guard />);
  });
  expect(listener).not.toHaveBeenCalled();
  act(() => tree.unmount());
});
