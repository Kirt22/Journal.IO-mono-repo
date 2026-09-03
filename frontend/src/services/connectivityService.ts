import { createRequestAbortController } from '../utils/requestAbortController';

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
let probeInFlight: Promise<boolean> | null = null;
let runtimeOnlineOverride = false;
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
  if (runtimeOnlineOverride) {
    return;
  }

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

/**
 * Must return a stable reference: `useSyncExternalStore` compares snapshots by
 * identity, so building a fresh object here makes every render look like a
 * change and spins the tree into "Maximum update depth exceeded". The override
 * is therefore applied to the stored snapshot in `setRuntimeOnlineOverride`,
 * never on the way out.
 */
const getConnectivitySnapshot = () => snapshot;

const probeBackendReadiness = async (
  readinessUrl: string,
  options: ReadinessProbeOptions = {},
) => {
  if (runtimeOnlineOverride) {
    // The override already pinned the snapshot to online; nothing to report.
    return true;
  }

  const observedAt = Date.now();
  const controller = createRequestAbortController();
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

/**
 * Single owner for "probe now". The scheduler and the splash's retry button both
 * want to trigger a probe, and without shared dedupe a retry tapped inside the
 * poll window fires a second redundant request. Ordering is already safe — stale
 * results are discarded by `lastObservationAt` — so this is purely about not
 * putting two identical requests on the wire.
 */
const runConnectivityProbe = (readinessUrl: string) => {
  if (!probeInFlight) {
    probeInFlight = probeBackendReadiness(readinessUrl).finally(() => {
      probeInFlight = null;
    });
  }

  return probeInFlight;
};

const setRuntimeOnlineOverride = (enabled: boolean) => {
  runtimeOnlineOverride = enabled;

  if (enabled && snapshot.status !== 'online') {
    snapshot = {
      reconnectVersion: snapshot.reconnectVersion + 1,
      status: 'online',
    };
    emit();
  }
};

const resetConnectivityForTests = (
  status: ConnectivityStatus = 'online',
) => {
  lastObservationAt = 0;
  probeInFlight = null;
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
  runConnectivityProbe,
  setRuntimeOnlineOverride,
  subscribeToConnectivity,
};
export type { ConnectivitySnapshot, ConnectivityStatus };
