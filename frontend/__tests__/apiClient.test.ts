/**
 * @format
 */

describe("apiClient", () => {
  const globalWithFetch = globalThis as typeof globalThis & {
    __DEV__?: boolean;
    fetch?: jest.Mock;
  };

  beforeEach(() => {
    jest.resetModules();
    globalWithFetch.__DEV__ = true;
    globalWithFetch.fetch = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("uses the configured dev API base URL for requests", async () => {
    jest.doMock("react-native", () => ({
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
    jest.doMock("react-native", () => ({
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
    jest.doMock("react-native", () => ({
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
});
