import { Platform } from "react-native";

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
  const response = await fetch(`${getBaseUrl()}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
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
