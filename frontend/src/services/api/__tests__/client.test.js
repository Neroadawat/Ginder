jest.mock('axios', () => {
  const client = jest.fn();
  client.interceptors = {
    request: {use: jest.fn()},
    response: {use: jest.fn()},
  };
  return {__esModule: true, default: {create: () => client, post: jest.fn()}};
});
jest.mock('../../config', () => ({
  API_BASE_URL: 'https://api.example.com/api/v1',
}));
jest.mock('../../../stores/authStore', () => ({
  getAuthRevision: jest.fn(),
  useAuthStore: {getState: jest.fn()},
}));

const axios = require('axios').default;
const {getAuthRevision, useAuthStore} = require('../../../stores/authStore');
const client = require('../client').default;
const [prepare] = client.interceptors.request.use.mock.calls[0];
const [success, failure] = client.interceptors.response.use.mock.calls[0];

const accessJwt = userId =>
  `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({sub: userId})).toString(
    'base64url',
  )}.signature`;

beforeEach(() => {
  getAuthRevision.mockReturnValue(1);
  useAuthStore.getState.mockReturnValue({
    accessToken: 'a1',
    refreshToken: 'r1',
    userId: 'u1',
    logout: jest.fn(),
  });
  axios.post.mockReset();
});

test('old DELETE is never refreshed or retried with another login', async () => {
  const config = prepare({url: '/users/me', method: 'delete', headers: {}});
  getAuthRevision.mockReturnValue(3);
  await expect(failure({config, response: {status: 401}})).rejects.toThrow(
    'Authentication changed',
  );
  expect(axios.post).not.toHaveBeenCalled();
  expect(client).not.toHaveBeenCalled();
});

test('old private responses cannot reach screens after changing accounts', async () => {
  const config = prepare({url: '/users/me', headers: {}});
  getAuthRevision.mockReturnValue(2);
  await expect(
    success({config, data: {email: 'private@example.com'}}),
  ).rejects.toThrow('Authentication changed');
});

test('retry prepared after logout is rejected before attaching new credentials', async () => {
  const config = prepare({url: '/users/me', headers: {}});
  getAuthRevision.mockReturnValue(3);
  await expect(prepare(config)).rejects.toThrow('Authentication changed');
  expect(config.headers.Authorization).toBe('Bearer a1');
});

test('invalid login does not refresh the current account', async () => {
  const config = prepare({url: '/auth/login', headers: {}});
  await expect(
    failure({
      config,
      response: {status: 401, data: {detail: 'Invalid email or password'}},
    }),
  ).rejects.toThrow('Invalid email or password');
  expect(axios.post).not.toHaveBeenCalled();
});

test('parallel 401 responses rotate once and both retry with the new token', async () => {
  const state = useAuthStore.getState();
  state.setTokens = jest.fn(async (access, refresh) => {
    state.accessToken = access;
    state.refreshToken = refresh;
  });
  const first = prepare({url: '/users/me', headers: {}});
  const second = prepare({url: '/notifications', headers: {}});
  let resolveRefresh;
  axios.post.mockReturnValue(
    new Promise(resolve => {
      resolveRefresh = resolve;
    }),
  );
  const attempts = [first, second].map(config =>
    failure({config, response: {status: 401}}),
  );
  expect(axios.post).toHaveBeenCalledTimes(1);
  const access = accessJwt('u1');
  resolveRefresh({data: {access_token: access, refresh_token: 'r2'}});
  await Promise.all(attempts);
  expect(state.setTokens).toHaveBeenCalledTimes(1);
  expect(first.headers.Authorization).toBe(`Bearer ${access}`);
  expect(second.headers.Authorization).toBe(`Bearer ${access}`);
});

test('late 401 uses a token already rotated by another request', async () => {
  const state = useAuthStore.getState();
  const config = prepare({url: '/users/me', headers: {}});
  state.accessToken = 'already-rotated';
  state.refreshToken = 'r2';
  await failure({config, response: {status: 401}});
  expect(axios.post).not.toHaveBeenCalled();
  expect(config.headers.Authorization).toBe('Bearer already-rotated');
});

test('logout during refresh cannot restore authentication', async () => {
  const state = useAuthStore.getState();
  state.setTokens = jest.fn();
  const config = prepare({url: '/users/me', headers: {}});
  let resolveRefresh;
  axios.post.mockReturnValue(
    new Promise(resolve => {
      resolveRefresh = resolve;
    }),
  );
  const attempt = failure({config, response: {status: 401}});
  state.userId = null;
  state.refreshToken = null;
  getAuthRevision.mockReturnValue(2);
  resolveRefresh({data: {access_token: accessJwt('u1'), refresh_token: 'r2'}});
  await expect(attempt).rejects.toBeDefined();
  expect(state.setTokens).not.toHaveBeenCalled();
});
