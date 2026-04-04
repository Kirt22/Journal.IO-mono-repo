/**
 * @format
 */

describe("apiClient", () => {
  const globalWithFetch = globalThis as typeof globalThis & {
    __DEV__?: boolean;
    fetch?: jest.Mock;
  };
  let alertSpy: jest.Mock;

  beforeEach(() => {
    jest.resetModules();
    globalWithFetch.__DEV__ = true;
    globalWithFetch.fetch = jest.fn();
    alertSpy = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("uses the configured dev API base URL for requests", async () => {
    jest.doMock("@env", () => ({
      API_BASE_URL: "",
      GOOGLE_WEB_CLIENT_ID: "",
      GOOGLE_IOS_CLIENT_ID: "",
    }));
    jest.doMock("react-native", () => ({
      Alert: {
        alert: alertSpy,
      },
      NativeModules: {
        SourceCode: {
          scriptURL: "http://192.168.1.24:8081/index.bundle?platform=ios&dev=true",
        },
      },
      Platform: { OS: "ios" },
    }));
    jest.doMock("../src/utils/devLaunchConfig.json", () => ({
      __esModule: true,
      default: {
        stage: "onboarding",
        activeTab: "home",
        email: null,
        apiBaseUrl: "http://127.0.0.1:5050/api/v1/",
      },
    }));
    jest.doMock("../src/utils/tokenStorage", () => ({
      getAccessToken: jest.fn(async () => null),
    }));

    globalWithFetch.fetch!.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        message: "ok",
        data: { email: "alex@example.com" },
      }),
    });

    const { request } = require("../src/utils/apiClient");

    await request("/auth/sign_up_with_email", {
      method: "POST",
      body: JSON.stringify({
        email: "alex@example.com",
        password: "password123",
      }),
    });

    expect(globalWithFetch.fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:5050/api/v1/auth/sign_up_with_email",
      expect.objectContaining({
        method: "POST",
      })
    );
  });

  test("uses the Metro host in dev when no API override is configured", async () => {
    jest.doMock("@env", () => ({
      API_BASE_URL: "",
      GOOGLE_WEB_CLIENT_ID: "",
      GOOGLE_IOS_CLIENT_ID: "",
    }));
    jest.doMock("react-native", () => ({
      Alert: {
        alert: alertSpy,
      },
      NativeModules: {
        SourceCode: {
          scriptURL: "http://192.168.1.24:8081/index.bundle?platform=ios&dev=true",
        },
      },
      Platform: { OS: "ios" },
    }));
    jest.doMock("../src/utils/devLaunchConfig.json", () => ({
      __esModule: true,
      default: {
        stage: "onboarding",
        activeTab: "home",
        email: null,
        apiBaseUrl: null,
      },
    }));
    jest.doMock("../src/utils/tokenStorage", () => ({
      getAccessToken: jest.fn(async () => null),
    }));

    globalWithFetch.fetch!.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        message: "ok",
        data: { email: "alex@example.com" },
      }),
    });

    const { request } = require("../src/utils/apiClient");

    await request("/auth/sign_up_with_email", {
      method: "POST",
      body: JSON.stringify({
        email: "alex@example.com",
        password: "password123",
      }),
    });

    expect(globalWithFetch.fetch).toHaveBeenCalledWith(
      "http://192.168.1.24:3000/api/v1/auth/sign_up_with_email",
      expect.objectContaining({
        method: "POST",
      })
    );
  });

  test("includes the request URL in 404 route errors", async () => {
    jest.doMock("@env", () => ({
      API_BASE_URL: "",
      GOOGLE_WEB_CLIENT_ID: "",
      GOOGLE_IOS_CLIENT_ID: "",
    }));
    jest.doMock("react-native", () => ({
      Alert: {
        alert: alertSpy,
      },
      NativeModules: {
        SourceCode: {
          scriptURL: "http://192.168.1.24:8081/index.bundle?platform=ios&dev=true",
        },
      },
      Platform: { OS: "ios" },
    }));
    jest.doMock("../src/utils/devLaunchConfig.json", () => ({
      __esModule: true,
      default: {
        stage: "onboarding",
        activeTab: "home",
        email: null,
        apiBaseUrl: "http://127.0.0.1:5050/api/v1",
      },
    }));
    jest.doMock("../src/utils/tokenStorage", () => ({
      getAccessToken: jest.fn(async () => null),
    }));

    globalWithFetch.fetch!.mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({
        success: false,
        message: "Route not found",
        data: {},
      }),
    });

    const { request } = require("../src/utils/apiClient");

    await expect(
      request("/auth/sign_up_with_email", {
        method: "POST",
        body: JSON.stringify({
          email: "alex@example.com",
          password: "password123",
        }),
      })
    ).rejects.toMatchObject({
      message:
        "Route not found for http://127.0.0.1:5050/api/v1/auth/sign_up_with_email",
      requestUrl: "http://127.0.0.1:5050/api/v1/auth/sign_up_with_email",
      status: 404,
    });
  });

  test("shows a network popup when the request cannot reach the server", async () => {
    jest.doMock("@env", () => ({
      API_BASE_URL: "",
      GOOGLE_WEB_CLIENT_ID: "",
      GOOGLE_IOS_CLIENT_ID: "",
    }));
    jest.doMock("react-native", () => ({
      Alert: {
        alert: alertSpy,
      },
      NativeModules: {
        SourceCode: {
          scriptURL: "http://192.168.1.24:8081/index.bundle?platform=ios&dev=true",
        },
      },
      Platform: { OS: "ios" },
    }));
    jest.doMock("../src/utils/devLaunchConfig.json", () => ({
      __esModule: true,
      default: {
        stage: "onboarding",
        activeTab: "home",
        email: null,
        apiBaseUrl: "http://127.0.0.1:5050/api/v1",
      },
    }));
    jest.doMock("../src/utils/tokenStorage", () => ({
      getAccessToken: jest.fn(async () => null),
    }));

    globalWithFetch.fetch!.mockRejectedValue(new Error("Network request failed"));

    const { request } = require("../src/utils/apiClient");

    await expect(
      request("/auth/sign_up_with_email", {
        method: "POST",
        body: JSON.stringify({
          email: "alex@example.com",
          password: "password123",
        }),
      })
    ).rejects.toMatchObject({
      isNetworkError: true,
      message: "Unable to reach the server. Check your connection and try again.",
    });

    expect(alertSpy).toHaveBeenCalledWith(
      "Connection issue",
      "We're having trouble reaching the server. Check your internet connection or make sure the backend is running, then try again."
    );
  });

  test("dedupes repeated network popups during the cooldown window", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-04-01T10:00:00.000Z"));

    jest.doMock("@env", () => ({
      API_BASE_URL: "",
      GOOGLE_WEB_CLIENT_ID: "",
      GOOGLE_IOS_CLIENT_ID: "",
    }));
    jest.doMock("react-native", () => ({
      Alert: {
        alert: alertSpy,
      },
      NativeModules: {
        SourceCode: {
          scriptURL: "http://192.168.1.24:8081/index.bundle?platform=ios&dev=true",
        },
      },
      Platform: { OS: "ios" },
    }));
    jest.doMock("../src/utils/devLaunchConfig.json", () => ({
      __esModule: true,
      default: {
        stage: "onboarding",
        activeTab: "home",
        email: null,
        apiBaseUrl: "http://127.0.0.1:5050/api/v1",
      },
    }));
    jest.doMock("../src/utils/tokenStorage", () => ({
      getAccessToken: jest.fn(async () => null),
    }));

    globalWithFetch.fetch!.mockRejectedValue(new Error("Network request failed"));

    const { request } = require("../src/utils/apiClient");

    await expect(request("/users/profile")).rejects.toMatchObject({
      isNetworkError: true,
    });
    await expect(request("/users/profile")).rejects.toMatchObject({
      isNetworkError: true,
    });

    expect(alertSpy).toHaveBeenCalledTimes(1);

    jest.useRealTimers();
  });
});
