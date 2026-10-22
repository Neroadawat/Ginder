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
