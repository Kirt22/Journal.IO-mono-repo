import {
  signInWithEmail,
  verifyEmail,
} from '../src/services/authService';
import {
  getConnectivitySnapshot,
  resetConnectivityForTests,
} from '../src/services/connectivityService';

describe('authService connectivity failures', () => {
  beforeEach(() => {
    resetConnectivityForTests('online');
    globalThis.fetch = jest.fn(async () => {
      throw new Error('Network unavailable');
    });
  });

  test('email sign-in never synthesizes a development session', async () => {
    await expect(
      signInWithEmail({
        email: 'alex@example.com',
        password: 'password123',
      }),
    ).rejects.toMatchObject({
      isNetworkError: true,
    });
    expect(getConnectivitySnapshot().status).toBe('offline');
  });

  test('email verification never returns mock tokens', async () => {
    resetConnectivityForTests('online');

    await expect(
      verifyEmail({ email: 'alex@example.com', code: '123456' }),
    ).rejects.toMatchObject({
      isNetworkError: true,
    });
  });
});
