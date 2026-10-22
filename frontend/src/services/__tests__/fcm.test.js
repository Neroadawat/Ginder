jest.mock('@react-native-firebase/messaging', () => ({
  getMessaging: () => ({}),
  deleteToken: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@react-native-firebase/app', () => ({getApps: () => [{}]}));
jest.mock('../config', () => ({
  FCM_ENABLED: true,
  API_BASE_URL: 'https://api.example.com/api/v1',
}));
jest.mock('../api/userApi', () => ({userApi: {}}));
jest.mock('../../stores/authStore', () => ({
  useAuthStore: {getState: jest.fn()},
}));
jest.mock('axios', () => ({
  __esModule: true,
  default: {put: jest.fn().mockResolvedValue({})},
}));

const axios = require('axios').default;
const {deleteToken} = require('@react-native-firebase/messaging');
const {useAuthStore} = require('../../stores/authStore');
const {clearFCMRegistration} = require('../pushRegistration');

beforeEach(() => {
  jest.clearAllMocks();
  axios.put.mockResolvedValue({});
  useAuthStore.getState.mockReturnValue({userId: null});
});

test('logout clears push registration using the captured old access token', async () => {
  await clearFCMRegistration('old-token', 'old-user', () => null);
  expect(axios.put).toHaveBeenCalledWith(
    'https://api.example.com/api/v1/users/me/fcm-token',
    {fcm_token: null},
    {headers: {Authorization: 'Bearer old-token'}, timeout: 10000},
  );
  expect(deleteToken).toHaveBeenCalledTimes(1);
});

test('delayed cleanup does not delete the next account device token', async () => {
  useAuthStore.getState.mockReturnValue({userId: 'new-user'});
  await clearFCMRegistration('old-token', 'old-user', () => 'new-user');
  expect(deleteToken).not.toHaveBeenCalled();
});

test('network failure still invalidates the signed-out device token', async () => {
  axios.put.mockRejectedValue(new Error('offline'));
  await expect(
    clearFCMRegistration('old-token', 'old-user', () => null),
  ).rejects.toThrow('offline');
  expect(deleteToken).toHaveBeenCalledTimes(1);
});
