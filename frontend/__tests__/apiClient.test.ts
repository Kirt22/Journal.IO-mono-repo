/**
 * @format
 */

describe('apiClient', () => {
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
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('uses the selected env API base URL even when a dev launch override is configured', async () => {
    jest.doMock('react-native', () => ({
      Alert: {
        alert: alertSpy,
      },
      NativeModules: {
        SourceCode: {
          scriptURL:
            'http://192.168.1.24:8081/index.bundle?platform=ios&dev=true',
        },
      },
      Platform: { OS: 'ios' },
    }));
    jest.doMock('../src/utils/devLaunchConfig.json', () => ({
      __esModule: true,
      default: {
        replayOnboarding: false,
        apiBaseUrl: 'http://192.168.1.24:3001/api/v1',
      },
    }));
    jest.doMock('../src/utils/tokenStorage', () => ({
      getAccessToken: jest.fn(async () => null),
    }));
    const { env } = require('../src/config/env');
    env.apiBaseUrl = 'http://127.0.0.1:5050/api/v1/';
    env.isSimulatorFrontendEnv = false;

    globalWithFetch.fetch!.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        message: 'ok',
        data: { email: 'alex@example.com' },
      }),
    });

    const { request } = require('../src/utils/apiClient');

    await request('/auth/sign_up_with_email', {
      method: 'POST',
      body: JSON.stringify({
        email: 'alex@example.com',
        password: 'password123',
      }),
    });

    expect(globalWithFetch.fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:5050/api/v1/auth/sign_up_with_email',
      expect.objectContaining({
        method: 'POST',
      }),
    );
  });

  test('uses the dev launch config API base URL when the env API base URL is missing', async () => {
    jest.doMock('react-native', () => ({
      Alert: {
        alert: alertSpy,
      },
      NativeModules: {
        SourceCode: {
          scriptURL:
            'http://192.168.1.24:8081/index.bundle?platform=ios&dev=true',
        },
      },
      Platform: { OS: 'ios' },
    }));
    jest.doMock('../src/utils/devLaunchConfig.json', () => ({
      __esModule: true,
      default: {
        replayOnboarding: false,
        apiBaseUrl: 'http://127.0.0.1:5050/api/v1/',
      },
    }));
    jest.doMock('../src/utils/tokenStorage', () => ({
      getAccessToken: jest.fn(async () => null),
    }));
    const { env } = require('../src/config/env');
    env.apiBaseUrl = null;
    env.isSimulatorFrontendEnv = false;

    globalWithFetch.fetch!.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        message: 'ok',
        data: { email: 'alex@example.com' },
      }),
    });

    const { request } = require('../src/utils/apiClient');

    await request('/auth/sign_up_with_email', {
      method: 'POST',
      body: JSON.stringify({
        email: 'alex@example.com',
        password: 'password123',
      }),
    });

    expect(globalWithFetch.fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:5050/api/v1/auth/sign_up_with_email',
      expect.objectContaining({
        method: 'POST',
      }),
    );
  });

  test('uses the Metro host in dev when no API override is configured', async () => {
    jest.doMock('react-native', () => ({
      Alert: {
        alert: alertSpy,
      },
      NativeModules: {
        SourceCode: {
          scriptURL:
            'http://192.168.1.24:8081/index.bundle?platform=ios&dev=true',
        },
      },
      Platform: { OS: 'ios' },
    }));
    jest.doMock('../src/utils/devLaunchConfig.json', () => ({
      __esModule: true,
      default: {
        replayOnboarding: false,
        apiBaseUrl: null,
      },
    }));
    jest.doMock('../src/utils/tokenStorage', () => ({
      getAccessToken: jest.fn(async () => null),
    }));
    const { env } = require('../src/config/env');
    env.apiBaseUrl = null;
    env.isSimulatorFrontendEnv = false;

    globalWithFetch.fetch!.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        message: 'ok',
        data: { email: 'alex@example.com' },
      }),
    });

    const { request } = require('../src/utils/apiClient');

    await request('/auth/sign_up_with_email', {
      method: 'POST',
      body: JSON.stringify({
        email: 'alex@example.com',
        password: 'password123',
      }),
    });

    expect(globalWithFetch.fetch).toHaveBeenCalledWith(
      'http://192.168.1.24:3001/api/v1/auth/sign_up_with_email',
      expect.objectContaining({
        method: 'POST',
      }),
    );
  });

  test('uses the simulator env API URL instead of dev launch config in simulator mode', async () => {
    jest.doMock('react-native', () => ({
      Alert: {
        alert: alertSpy,
      },
      NativeModules: {
        SourceCode: {
          scriptURL: 'http://localhost:8081/index.bundle?platform=ios&dev=true',
        },
      },
      Platform: { OS: 'ios' },
    }));
    jest.doMock('../src/utils/devLaunchConfig.json', () => ({
      __esModule: true,
      default: {
        replayOnboarding: false,
        apiBaseUrl: 'http://192.168.1.236:3001/api/v1',
      },
    }));
    jest.doMock('../src/utils/tokenStorage', () => ({
      getAccessToken: jest.fn(async () => null),
    }));
    const { env } = require('../src/config/env');
    env.apiBaseUrl = 'http://127.0.0.1:3001/api/v1';
    env.isSimulatorFrontendEnv = true;

    globalWithFetch.fetch!.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        message: 'ok',
        data: { email: 'alex@example.com' },
      }),
    });

    const { request } = require('../src/utils/apiClient');

    await request('/auth/sign_up_with_email', {
      method: 'POST',
      body: JSON.stringify({
        email: 'alex@example.com',
        password: 'password123',
      }),
    });

    expect(globalWithFetch.fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:3001/api/v1/auth/sign_up_with_email',
      expect.objectContaining({
        method: 'POST',
      }),
    );
  });

  test('uses the configured production API URL in a dev build when dev launch config targets production', async () => {
    jest.doMock('../src/config/env', () => ({
      env: {
        apiBaseUrl: null,
      },
    }));
    jest.doMock('react-native', () => ({
      Alert: {
        alert: alertSpy,
      },
      NativeModules: {
        SourceCode: {
          scriptURL:
            'http://192.168.1.24:8081/index.bundle?platform=ios&dev=true',
        },
      },
      Platform: { OS: 'ios' },
    }));
    jest.doMock('../src/utils/devLaunchConfig.json', () => ({
      __esModule: true,
      default: {
        replayOnboarding: false,
        apiBaseUrl: 'https://api.journalio.app/api/v1',
      },
    }));
    jest.doMock('../src/utils/tokenStorage', () => ({
      getAccessToken: jest.fn(async () => null),
    }));

    globalWithFetch.fetch!.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        message: 'ok',
        data: { email: 'alex@example.com' },
      }),
    });

    const { request } = require('../src/utils/apiClient');

    await request('/auth/sign_up_with_email', {
      method: 'POST',
      body: JSON.stringify({
        email: 'alex@example.com',
        password: 'password123',
      }),
    });

    expect(globalWithFetch.fetch).toHaveBeenCalledWith(
      'https://api.journalio.app/api/v1/auth/sign_up_with_email',
      expect.objectContaining({
        method: 'POST',
      }),
    );
  });

  test('includes the request URL in 404 route errors', async () => {
    jest.doMock('@env', () => ({
      API_BASE_URL: '',
      GOOGLE_WEB_CLIENT_ID: '',
      GOOGLE_IOS_CLIENT_ID: '',
    }));
    jest.doMock('react-native', () => ({
      Alert: {
        alert: alertSpy,
      },
      NativeModules: {
        SourceCode: {
          scriptURL:
            'http://192.168.1.24:8081/index.bundle?platform=ios&dev=true',
        },
      },
      Platform: { OS: 'ios' },
    }));
    jest.doMock('../src/utils/devLaunchConfig.json', () => ({
      __esModule: true,
      default: {
        replayOnboarding: false,
        apiBaseUrl: 'http://127.0.0.1:5050/api/v1',
      },
    }));
    jest.doMock('../src/utils/tokenStorage', () => ({
      getAccessToken: jest.fn(async () => null),
    }));

    globalWithFetch.fetch!.mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({
        success: false,
        message: 'Route not found',
        data: {},
      }),
    });

    const { request } = require('../src/utils/apiClient');

    await expect(
      request('/auth/sign_up_with_email', {
        method: 'POST',
        body: JSON.stringify({
          email: 'alex@example.com',
          password: 'password123',
        }),
      }),
    ).rejects.toMatchObject({
      message: "We couldn't find what you were looking for.",
      requestUrl: 'http://127.0.0.1:5050/api/v1/auth/sign_up_with_email',
      status: 404,
    });
  });

  test('reports shared offline state when the request cannot reach the server', async () => {
    jest.doMock('@env', () => ({
      API_BASE_URL: '',
      GOOGLE_WEB_CLIENT_ID: '',
      GOOGLE_IOS_CLIENT_ID: '',
    }));
    jest.doMock('react-native', () => ({
      Alert: {
        alert: alertSpy,
      },
      NativeModules: {
        SourceCode: {
          scriptURL:
            'http://192.168.1.24:8081/index.bundle?platform=ios&dev=true',
        },
      },
      Platform: { OS: 'ios' },
    }));
    jest.doMock('../src/utils/devLaunchConfig.json', () => ({
      __esModule: true,
      default: {
        replayOnboarding: false,
        apiBaseUrl: 'http://127.0.0.1:5050/api/v1',
      },
    }));
    jest.doMock('../src/utils/tokenStorage', () => ({
      getAccessToken: jest.fn(async () => null),
    }));

    globalWithFetch.fetch!.mockRejectedValue(
      new Error('Network request failed'),
    );

    const { request } = require('../src/utils/apiClient');

    await expect(
      request('/auth/sign_up_with_email', {
        method: 'POST',
        body: JSON.stringify({
          email: 'alex@example.com',
          password: 'password123',
        }),
      }),
    ).rejects.toMatchObject({
      isNetworkError: true,
      message:
        "We're having trouble connecting right now. Please check your internet connection and try again.",
    });

    const { getConnectivitySnapshot } = require('../src/services/connectivityService');

    expect(getConnectivitySnapshot().status).toBe('offline');
    expect(alertSpy).not.toHaveBeenCalled();
  });

  test('allows auth screens to suppress the global network popup', async () => {
    jest.doMock('@env', () => ({
      API_BASE_URL: '',
      GOOGLE_WEB_CLIENT_ID: '',
      GOOGLE_IOS_CLIENT_ID: '',
    }));
    jest.doMock('react-native', () => ({
      Alert: {
        alert: alertSpy,
      },
      NativeModules: {
        SourceCode: {
          scriptURL:
            'http://192.168.1.24:8081/index.bundle?platform=ios&dev=true',
        },
      },
      Platform: { OS: 'ios' },
    }));
    jest.doMock('../src/utils/devLaunchConfig.json', () => ({
      __esModule: true,
      default: {
        replayOnboarding: false,
        apiBaseUrl: 'http://127.0.0.1:5050/api/v1',
      },
    }));
    jest.doMock('../src/utils/tokenStorage', () => ({
      getAccessToken: jest.fn(async () => null),
    }));

    globalWithFetch.fetch!.mockRejectedValue(
      new Error('Network request failed'),
    );

    const { request } = require('../src/utils/apiClient');

    await expect(
      request(
        '/auth/sign_in_with_email',
        {
          method: 'POST',
          body: JSON.stringify({
            email: 'alex@example.com',
            password: 'password123',
          }),
        },
        { showNetworkAlert: false },
      ),
    ).rejects.toMatchObject({
      isNetworkError: true,
    });

    expect(alertSpy).not.toHaveBeenCalled();
  });

  test('logs sanitized response details in dev mode', async () => {
    jest.doMock('@env', () => ({
      API_BASE_URL: '',
      GOOGLE_WEB_CLIENT_ID: '',
      GOOGLE_IOS_CLIENT_ID: '',
    }));
    jest.doMock('react-native', () => ({
      Alert: {
        alert: alertSpy,
      },
      NativeModules: {
        SourceCode: {
          scriptURL:
            'http://192.168.1.24:8081/index.bundle?platform=ios&dev=true',
        },
      },
      Platform: { OS: 'ios' },
    }));
    jest.doMock('../src/utils/devLaunchConfig.json', () => ({
      __esModule: true,
      default: {
        replayOnboarding: false,
        apiBaseUrl: 'http://127.0.0.1:5050/api/v1',
      },
    }));
    jest.doMock('../src/utils/tokenStorage', () => ({
      getAccessToken: jest.fn(async () => null),
    }));

    globalWithFetch.fetch!.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        success: false,
        message: 'Please review the details and try again.',
        data: {},
        error: {
          code: 'VALIDATION_FAILED',
          errors: [
            {
              path: 'body.email',
              message: 'Expected string',
            },
          ],
        },
      }),
    });

    const { request } = require('../src/utils/apiClient');

    await expect(
      request('/auth/apple/mobile', { method: 'POST' }),
    ).rejects.toMatchObject({
      message: 'Please review the details and try again.',
      status: 400,
    });

    expect(console.log).toHaveBeenCalledWith('[apiClient] response', {
      requestUrl: 'http://127.0.0.1:5050/api/v1/auth/apple/mobile',
      method: 'POST',
      status: 400,
      ok: false,
      success: false,
      message: 'Please review the details and try again.',
      errorCode: 'VALIDATION_FAILED',
      errorPaths: ['body.email'],
    });
  });

  test('keeps repeated network failures on the shared offline surface', async () => {
    jest.doMock('@env', () => ({
      API_BASE_URL: '',
      GOOGLE_WEB_CLIENT_ID: '',
      GOOGLE_IOS_CLIENT_ID: '',
    }));
    jest.doMock('react-native', () => ({
      Alert: {
        alert: alertSpy,
      },
      NativeModules: {
        SourceCode: {
          scriptURL:
            'http://192.168.1.24:8081/index.bundle?platform=ios&dev=true',
        },
      },
      Platform: { OS: 'ios' },
    }));
    jest.doMock('../src/utils/devLaunchConfig.json', () => ({
      __esModule: true,
      default: {
        replayOnboarding: false,
        apiBaseUrl: 'http://127.0.0.1:5050/api/v1',
      },
    }));
    jest.doMock('../src/utils/tokenStorage', () => ({
      getAccessToken: jest.fn(async () => null),
    }));

    globalWithFetch.fetch!.mockRejectedValue(
      new Error('Network request failed'),
    );

    const { request } = require('../src/utils/apiClient');

    await expect(request('/users/profile')).rejects.toMatchObject({
      isNetworkError: true,
    });
    await expect(request('/users/profile')).rejects.toMatchObject({
      isNetworkError: true,
    });

    const { getConnectivitySnapshot } = require('../src/services/connectivityService');

    expect(getConnectivitySnapshot().status).toBe('offline');
    expect(alertSpy).not.toHaveBeenCalled();
  });

  test('refreshes the access token once and retries the original request after a 401', async () => {
    const saveTokens = jest.fn(async () => undefined);
    const clearTokens = jest.fn(async () => undefined);

    jest.doMock('react-native', () => ({
      Alert: {
        alert: alertSpy,
      },
      NativeModules: {
        SourceCode: {
          scriptURL:
            'http://192.168.1.24:8081/index.bundle?platform=ios&dev=true',
        },
      },
      Platform: { OS: 'ios' },
    }));
    jest.doMock('../src/utils/devLaunchConfig.json', () => ({
      __esModule: true,
      default: {
        replayOnboarding: false,
        apiBaseUrl: 'http://127.0.0.1:5050/api/v1',
      },
    }));
    jest.doMock('../src/utils/tokenStorage', () => ({
      clearTokens,
      getAccessToken: jest.fn(async () => 'stale-access-token'),
      getTokens: jest.fn(async () => ({
        accessToken: 'stale-access-token',
        refreshToken: 'refresh-token',
      })),
      saveTokens,
    }));

    globalWithFetch.fetch!
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({
          success: false,
          message: 'Please sign in to continue.',
          error: {},
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          message: 'refreshed',
          data: { accessToken: 'fresh-access-token' },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          message: 'ok',
          data: { userId: 'user-123' },
        }),
      });

    const { request } = require('../src/utils/apiClient');

    await expect(request('/users/profile')).resolves.toMatchObject({
      data: { userId: 'user-123' },
    });

    expect(saveTokens).toHaveBeenCalledWith({
      accessToken: 'fresh-access-token',
      refreshToken: 'refresh-token',
    });
    expect(clearTokens).not.toHaveBeenCalled();
    expect(globalWithFetch.fetch).toHaveBeenNthCalledWith(
      2,
      'http://127.0.0.1:5050/api/v1/auth/refresh',
      expect.objectContaining({
        method: 'POST',
      }),
    );
    expect(globalWithFetch.fetch).toHaveBeenNthCalledWith(
      3,
      'http://127.0.0.1:5050/api/v1/users/profile',
      expect.objectContaining({
        headers: expect.any(Headers),
      }),
    );
  });
});
