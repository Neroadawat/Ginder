const React = require('react');
const {act, create} = require('react-test-renderer');
let mockSeconds = 1;
jest.mock('../../hooks/useSessions', () => ({
  useSession: () => ({
    data: {session: {ends_at: '2026-10-22T10:03:00Z', duration_seconds: 180}},
  }),
}));
jest.mock('../../utils/sessionClock', () => ({
  sessionSecondsRemaining: () => mockSeconds,
}));
const SessionTimer = require('../SessionTimer').default;

it('notifies the screen once at zero and stops counting', () => {
  jest.useFakeTimers();
  mockSeconds = 1;
  const onExpire = jest.fn();
  let tree;
  act(() => {
    tree = create(<SessionTimer sessionId="room" onExpire={onExpire} />);
  });
  expect(onExpire).not.toHaveBeenCalled();
  mockSeconds = 0;
  act(() => jest.advanceTimersByTime(1000));
  expect(onExpire).toHaveBeenCalledTimes(1);
  act(() => jest.advanceTimersByTime(5000));
  expect(onExpire).toHaveBeenCalledTimes(1);
  act(() => tree.unmount());
  jest.useRealTimers();
});

it('requests a result immediately when reopening an already expired session', () => {
  mockSeconds = 0;
  const onExpire = jest.fn();
  let tree;
  act(() => {
    tree = create(<SessionTimer sessionId="expired" onExpire={onExpire} />);
  });
  expect(onExpire).toHaveBeenCalledTimes(1);
  act(() => tree.unmount());
});
