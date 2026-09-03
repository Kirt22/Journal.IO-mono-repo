import {
  getConnectivitySnapshot,
  probeBackendReadiness,
  reportBackendReachable,
  reportBackendUnavailable,
  resetConnectivityForTests,
  runConnectivityProbe,
  setRuntimeOnlineOverride,
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

describe('runtime online override', () => {
  afterEach(() => {
    setRuntimeOnlineOverride(false);
    resetConnectivityForTests('checking');
  });

  test('keeps the snapshot reference stable so useSyncExternalStore cannot loop', () => {
    resetConnectivityForTests('checking');
    setRuntimeOnlineOverride(true);

    const first = getConnectivitySnapshot();
    const second = getConnectivitySnapshot();

    expect(first.status).toBe('online');
    // Identity, not shape: returning a fresh object here makes every render look
    // like a connectivity change and blows the tree up with "Maximum update
    // depth exceeded" the moment Demo Mode is active.
    expect(second).toBe(first);
  });

  test('pins the snapshot online and ignores later offline reports', () => {
    resetConnectivityForTests('checking');
    setRuntimeOnlineOverride(true);

    reportBackendUnavailable();

    expect(getConnectivitySnapshot().status).toBe('online');
  });
});

describe('runConnectivityProbe', () => {
  const readinessUrl = 'http://localhost:3001/ready';
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    resetConnectivityForTests('checking');
  });

  test('puts a single request on the wire for concurrent callers', async () => {
    let resolveFetch: (response: Response) => void = () => undefined;
    const fetchImpl = jest.fn(
      () =>
        new Promise<Response>(resolve => {
          resolveFetch = resolve;
        }),
    );
    global.fetch = fetchImpl as unknown as typeof fetch;
    resetConnectivityForTests('offline');

    // The poll loop and the splash's retry button both ask at once.
    const scheduled = runConnectivityProbe(readinessUrl);
    const retried = runConnectivityProbe(readinessUrl);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(retried).toBe(scheduled);

    resolveFetch({ ok: true } as Response);

    await expect(scheduled).resolves.toBe(true);
    await expect(retried).resolves.toBe(true);
    expect(getConnectivitySnapshot().status).toBe('online');
  });

  test('probes again once the previous attempt has settled', async () => {
    const fetchImpl = jest.fn(async () => ({ ok: false } as Response));
    global.fetch = fetchImpl as unknown as typeof fetch;
    resetConnectivityForTests('checking');

    await runConnectivityProbe(readinessUrl);
    await runConnectivityProbe(readinessUrl);

    // Dedupe must not latch: a retry after a failed attempt has to reach the
    // network, otherwise the button is dead for the rest of the session.
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
