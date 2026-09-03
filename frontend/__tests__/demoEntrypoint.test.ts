/**
 * The demo entry point has one ordering requirement that is easy to regress and
 * expensive to discover: native calls runApplication as soon as the bundle
 * finishes executing, so AppRegistry.registerComponent must happen
 * synchronously. Awaiting the bootstrap first made launches fail intermittently
 * with `"JournalFrontend" has not been registered`.
 */
const calls: string[] = [];

jest.mock('react-native', () => ({
  Alert: { alert: jest.fn() },
  AppRegistry: { registerComponent: jest.fn() },
}));

jest.mock('../src/demo/bootstrap', () => ({
  installDemoRequestAdapter: jest.fn(() => {
    calls.push('install-adapter');
  }),
  bootstrapDemoMode: jest.fn(
    () =>
      new Promise<void>(resolve => {
        calls.push('bootstrap-start');
        setTimeout(() => {
          calls.push('bootstrap-end');
          resolve();
        }, 0);
      }),
  ),
}));

jest.mock('../index', () => {
  calls.push('register-app');
  return {};
});

describe('index.demo entry point', () => {
  test('claims the request seam, then registers the app synchronously', () => {
    jest.isolateModules(() => {
      require('../index.demo');
    });

    expect(calls.indexOf('register-app')).toBeGreaterThan(-1);
    // The adapter is installed before anything can render and fire a request.
    expect(calls.indexOf('install-adapter')).toBeLessThan(
      calls.indexOf('register-app'),
    );
    // Registration does not wait on the async bootstrap finishing.
    expect(calls.indexOf('register-app')).toBeLessThan(
      calls.indexOf('bootstrap-end') === -1
        ? Number.MAX_SAFE_INTEGER
        : calls.indexOf('bootstrap-end'),
    );
    expect(calls).not.toContain('bootstrap-end');
  });
});
