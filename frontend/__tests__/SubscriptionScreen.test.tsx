/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Alert } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import SubscriptionScreen from '../src/screens/profile/SubscriptionScreen';
import { useAppStore, resetAppStore } from '../src/store/appStore';
import {
  refreshRevenueCatEntitlementState,
  restoreRevenueCatPurchases,
} from '../src/services/revenueCatService';
import { syncPaywallPurchase } from '../src/services/paywallService';

const originalConsoleError = console.error;

jest.mock('../src/services/revenueCatService', () => ({
  getRevenueCatActiveEntitlement: jest.fn(
    customerInfo =>
      customerInfo?.entitlements?.active?.['Journal.IO Pro'] ?? null,
  ),
  getRevenueCatConfigurationError: jest.fn(() => null),
  getRevenueCatOfferings: jest.fn(async () => ({ current: null, all: {} })),
  getRevenueCatPurchaseAttribution: jest.fn(customerInfo => {
    const activeEntitlement =
      customerInfo?.entitlements?.active?.['Journal.IO Pro'] ?? null;

    if (!activeEntitlement?.productIdentifier) {
      return null;
    }

    return {
      activeEntitlement,
      offeringKey: 'weekly',
      productIdentifier: activeEntitlement.productIdentifier,
      revenueCatOfferingId: 'journalio_offering_other_screens_standard',
      revenueCatPackageId: activeEntitlement.productIdentifier,
      rcPackage: null,
    };
  }),
  refreshRevenueCatEntitlementState: jest.fn(async () => ({
    hasPremiumAccess: true,
    customerInfo: {
      entitlements: {
        active: {
          'Journal.IO Pro': {
            identifier: 'Journal.IO Pro',
            isActive: true,
            store: 'APP_STORE',
          },
        },
      },
    },
  })),
  getRevenueCatCustomerInfo: jest.fn(async () => ({
    entitlements: {
      active: {
        'Journal.IO Pro': {
          identifier: 'Journal.IO Pro',
          isActive: true,
          store: 'APP_STORE',
        },
      },
    },
  })),
  hasRevenueCatPremiumAccess: jest.fn(customerInfo =>
    Boolean(customerInfo?.entitlements?.active?.['Journal.IO Pro']?.isActive),
  ),
  hasPremiumAccess: jest.fn(customerInfo =>
    Boolean(customerInfo?.entitlements?.active?.['Journal.IO Pro']?.isActive),
  ),
  restoreRevenueCatPurchases: jest.fn(async () => ({
    entitlements: {
      active: {
        'Journal.IO Pro': {
          identifier: 'Journal.IO Pro',
          isActive: true,
          store: 'APP_STORE',
        },
      },
    },
  })),
}));

jest.mock('../src/services/paywallService', () => ({
  isRetryableEntitlementSyncError: jest.fn(
    error => (error as { isRetryableSync?: boolean })?.isRetryableSync === true,
  ),
  syncPaywallPurchase: jest.fn(async () => ({
    userId: 'user-test',
    name: 'Premium User',
    phoneNumber: null,
    email: 'premium@example.com',
    isPremium: true,
    premiumPlanKey: 'weekly',
    premiumActivatedAt: '2026-04-16T09:30:00.000Z',
    journalingGoals: [],
    avatarColor: null,
    profileSetupCompleted: true,
    onboardingCompleted: true,
    profilePic: null,
  })),
}));

jest.mock('../src/services/reminderNotificationsService', () => ({
  cancelFreeTrialEndingReminder: jest.fn(async () => undefined),
}));

const safeAreaMetrics = {
  frame: {
    x: 0,
    y: 0,
    width: 390,
    height: 844,
  },
  insets: {
    top: 47,
    bottom: 34,
    left: 0,
    right: 0,
  },
};

function extractText(node: unknown): string {
  if (node == null) {
    return '';
  }

  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(child => extractText(child)).join('');
  }

  if (typeof node === 'object' && 'children' in node) {
    return extractText((node as { children?: unknown }).children);
  }

  return '';
}

const flushMicrotasks = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

beforeEach(() => {
  console.error = jest.fn();

  ReactTestRenderer.act(() => {
    resetAppStore();
  });
  jest.clearAllMocks();

  ReactTestRenderer.act(() => {
    useAppStore.setState({
      session: {
        accessToken: 'test-access',
        refreshToken: 'test-refresh',
        user: {
          userId: 'user-test',
          name: 'Premium User',
          phoneNumber: null,
          email: 'premium@example.com',
          isPremium: true,
          premiumPlanKey: 'weekly',
          premiumActivatedAt: '2026-04-16T09:30:00.000Z',
          journalingGoals: [],
          avatarColor: null,
          profileSetupCompleted: true,
          onboardingCompleted: true,
          profilePic: null,
        },
      },
    });
  });
});

afterEach(() => {
  console.error = originalConsoleError;
});

test('shows member-facing details for renewable premium plans', async () => {
  let root: ReactTestRenderer.ReactTestRenderer;
  let resolveMembershipRefresh:
    | ((value: { hasPremiumAccess: boolean; customerInfo?: unknown }) => void)
    | null = null;

  (refreshRevenueCatEntitlementState as jest.Mock).mockImplementationOnce(
    () =>
      new Promise(resolve => {
        resolveMembershipRefresh = resolve;
      }),
  );

  await ReactTestRenderer.act(async () => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <SubscriptionScreen onBack={jest.fn()} currentPlanKey="weekly" />
      </SafeAreaProvider>,
    );
  });

  await ReactTestRenderer.act(async () => {
    resolveMembershipRefresh?.({
      hasPremiumAccess: true,
      customerInfo: {
        entitlements: {
          active: {
            'Journal.IO Pro': {
              identifier: 'Journal.IO Pro',
              isActive: true,
              store: 'APP_STORE',
            },
          },
        },
      },
    });
    await flushMicrotasks();
  });

  expect(refreshRevenueCatEntitlementState).toHaveBeenCalledWith('user-test');
  expect(extractText(root!.toJSON())).toContain('Weekly Premium');
  expect(extractText(root!.toJSON())).toContain('Subscription details');
  expect(extractText(root!.toJSON())).toContain('Status');
  expect(extractText(root!.toJSON())).toContain('Price');
  expect(extractText(root!.toJSON())).toContain('App Store price');
  expect(extractText(root!.toJSON())).toContain('Manage Subscription');
  expect(extractText(root!.toJSON())).toContain('Membership already active');
  expect(extractText(root!.toJSON())).not.toContain('RevenueCat');
});

test('treats a still-verifying restore as received, not as a failure', async () => {
  // The store already confirmed the purchase and the server is only mid-verify,
  // so this must not read as "Restore failed" — the other four purchase
  // surfaces already handle this, and this screen used to be the exception.
  const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

  (refreshRevenueCatEntitlementState as jest.Mock).mockResolvedValueOnce({
    hasPremiumAccess: false,
    activeEntitlement: null,
    customerInfo: null,
  });
  (restoreRevenueCatPurchases as jest.Mock).mockResolvedValueOnce({
    entitlements: {
      active: {
        'Journal.IO Pro': {
          identifier: 'Journal.IO Pro',
          isActive: true,
          store: 'APP_STORE',
          productIdentifier: 'app.journalio.premium.weekly',
        },
      },
    },
  });
  (syncPaywallPurchase as jest.Mock).mockRejectedValueOnce(
    Object.assign(new Error('Service Unavailable'), { isRetryableSync: true }),
  );

  let root: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(async () => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <SubscriptionScreen onBack={jest.fn()} currentPlanKey="weekly" />
      </SafeAreaProvider>,
    );
    await flushMicrotasks();
  });

  await ReactTestRenderer.act(async () => {
    root!.root
      .findByProps({ accessibilityLabel: 'Restore Purchases' })
      .props.onPress();
    await flushMicrotasks();
  });

  expect(syncPaywallPurchase).toHaveBeenCalledTimes(1);
  expect(alertSpy).toHaveBeenCalledWith(
    'Purchase received',
    expect.stringContaining('still updating premium access'),
  );
  expect(alertSpy).not.toHaveBeenCalledWith(
    'Restore failed',
    expect.anything(),
  );

  alertSpy.mockRestore();
});

test('shows non-recurring messaging for lifetime members', async () => {
  let root: ReactTestRenderer.ReactTestRenderer;
  let resolveMembershipRefresh:
    | ((value: { hasPremiumAccess: boolean; customerInfo?: unknown }) => void)
    | null = null;

  (refreshRevenueCatEntitlementState as jest.Mock).mockImplementationOnce(
    () =>
      new Promise(resolve => {
        resolveMembershipRefresh = resolve;
      }),
  );

  await ReactTestRenderer.act(async () => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <SubscriptionScreen onBack={jest.fn()} currentPlanKey="lifetime" />
      </SafeAreaProvider>,
    );
  });

  await ReactTestRenderer.act(async () => {
    resolveMembershipRefresh?.({
      hasPremiumAccess: true,
      customerInfo: {
        entitlements: {
          active: {
            'Journal.IO Pro': {
              identifier: 'Journal.IO Pro',
              isActive: true,
              store: 'APP_STORE',
            },
          },
        },
      },
    });
    await flushMicrotasks();
  });

  expect(extractText(root!.toJSON())).toContain('Lifetime Premium');
  expect(extractText(root!.toJSON())).toContain('No recurring subscription');
  expect(extractText(root!.toJSON())).not.toContain(
    'Manage renewal or billing',
  );
  expect(restoreRevenueCatPurchases).not.toHaveBeenCalled();
});
