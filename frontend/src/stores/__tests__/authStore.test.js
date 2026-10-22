jest.mock('react-native-keychain', () => ({
  ACCESSIBLE: {WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'device-only'},
  setGenericPassword: jest.fn().mockResolvedValue(true),
  resetGenericPassword: jest.fn().mockResolvedValue(true),
  getGenericPassword: jest.fn().mockResolvedValue(false),
}));
jest.mock('../sessionStore', () => ({
  useSessionStore: {getState: () => ({clearSession: jest.fn()})},
}));
jest.mock('../../services/pushRegistration', () => ({
  clearFCMRegistration: jest.fn().mockResolvedValue(undefined),
}));

const Keychain = require('react-native-keychain');
const {queryClient} = require('../../services/queryClient');
const {useAuthStore} = require('../authStore');
const {clearFCMRegistration} = require('../../services/pushRegistration');

afterEach(async () => {
  await useAuthStore.getState().logout();
  jest.clearAllMocks();
});

test('logout and switching users clear private query data', async () => {
  await useAuthStore.getState().setTokens('a1', 'r1', 'user1');
  queryClient.setQueryData(['profile'], {email: 'private@example.com'});
  await useAuthStore.getState().logout();
  expect(clearFCMRegistration).toHaveBeenCalledWith(
    'a1',
    'user1',
    expect.any(Function),
  );
  expect(queryClient.getQueryData(['profile'])).toBeUndefined();
  queryClient.setQueryData(['history'], ['old private data']);
  await useAuthStore.getState().setTokens('a2', 'r2', 'user2');
  expect(queryClient.getQueryData(['history'])).toBeUndefined();
});

test('a refresh cannot restore credentials after logout while storage is busy', async () => {
  await useAuthStore.getState().setTokens('a1', 'r1', 'user1');
  let finishWrite;
  Keychain.setGenericPassword.mockImplementationOnce(
    () =>
      new Promise(resolve => {
        finishWrite = resolve;
      }),
  );
  const refresh = useAuthStore
    .getState()
    .setTokens('new-a1', 'new-r1', 'user1', 'r1');
  await Promise.resolve();
  const logout = useAuthStore.getState().logout();
  finishWrite(true);
  await Promise.all([refresh, logout]);
  expect(useAuthStore.getState().isAuthenticated).toBe(false);
  expect(useAuthStore.getState().accessToken).toBeNull();
  expect(Keychain.resetGenericPassword).toHaveBeenCalled();
});

test('an old refresh cannot replace the next account', async () => {
  await useAuthStore.getState().setTokens('a1', 'r1', 'user1');
  await useAuthStore.getState().logout();
  await useAuthStore.getState().setTokens('a2', 'r2', 'user2');
  await useAuthStore
    .getState()
    .setTokens('stale-a1', 'stale-r1', 'user1', 'r1');
  expect(useAuthStore.getState().userId).toBe('user2');
  expect(useAuthStore.getState().accessToken).toBe('a2');
});
