jest.mock('@react-native-firebase/messaging', () => ({
  AuthorizationStatus: {AUTHORIZED: 1, PROVISIONAL: 2, DENIED: 0},
  getMessaging: () => ({}),
  getToken: jest.fn().mockResolvedValue('device-token'),
  onTokenRefresh: jest.fn(() => jest.fn()),
  requestPermission: jest.fn(),
  onMessage: jest.fn(() => jest.fn()),
  onNotificationOpenedApp: jest.fn(() => jest.fn()),
  getInitialNotification: jest.fn().mockResolvedValue(null),
  setBackgroundMessageHandler: jest.fn(),
}));
jest.mock('@react-native-firebase/app', () => ({getApps: () => [{}]}));
jest.mock('../config', () => ({FCM_ENABLED: true}));
jest.mock('../api/userApi', () => ({userApi: {updateFCMToken: jest.fn()}}));
jest.mock('../../stores/authStore', () => ({
  useAuthStore: {getState: jest.fn()},
}));

const {Platform, PermissionsAndroid} = require('react-native');
const messaging = require('@react-native-firebase/messaging');
const {userApi} = require('../api/userApi');
const {useAuthStore} = require('../../stores/authStore');
const {
  setupFCM,
  setupNotificationOpenHandler,
  setupForegroundMessageHandler,
} = require('../fcm');
const {isCurrentAccountInvite} = require('../../utils/pushNotification');

beforeEach(() => {
  jest.clearAllMocks();
  Platform.OS = 'android';
  Object.defineProperty(Platform, 'Version', {value: 35, configurable: true});
  jest
    .spyOn(PermissionsAndroid, 'request')
    .mockResolvedValue(PermissionsAndroid.RESULTS.GRANTED);
  useAuthStore.getState.mockReturnValue({userId: 'account-a'});
  messaging.getInitialNotification.mockResolvedValue(null);
  userApi.updateFCMToken.mockResolvedValue({});
});

test('permission grant registers the token and refresh cannot cross accounts', async () => {
  await setupFCM('account-a');
  expect(userApi.updateFCMToken).toHaveBeenCalledWith('device-token');
  const refresh = messaging.onTokenRefresh.mock.calls[0][1];
  useAuthStore.getState.mockReturnValue({userId: 'account-b'});
  await refresh('stale-token');
  expect(userApi.updateFCMToken).toHaveBeenCalledTimes(1);
});

test('denied Android notification permission does not register a device', async () => {
  PermissionsAndroid.request.mockResolvedValue(
    PermissionsAndroid.RESULTS.DENIED,
  );
  await setupFCM('account-a');
  expect(messaging.getToken).not.toHaveBeenCalled();
  expect(userApi.updateFCMToken).not.toHaveBeenCalled();
});

test('foreground callback receives the message and can unsubscribe', () => {
  const received = jest.fn();
  const unsubscribe = setupForegroundMessageHandler(received);
  const message = {messageId: 'one'};
  messaging.onMessage.mock.calls[0][1](message);
  expect(received).toHaveBeenCalledWith(message);
  unsubscribe();
  expect(messaging.onMessage.mock.results[0].value).toHaveBeenCalled();
});

test('cold-start message is ignored after the authenticated listener unmounts', async () => {
  let resolveInitial;
  messaging.getInitialNotification.mockReturnValue(
    new Promise(resolve => {
      resolveInitial = resolve;
    }),
  );
  const opened = jest.fn();
  const unsubscribe = setupNotificationOpenHandler(opened);
  unsubscribe();
  resolveInitial({messageId: 'old'});
  await Promise.resolve();
  expect(opened).not.toHaveBeenCalled();
});

test('notification taps and cold-start notifications reach the mounted handler', async () => {
  messaging.getInitialNotification.mockResolvedValue({messageId: 'cold'});
  const opened = jest.fn();
  const unsubscribe = setupNotificationOpenHandler(opened);
  await Promise.resolve();
  expect(opened).toHaveBeenCalledWith({messageId: 'cold'});
  messaging.onNotificationOpenedApp.mock.calls[0][1]({messageId: 'tap'});
  expect(opened).toHaveBeenCalledWith({messageId: 'tap'});
  unsubscribe();
});

test('queued pushes belong only to the current account and known invitation type', () => {
  const message = {data: {recipient_id: 'account-a', type: 'session_invite'}};
  expect(isCurrentAccountInvite(message, 'account-a')).toBe(true);
  expect(isCurrentAccountInvite(message, 'account-b')).toBe(false);
  expect(isCurrentAccountInvite(message, null)).toBe(false);
  expect(isCurrentAccountInvite({}, 'account-a')).toBe(false);
  expect(
    isCurrentAccountInvite(
      {data: {...message.data, type: 'unknown'}},
      'account-a',
    ),
  ).toBe(false);
});
