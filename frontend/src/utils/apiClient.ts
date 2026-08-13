import { NativeModules, Platform } from 'react-native';
import { env } from '../config/env';
import {
  getConnectivitySnapshot,
  reportBackendReachable,
  reportBackendUnavailable,
} from '../services/connectivityService';
import devLaunchConfig from './devLaunchConfig.json';
import {
  clearTokens,
  getAccessToken,
  getTokens,
  saveTokens,
} from './tokenStorage';

type DevLaunchConfig = {
  apiBaseUrl?: string | null;
};

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
      const response = await fetch(requestUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refreshToken: tokens.refreshToken,
        }),
      });

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
};

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

  try {
    response = await fetch(requestUrl, {
      ...options,
      headers,
    });
  } catch (error) {
    reportBackendUnavailable();

    logApiClientDev('request network error', {
      requestUrl,
      method: options.method || 'GET',
      message:
        error instanceof Error ? error.message : 'Network request failed',
    });

    throw new ApiError(
      "We're having trouble connecting right now. Please check your internet connection and try again.",
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

export {
  ApiError,
  getBackendReadinessUrl,
  getResolvedApiBaseUrl,
  registerSessionInvalidationHandler,
  request,
};
export type { ApiResponse, RequestBehaviorOptions };
