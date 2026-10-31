const {subscribeSessionSocket} = require('../sessionSocket');

let sockets;
let originalWebSocket;
beforeEach(() => {
  jest.useFakeTimers();
  sockets = [];
  originalWebSocket = global.WebSocket;
  global.WebSocket = class {
    static OPEN = 1;
    readyState = 0;
    send = jest.fn();
    close = jest.fn();
    constructor() {
      sockets.push(this);
    }
  };
});
afterEach(() => {
  global.WebSocket = originalWebSocket;
  jest.useRealTimers();
});
const listener = () => ({onEvent: jest.fn(), onConnection: jest.fn()});

test('Likes and swipe screens share a socket and receive consecutive events', () => {
  const likes = listener();
  const swipe = listener();
  const stopLikes = subscribeSessionSocket('ws://test/room', 'token', likes);
  const stopSwipe = subscribeSessionSocket('ws://test/room', 'token', swipe);
  expect(sockets).toHaveLength(1);
  sockets[0].readyState = 1;
  sockets[0].onopen();
  for (const event of ['unanimous_match', 'result']) {
    sockets[0].onmessage({
      data: JSON.stringify({event, data: {restaurant_id: 'winner'}}),
    });
  }
  expect(swipe.onEvent.mock.calls.map(([event]) => event.event)).toEqual([
    'unanimous_match',
    'result',
  ]);
  expect(likes.onEvent).toHaveBeenCalledTimes(2);
  stopLikes();
  expect(sockets[0].close).not.toHaveBeenCalled();
  stopSwipe();
  expect(sockets[0].close).toHaveBeenCalledTimes(1);
  jest.advanceTimersByTime(60000);
  expect(sockets).toHaveLength(1);
});

test('a dropped shared socket reconnects once and cleanup cancels retries', () => {
  const first = listener();
  const second = listener();
  const stopFirst = subscribeSessionSocket('ws://test/room', 'token', first);
  const stopSecond = subscribeSessionSocket('ws://test/room', 'token', second);
  sockets[0].onclose({code: 1006});
  jest.advanceTimersByTime(1000);
  expect(sockets).toHaveLength(2);
  sockets[1].readyState = 1;
  sockets[1].onopen();
  expect(first.onConnection).toHaveBeenLastCalledWith(true);
  expect(second.onConnection).toHaveBeenLastCalledWith(true);
  sockets[1].onclose({code: 1006});
  stopFirst();
  stopSecond();
  jest.advanceTimersByTime(60000);
  expect(sockets).toHaveLength(2);
});

test('revoked access does not reconnect in a loop', () => {
  const stop = subscribeSessionSocket(
    'ws://test/room',
    'old-token',
    listener(),
  );
  sockets[0].onclose({code: 4003});
  jest.advanceTimersByTime(60000);
  expect(sockets).toHaveLength(1);
  stop();
});
