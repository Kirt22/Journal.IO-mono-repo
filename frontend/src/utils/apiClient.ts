import { NativeModules, Platform } from 'react-native';
import { env } from '../config/env';
import {
  getConnectivitySnapshot,
  reportBackendReachable,
  reportBackendUnavailable,
} from '../services/connectivityService';
import devLaunchConfig from './devLaunchConfig.json';
import { createRequestAbortController } from './requestAbortController';
import {
  clearTokens,
  getAccessToken,
  getTokens,
  saveTokens,
} from './tokenStorage';

type DevLaunchConfig = {
  apiBaseUrl?: string | null;
};

/**
 * Every request needs a deadline. `fetch` has none of its own, and a half-open
 * socket — a backend that moved, a laptop that changed networks, a dev server
 * that died mid-request — leaves the promise pending forever. On boot that is
 * fatal rather than slow: `bootstrapAuthGate` awaits `getProfile()`, so a hung
 * request means `hasBootstrappedAuthGate` never flips, the navigator never
 * mounts, and the retry is deduped against a promise that will never settle.
 */
const DEFAULT_REQUEST_TIMEOUT_MS = 20000;
/**
 * The model-backed routes genuinely take much longer than a normal call, so
 * they raise the deadline rather than the default being loosened for everyone.
 */
const AI_REQUEST_TIMEOUT_MS = 120000;

let hasLoggedBaseUrlResolution = false;
let refreshAccessTokenPromise: Promise<string | null> | null = null;
let sessionInvalidationHandler: (() => Promise<void> | void) | null = null;

const normalizeBaseUrl = (value?: string | null) => {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  return trimmed.replace(/\/+$/, '');
};

const getBundleHost = () => {
  const sourceCodeModule = NativeModules.SourceCode as
    | {
        scriptURL?: string;
        getConstants?: () => {
          scriptURL?: string;
        };
      }
    | undefined;
  const scriptUrl =
    sourceCodeModule?.scriptURL || sourceCodeModule?.getConstants?.().scriptURL;

  if (!scriptUrl) {
    return null;
  }

  const hostMatch = scriptUrl.match(/^https?:\/\/([^/:?#]+)/i);
  return hostMatch?.[1] || null;
};

const logApiClientDev = (event: string, details: Record<string, unknown>) => {
  if (!__DEV__) {
    return;
  }

  console.log(`[apiClient] ${event}`, details);
};

const logBaseUrlResolution = (source: string, resolvedBaseUrl: string) => {
  if (!__DEV__ || hasLoggedBaseUrlResolution) {
    return;
  }

  hasLoggedBaseUrlResolution = true;
  logApiClientDev('base URL resolved', {
    source,
    resolvedBaseUrl,
  });
};

const getBaseUrl = () => {
  const envBaseUrl = normalizeBaseUrl(env.apiBaseUrl);

  if (envBaseUrl) {
    if (!__DEV__ && !envBaseUrl.toLowerCase().startsWith('https://')) {
      throw new Error('A secure HTTPS API base URL is required in release builds.');
    }
    logBaseUrlResolution('env', envBaseUrl);
    return envBaseUrl;
  }

  const configuredBaseUrl = normalizeBaseUrl(
    __DEV__ && !env.isSimulatorFrontendEnv
      ? (devLaunchConfig as DevLaunchConfig).apiBaseUrl
      : null,
  );

  if (configuredBaseUrl) {
    logBaseUrlResolution('devLaunchConfig', configuredBaseUrl);
    return configuredBaseUrl;
  }

  if (__DEV__) {
    const bundleHost = getBundleHost();

    if (bundleHost) {
      const resolvedBaseUrl = `http://${bundleHost}:3001/api/v1`;

      logBaseUrlResolution('bundleHostFallback', resolvedBaseUrl);
      return resolvedBaseUrl;
    }

    if (Platform.OS === 'android') {
      const resolvedBaseUrl = 'http://10.0.2.2:3001/api/v1';

      logBaseUrlResolution('androidEmulatorFallback', resolvedBaseUrl);
      return resolvedBaseUrl;
    }

    const resolvedBaseUrl = 'http://localhost:3001/api/v1';

    logBaseUrlResolution('iosLocalhostFallback', resolvedBaseUrl);
    return resolvedBaseUrl;
  }

  throw new Error('A secure production API URL must be configured.');
};

const getBackendReadinessUrl = () =>
  `${getBaseUrl().replace(/\/api\/v1\/?$/, '')}/ready`;

const getResolvedApiBaseUrl = (
  options: { requireHttpsInRelease?: boolean } = {},
) => {
  const resolvedBaseUrl = getBaseUrl();

  if (
    options.requireHttpsInRelease &&
    !__DEV__ &&
    !resolvedBaseUrl.toLowerCase().startsWith('https://')
  ) {
    throw new Error('The iOS widget requires a secure production API URL.');
  }

  return resolvedBaseUrl;
};

const notifySessionInvalidated = async () => {
  if (!sessionInvalidationHandler) {
    return;
  }

  await sessionInvalidationHandler();
};

const invalidateLocalSession = async () => {
  await clearTokens().catch(() => undefined);
  await notifySessionInvalidated().catch(() => undefined);
};

/**
 * `fetch` plus a deadline. Aborting surfaces as the same network-shaped
 * `ApiError` a dropped connection produces, so every existing caller — the
 * offline fallback in `bootstrapAuthGate`, the connectivity boundary, the
 * screens' retry states — already handles it.
 */
const fetchWithTimeout = async (
  requestUrl: string,
  options: RequestInit,
  timeoutMs: number,
) => {
  const controller = createRequestAbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(requestUrl, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
};

const refreshAccessToken = async (): Promise<string | null> => {
  if (refreshAccessTokenPromise) {
    return refreshAccessTokenPromise;
  }

  refreshAccessTokenPromise = (async () => {
    const tokens = await getTokens();

    if (!tokens?.refreshToken) {
      await invalidateLocalSession();
      return null;
    }

    const requestUrl = `${getBaseUrl()}/auth/refresh`;

    try {
      const response = await fetchWithTimeout(
        requestUrl,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            refreshToken: tokens.refreshToken,
          }),
        },
        DEFAULT_REQUEST_TIMEOUT_MS,
      );

      let payload: ApiResponse<{ accessToken: string }> | null = null;

      try {
        payload = (await response.json()) as ApiResponse<{ accessToken: string }>;
      } catch {
        payload = null;
      }

      if (
        !response.ok ||
        !payload?.success ||
        typeof payload.data?.accessToken !== 'string'
      ) {
        await invalidateLocalSession();
        return null;
      }

      await saveTokens({
        accessToken: payload.data.accessToken,
        refreshToken: tokens.refreshToken,
      });

      return payload.data.accessToken;
    } catch {
      await invalidateLocalSession();
      return null;
    } finally {
      refreshAccessTokenPromise = null;
    }
  })();

  return refreshAccessTokenPromise;
};

type ApiResponse<T> = {
  success: boolean;
  message: string;
  data: T;
  error?: unknown;
};

type ApiErrorOptions = {
  status?: number;
  code?: string;
  details?: unknown;
  isNetworkError?: boolean;
  cause?: unknown;
  requestUrl?: string;
};

type RequestBehaviorOptions = {
  showNetworkAlert?: boolean;
  /** Overrides `DEFAULT_REQUEST_TIMEOUT_MS`. See `AI_REQUEST_TIMEOUT_MS`. */
  timeoutMs?: number;
};

type RequestAdapterInput = {
  path: string;
  method: string;
  options: RequestInit;
  behavior: RequestBehaviorOptions;
};

type RequestAdapter = <T>(
  input: RequestAdapterInput,
) => Promise<ApiResponse<T> | null>;

let requestAdapter: RequestAdapter | null = null;

class ApiError extends Error {
  status?: number;
  code?: string;
  details?: unknown;
  isNetworkError: boolean;
  cause?: unknown;
  requestUrl?: string;

  constructor(message: string, options: ApiErrorOptions = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = options.status;
    this.code = options.code;
    this.details = options.details;
    this.isNetworkError = options.isNetworkError ?? false;
    this.cause = options.cause;
    this.requestUrl = options.requestUrl;
  }
}

const getApiErrorCode = (error: unknown) => {
  if (
    typeof error === 'object' &&
    error &&
    'code' in error &&
    typeof error.code === 'string'
  ) {
    return error.code;
  }

  return undefined;
};

const getApiErrorPaths = (error: unknown) => {
  if (
    typeof error !== 'object' ||
    !error ||
    !('errors' in error) ||
    !Array.isArray(error.errors)
  ) {
    return undefined;
  }

  return error.errors
    .map(item => {
      if (
        typeof item === 'object' &&
        item &&
        'path' in item &&
        typeof item.path === 'string'
      ) {
        return item.path;
      }

      return null;
    })
    .filter((path): path is string => Boolean(path));
};

const isServiceUnavailableStatus = (status: number) =>
  status === 502 || status === 503 || status === 504;

const request = async <T>(
  path: string,
  options: RequestInit = {},
  _behavior: RequestBehaviorOptions = {},
): Promise<ApiResponse<T>> => {
  return requestWithRetry(path, options, _behavior, true);
};

const requestWithRetry = async <T>(
  path: string,
  options: RequestInit,
  _behavior: RequestBehaviorOptions,
  allowAuthRetry: boolean,
): Promise<ApiResponse<T>> => {
  const method = (options.method || 'GET').toUpperCase();

  if (requestAdapter) {
    const adapted = await requestAdapter<T>({
      path,
      method,
      options,
      behavior: _behavior,
    });

    if (adapted) {
      return adapted;
    }
  }

  if (
    getConnectivitySnapshot().status === 'offline' &&
    method !== 'GET' &&
    method !== 'HEAD'
  ) {
    throw new ApiError(
      'Reconnect to the internet before saving changes.',
      { isNetworkError: true },
    );
  }

  const headers = new Headers(options.headers);

  if (!headers.has('Authorization')) {
    const accessToken = await getAccessToken();

    if (accessToken) {
      headers.set('Authorization', `Bearer ${accessToken}`);
    }
  }

  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }

  if (!headers.has('X-Client-Timezone')) {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone?.trim();

    if (timeZone) {
      headers.set('X-Client-Timezone', timeZone);
    }
  }

  const requestUrl = `${getBaseUrl()}${path}`;

  logApiClientDev('request start', {
    requestUrl,
    method: options.method || 'GET',
  });

  let response: Response;

  const timeoutMs = _behavior.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;

  try {
    response = await fetchWithTimeout(
      requestUrl,
      {
        ...options,
        headers,
      },
      timeoutMs,
    );
  } catch (error) {
    reportBackendUnavailable();

    const timedOut = error instanceof Error && error.name === 'AbortError';

    logApiClientDev('request network error', {
      requestUrl,
      method: options.method || 'GET',
      timedOut,
      timeoutMs,
      message:
        error instanceof Error ? error.message : 'Network request failed',
    });

    throw new ApiError(
      timedOut
        ? "That took longer than expected. Please check your connection and try again."
        : "We're having trouble connecting right now. Please check your internet connection and try again.",
      {
        isNetworkError: true,
        cause: error,
        requestUrl,
      },
    );
  }

  if (isServiceUnavailableStatus(response.status)) {
    reportBackendUnavailable();
  } else {
    // Any non-gateway response proves the API is reachable, including 4xx errors.
    reportBackendReachable();
  }

  let payload: ApiResponse<T> | null = null;

  try {
    payload = (await response.json()) as ApiResponse<T>;
  } catch {
    payload = null;
  }

  const canRetryWithRefresh =
    allowAuthRetry &&
    path !== '/auth/refresh' &&
    response.status === 401 &&
    !headers.has('X-Skip-Auth-Retry');

  if (canRetryWithRefresh) {
    const refreshedAccessToken = await refreshAccessToken();

    if (refreshedAccessToken) {
      const retryHeaders = new Headers(options.headers);
      retryHeaders.set('Authorization', `Bearer ${refreshedAccessToken}`);
      retryHeaders.set('X-Skip-Auth-Retry', 'true');

      return requestWithRetry<T>(
        path,
        {
          ...options,
          headers: retryHeaders,
        },
        _behavior,
        false,
      );
    }
  }

  logApiClientDev('response', {
    requestUrl,
    method: options.method || 'GET',
    status: response.status,
    ok: response.ok,
    success: payload?.success ?? null,
    message: payload?.message || null,
    errorCode: getApiErrorCode(payload?.error),
    errorPaths: getApiErrorPaths(payload?.error),
  });

  if (!response.ok || !payload?.success) {
    const message =
      response.status === 404
        ? "We couldn't find what you were looking for."
        : payload?.message ||
          (response.status >= 500
            ? 'Something went wrong. Please try again.'
            : "We couldn't complete that request.");

    throw new ApiError(message, {
      status: response.status,
      code:
        typeof payload?.error === 'object' &&
        payload?.error &&
        'code' in payload.error &&
        typeof payload.error.code === 'string'
          ? payload.error.code
          : undefined,
      details: {
        ...((payload?.error as Record<string, unknown> | undefined) || {}),
        requestUrl,
      },
      isNetworkError: isServiceUnavailableStatus(response.status),
      requestUrl,
    });
  }

  return payload;
};

const registerSessionInvalidationHandler = (
  handler: (() => Promise<void> | void) | null,
) => {
  sessionInvalidationHandler = handler;
};

const registerRequestAdapter = (adapter: RequestAdapter | null) => {
  requestAdapter = adapter;
};

export {
  AI_REQUEST_TIMEOUT_MS,
  ApiError,
  getBackendReadinessUrl,
  getResolvedApiBaseUrl,
  registerRequestAdapter,
  registerSessionInvalidationHandler,
  request,
};
export type {
  ApiResponse,
  RequestAdapter,
  RequestAdapterInput,
  RequestBehaviorOptions,
};
