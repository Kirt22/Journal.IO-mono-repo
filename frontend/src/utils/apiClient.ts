import { Alert, NativeModules, Platform } from "react-native";
import { env } from "../config/env";
import devLaunchConfig from "./devLaunchConfig.json";
import { getAccessToken } from "./tokenStorage";

type DevLaunchConfig = {
  apiBaseUrl?: string | null;
};

const NETWORK_ALERT_COOLDOWN_MS = 3000;
const NETWORK_ALERT_TITLE = "Connection issue";
const NETWORK_ALERT_MESSAGE =
  "We're having trouble connecting right now. Please check your internet connection and try again.";

let lastNetworkAlertAt = 0;
let hasLoggedBaseUrlResolution = false;
const isJestRuntime =
  typeof process !== "undefined" && Boolean(process.env.JEST_WORKER_ID);

const normalizeBaseUrl = (value?: string | null) => {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  return trimmed.replace(/\/+$/, "");
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

const getBaseUrl = () => {
  const envBaseUrl = isJestRuntime ? null : normalizeBaseUrl(env.apiBaseUrl);

  if (envBaseUrl) {
    if (__DEV__ && !hasLoggedBaseUrlResolution) {
      hasLoggedBaseUrlResolution = true;
      console.log("[apiClient] base URL resolved", {
        source: "env",
        resolvedBaseUrl: envBaseUrl,
      });
    }

    return envBaseUrl;
  }

  const configuredBaseUrl = normalizeBaseUrl(
    __DEV__ ? (devLaunchConfig as DevLaunchConfig).apiBaseUrl : null
  );

  if (configuredBaseUrl) {
    if (__DEV__ && !hasLoggedBaseUrlResolution) {
      hasLoggedBaseUrlResolution = true;
      console.log("[apiClient] base URL resolved", {
        source: "devLaunchConfig",
        resolvedBaseUrl: configuredBaseUrl,
      });
    }

    return configuredBaseUrl;
  }

  const bundleHost = __DEV__ ? getBundleHost() : null;

  if (bundleHost) {
    const resolvedBaseUrl = `http://${bundleHost}:3000/api/v1`;

    if (__DEV__ && !hasLoggedBaseUrlResolution) {
      hasLoggedBaseUrlResolution = true;
      console.log("[apiClient] base URL resolved", {
        source: "bundleHostFallback",
        resolvedBaseUrl,
      });
    }

    return resolvedBaseUrl;
  }

  if (Platform.OS === "android") {
    const resolvedBaseUrl = "http://10.0.2.2:3000/api/v1";

    if (__DEV__ && !hasLoggedBaseUrlResolution) {
      hasLoggedBaseUrlResolution = true;
      console.log("[apiClient] base URL resolved", {
        source: "androidEmulatorFallback",
        resolvedBaseUrl,
      });
    }

    return resolvedBaseUrl;
  }

  const resolvedBaseUrl = "http://localhost:3000/api/v1";

  if (__DEV__ && !hasLoggedBaseUrlResolution) {
    hasLoggedBaseUrlResolution = true;
    console.log("[apiClient] base URL resolved", {
      source: "iosLocalhostFallback",
      resolvedBaseUrl,
    });
  }

  return resolvedBaseUrl;
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

class ApiError extends Error {
  status?: number;
  code?: string;
  details?: unknown;
  isNetworkError: boolean;
  cause?: unknown;
  requestUrl?: string;

  constructor(message: string, options: ApiErrorOptions = {}) {
    super(message);
    this.name = "ApiError";
    this.status = options.status;
    this.code = options.code;
    this.details = options.details;
    this.isNetworkError = options.isNetworkError ?? false;
    this.cause = options.cause;
    this.requestUrl = options.requestUrl;
  }
}

const showNetworkIssueAlert = () => {
  const now = Date.now();

  if (now - lastNetworkAlertAt < NETWORK_ALERT_COOLDOWN_MS) {
    return;
  }

  lastNetworkAlertAt = now;
  Alert.alert(NETWORK_ALERT_TITLE, NETWORK_ALERT_MESSAGE);
};

const getApiErrorCode = (error: unknown) => {
  if (
    typeof error === "object" &&
    error &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return error.code;
  }

  return undefined;
};

const getApiErrorPaths = (error: unknown) => {
  if (
    typeof error !== "object" ||
    !error ||
    !("errors" in error) ||
    !Array.isArray(error.errors)
  ) {
    return undefined;
  }

  return error.errors
    .map(item => {
      if (
        typeof item === "object" &&
        item &&
        "path" in item &&
        typeof item.path === "string"
      ) {
        return item.path;
      }

      return null;
    })
    .filter((path): path is string => Boolean(path));
};

const request = async <T>(
  path: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> => {
  const headers = new Headers(options.headers);

  if (!headers.has("Authorization")) {
    const accessToken = await getAccessToken();

    if (accessToken) {
      headers.set("Authorization", `Bearer ${accessToken}`);
    }
  }

  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }

  if (!headers.has("X-Client-Timezone")) {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone?.trim();

    if (timeZone) {
      headers.set("X-Client-Timezone", timeZone);
    }
  }

  const requestUrl = `${getBaseUrl()}${path}`;

  if (__DEV__) {
    console.log("[apiClient] request start", {
      requestUrl,
      method: options.method || "GET",
    });
  }

  let response: Response;

  try {
    response = await fetch(requestUrl, {
      ...options,
      headers,
    });
  } catch (error) {
    showNetworkIssueAlert();

    if (__DEV__) {
      console.log("[apiClient] request network error", {
        requestUrl,
        method: options.method || "GET",
        message: error instanceof Error ? error.message : "Network request failed",
      });
    }

    throw new ApiError(
      "We're having trouble connecting right now. Please check your internet connection and try again.",
      {
        isNetworkError: true,
        cause: error,
        requestUrl,
      }
    );
  }

  let payload: ApiResponse<T> | null = null;

  try {
    payload = (await response.json()) as ApiResponse<T>;
  } catch {
    payload = null;
  }

  if (__DEV__) {
    console.log("[apiClient] response", {
      requestUrl,
      method: options.method || "GET",
      status: response.status,
      ok: response.ok,
      success: payload?.success ?? null,
      message: payload?.message || null,
      errorCode: getApiErrorCode(payload?.error),
      errorPaths: getApiErrorPaths(payload?.error),
    });
  }

  if (!response.ok || !payload?.success) {
    const message =
      response.status === 404
        ? "We couldn't find what you were looking for."
        : payload?.message ||
          (response.status >= 500
            ? "Something went wrong. Please try again."
            : "We couldn't complete that request.");

    throw new ApiError(message, {
      status: response.status,
      code:
        typeof payload?.error === "object" &&
        payload?.error &&
        "code" in payload.error &&
        typeof payload.error.code === "string"
          ? payload.error.code
          : undefined,
      details: {
        ...((payload?.error as Record<string, unknown> | undefined) || {}),
        requestUrl,
      },
      requestUrl,
    });
  }

  return payload;
};

export { ApiError, request };
export type { ApiResponse };
