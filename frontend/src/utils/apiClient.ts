import { Alert, NativeModules, Platform } from "react-native";
import devLaunchConfig from "./devLaunchConfig.json";
import { getAccessToken } from "./tokenStorage";

type DevLaunchConfig = {
  apiBaseUrl?: string | null;
};

const NETWORK_ALERT_COOLDOWN_MS = 3000;
const NETWORK_ALERT_TITLE = "Connection issue";
const NETWORK_ALERT_MESSAGE =
  "We're having trouble reaching the server. Check your internet connection or make sure the backend is running, then try again.";

let lastNetworkAlertAt = 0;

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
  const configuredBaseUrl = normalizeBaseUrl(
    __DEV__ ? (devLaunchConfig as DevLaunchConfig).apiBaseUrl : null
  );

  if (configuredBaseUrl) {
    return configuredBaseUrl;
  }

  const bundleHost = __DEV__ ? getBundleHost() : null;

  if (bundleHost) {
    return `http://${bundleHost}:3000/api/v1`;
  }

  if (Platform.OS === "android") {
    return "http://10.0.2.2:3000/api/v1";
  }

  return "http://localhost:3000/api/v1";
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

const request = async <T>(
  path: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> => {
  const headers = new Headers(options.headers);
  const method = options.method || "GET";

  if (!headers.has("Authorization")) {
    const accessToken = await getAccessToken();

    if (accessToken) {
      headers.set("Authorization", `Bearer ${accessToken}`);
    }
  }

  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }

  const requestUrl = `${getBaseUrl()}${path}`;

  if (__DEV__) {
    console.log("[apiClient] request start", {
      requestUrl,
      method,
      hasBody: Boolean(options.body),
    });
  }

  let response: Response;

  try {
    response = await fetch(requestUrl, {
      ...options,
      headers,
    });
  } catch (error) {
    if (__DEV__) {
      console.log("[apiClient] request failed before response", {
        requestUrl,
        method,
        error,
      });
    }

    showNetworkIssueAlert();

    throw new ApiError(
      "Unable to reach the server. Check your connection and try again.",
      {
        isNetworkError: true,
        cause: error,
        requestUrl,
      }
    );
  }

  if (__DEV__) {
    console.log("[apiClient] response received", {
      requestUrl,
      method,
      status: response.status,
      ok: response.ok,
    });
  }

  let payload: ApiResponse<T> | null = null;

  try {
    payload = (await response.json()) as ApiResponse<T>;
  } catch {
    payload = null;
  }

  if (__DEV__) {
    console.log("[apiClient] response payload", {
      requestUrl,
      method,
      payload,
    });
  }

  if (!response.ok || !payload?.success) {
    const message =
      response.status === 404
        ? `Route not found for ${requestUrl}`
        : payload?.message ||
          (response.status >= 500
            ? "Server error. Please try again."
            : "Request failed.");

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
