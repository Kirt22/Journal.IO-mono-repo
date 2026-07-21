import {
  getConnectivitySnapshot,
  resetConnectivityForTests,
} from '../src/services/connectivityService';
import { request } from '../src/utils/apiClient';

describe('apiClient connectivity integration', () => {
  beforeEach(() => {
    resetConnectivityForTests('online');
    globalThis.fetch = jest.fn();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  test('blocks server writes while offline without attempting a fetch', async () => {
    resetConnectivityForTests('offline');

    await expect(
      request('/journals', {
        body: JSON.stringify({ content: 'preserved draft' }),
        method: 'POST',
      }),
    ).rejects.toMatchObject({
      isNetworkError: true,
      message: 'Reconnect to the internet before saving changes.',
    });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  test('treats gateway unavailability as offline', async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue({
      json: async () => ({
        data: {},
        message: 'Service unavailable',
        success: false,
      }),
      ok: false,
      status: 503,
    });

    await expect(request('/users/profile')).rejects.toMatchObject({
      isNetworkError: true,
      status: 503,
    });
    expect(getConnectivitySnapshot().status).toBe('offline');
  });

  test('treats an unauthorized response as reachable', async () => {
    resetConnectivityForTests('offline');
    (globalThis.fetch as jest.Mock).mockResolvedValue({
      json: async () => ({
        data: {},
        message: 'Unauthorized',
        success: false,
      }),
      ok: false,
      status: 401,
    });

    await expect(request('/users/profile')).rejects.toMatchObject({
      isNetworkError: false,
      status: 401,
    });
    expect(getConnectivitySnapshot().status).toBe('online');
  });
});
