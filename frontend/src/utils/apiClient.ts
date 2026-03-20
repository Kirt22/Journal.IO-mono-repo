import { Platform } from "react-native";
import { getAccessToken } from "./tokenStorage";

const getBaseUrl = () => {
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

  const response = await fetch(`${getBaseUrl()}${path}`, {
    ...options,
    headers,
  });

  const payload = (await response.json()) as ApiResponse<T>;

  if (!response.ok || !payload.success) {
    const message =
      payload?.message ||
      (response.status >= 500
        ? "Server error. Please try again."
        : "Request failed.");
    throw new Error(message);
  }

  return payload;
};

export { request };
export type { ApiResponse };
