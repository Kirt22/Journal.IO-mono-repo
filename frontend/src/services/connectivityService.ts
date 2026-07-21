type ConnectivityStatus = 'checking' | 'online' | 'offline';

type ConnectivitySnapshot = {
  reconnectVersion: number;
  status: ConnectivityStatus;
};

type ReadinessProbeOptions = {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

const DEFAULT_READINESS_TIMEOUT_MS = 4000;
const listeners = new Set<() => void>();
const initialStatus: ConnectivityStatus =
  typeof jest === 'undefined' ? 'checking' : 'online';

let lastObservationAt = 0;
let snapshot: ConnectivitySnapshot = {
  reconnectVersion: 0,
  status: initialStatus,
};

const emit = () => {
  listeners.forEach(listener => listener());
};

const reportConnectivityStatus = (
  status: Exclude<ConnectivityStatus, 'checking'>,
  observedAt = Date.now(),
) => {
  if (observedAt < lastObservationAt) {
    return;
  }

  lastObservationAt = observedAt;

  if (snapshot.status === status) {
    return;
  }

  snapshot = {
    reconnectVersion:
      status === 'online' && snapshot.status === 'offline'
        ? snapshot.reconnectVersion + 1
        : snapshot.reconnectVersion,
    status,
  };
  emit();
};

const reportBackendReachable = (observedAt?: number) => {
  reportConnectivityStatus('online', observedAt);
};

const reportBackendUnavailable = (observedAt?: number) => {
  reportConnectivityStatus('offline', observedAt);
};

const subscribeToConnectivity = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const getConnectivitySnapshot = () => snapshot;

const probeBackendReadiness = async (
  readinessUrl: string,
  options: ReadinessProbeOptions = {},
) => {
  const observedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? DEFAULT_READINESS_TIMEOUT_MS,
  );

  try {
    const response = await (options.fetchImpl ?? fetch)(readinessUrl, {
      headers: {
        'Cache-Control': 'no-cache',
      },
      method: 'GET',
      signal: controller.signal,
    });

    if (response.ok) {
      reportBackendReachable(observedAt);
      return true;
    }

    reportBackendUnavailable(observedAt);
    return false;
  } catch {
    reportBackendUnavailable(observedAt);
    return false;
  } finally {
    clearTimeout(timeout);
  }
};

const resetConnectivityForTests = (
  status: ConnectivityStatus = 'online',
) => {
  lastObservationAt = 0;
  snapshot = {
    reconnectVersion: 0,
    status,
  };
  emit();
};

export {
  getConnectivitySnapshot,
  probeBackendReadiness,
  reportBackendReachable,
  reportBackendUnavailable,
  resetConnectivityForTests,
  subscribeToConnectivity,
};
export type { ConnectivitySnapshot, ConnectivityStatus };
