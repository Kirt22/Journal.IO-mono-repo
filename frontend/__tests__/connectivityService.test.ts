import {
  getConnectivitySnapshot,
  probeBackendReadiness,
  reportBackendReachable,
  reportBackendUnavailable,
  resetConnectivityForTests,
  subscribeToConnectivity,
} from '../src/services/connectivityService';

describe('connectivityService', () => {
  beforeEach(() => {
    resetConnectivityForTests('checking');
  });

  test('marks the backend online only when readiness succeeds', async () => {
    const listener = jest.fn();
    const unsubscribe = subscribeToConnectivity(listener);
    const fetchImpl = jest.fn(async () => ({ ok: true } as Response));

    await expect(
      probeBackendReadiness('http://localhost:3001/ready', { fetchImpl }),
    ).resolves.toBe(true);

    expect(getConnectivitySnapshot()).toEqual({
      reconnectVersion: 0,
      status: 'online',
    });
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  test('treats fetch failures and unready responses as offline', async () => {
    await expect(
      probeBackendReadiness('http://localhost:3001/ready', {
        fetchImpl: jest.fn(async () => {
          throw new Error('Network unavailable');
        }),
      }),
    ).resolves.toBe(false);
    expect(getConnectivitySnapshot().status).toBe('offline');

    resetConnectivityForTests('checking');
    await expect(
      probeBackendReadiness('http://localhost:3001/ready', {
        fetchImpl: jest.fn(async () => ({ ok: false } as Response)),
      }),
    ).resolves.toBe(false);
    expect(getConnectivitySnapshot().status).toBe('offline');
  });

  test('increments reconnect version and ignores older probe results', () => {
    reportBackendUnavailable(100);
    reportBackendReachable(200);
    reportBackendUnavailable(150);

    expect(getConnectivitySnapshot()).toEqual({
      reconnectVersion: 1,
      status: 'online',
    });
  });
});
