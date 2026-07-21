import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  ConnectivityBoundary,
} from '../src/components/ConnectivityBoundary';
import OfflineBanner from '../src/components/OfflineBanner';
import {
  reportBackendReachable,
  reportBackendUnavailable,
  resetConnectivityForTests,
} from '../src/services/connectivityService';
import { resetAppStore, useAppStore } from '../src/store/appStore';
import { ThemeProvider } from '../src/theme/provider';

const safeAreaMetrics = {
  frame: { height: 844, width: 390, x: 0, y: 0 },
  insets: { bottom: 34, left: 0, right: 0, top: 47 },
};

const renderBoundary = () =>
  ReactTestRenderer.create(
    <ThemeProvider modeOverride="light">
      <ConnectivityBoundary>
        <Text testID="protected-content">Draft stays mounted</Text>
      </ConnectivityBoundary>
    </ThemeProvider>,
  );

const setCachedAuthenticatedSession = () => {
  useAppStore.setState({
    hasBootstrappedAuthGate: true,
    sessionValidationState: 'cached',
    stage: 'main-app',
    session: {
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      user: {
        userId: 'user-1',
        name: 'Journal User',
        phoneNumber: null,
        email: 'journal@example.com',
        journalingGoals: [],
        avatarColor: null,
        profileSetupCompleted: true,
        onboardingCompleted: true,
        profilePic: null,
        aiOptIn: true,
      },
    },
  });
};

describe('ConnectivityBoundary', () => {
  beforeEach(() => {
    resetAppStore();
    resetConnectivityForTests('offline');
  });

  test('shows only the themed gate before a signed-out launch is ready', async () => {
    let root: ReactTestRenderer.ReactTestRenderer;

    await ReactTestRenderer.act(() => {
      root = renderBoundary();
    });

    expect(root!.root.findByProps({ testID: 'connectivity-gate' })).toBeTruthy();
    expect(root!.root.findAllByProps({ testID: 'protected-content' })).toHaveLength(0);

    await ReactTestRenderer.act(() => {
      useAppStore.setState({ hasBootstrappedAuthGate: true, stage: 'auth' });
      reportBackendReachable();
    });

    expect(root!.root.findByProps({ testID: 'protected-content' })).toBeTruthy();
    expect(root!.root.findAllByProps({ testID: 'connectivity-gate' })).toHaveLength(0);
    root!.unmount();
  });

  test('keeps an interrupted auth screen mounted beneath the overlay', async () => {
    useAppStore.setState({ hasBootstrappedAuthGate: true, stage: 'sign-in' });
    reportBackendReachable();
    let root: ReactTestRenderer.ReactTestRenderer;

    await ReactTestRenderer.act(() => {
      root = renderBoundary();
    });

    await ReactTestRenderer.act(() => {
      reportBackendUnavailable();
    });

    expect(root!.root.findByProps({ testID: 'protected-content' })).toBeTruthy();
    expect(root!.root.findByProps({ testID: 'connectivity-overlay' })).toBeTruthy();
    root!.unmount();
  });

  test('does not trust an authenticated route without a real session', async () => {
    useAppStore.setState({
      hasBootstrappedAuthGate: true,
      session: null,
      sessionValidationState: 'none',
      stage: 'main-app',
    });
    let root: ReactTestRenderer.ReactTestRenderer;

    await ReactTestRenderer.act(() => {
      root = renderBoundary();
    });

    expect(root!.root.findByProps({ testID: 'connectivity-gate' })).toBeTruthy();
    expect(root!.root.findAllByProps({ testID: 'protected-content' })).toHaveLength(0);
    root!.unmount();
  });

  test('keeps the authenticated app visible with an offline banner', async () => {
    setCachedAuthenticatedSession();
    let root: ReactTestRenderer.ReactTestRenderer;

    await ReactTestRenderer.act(() => {
      root = ReactTestRenderer.create(
        <ThemeProvider modeOverride="dark">
          <SafeAreaProvider initialMetrics={safeAreaMetrics}>
            <ConnectivityBoundary>
              <Text testID="protected-content">Cached home</Text>
              <OfflineBanner />
            </ConnectivityBoundary>
          </SafeAreaProvider>
        </ThemeProvider>,
      );
    });

    expect(root!.root.findByProps({ testID: 'protected-content' })).toBeTruthy();
    expect(root!.root.findAllByProps({ testID: 'connectivity-gate' })).toHaveLength(0);
    expect(root!.root.findByProps({ testID: 'offline-banner' })).toBeTruthy();
    root!.unmount();
  });
});
