/**
 * @format
 */

import React from "react";
import ReactTestRenderer from "react-test-renderer";
import { SafeAreaProvider } from "react-native-safe-area-context";
import ProfileScreen from "../src/screens/profile/ProfileScreen";
import { getPaywallConfig } from "../src/services/paywallService";

jest.mock("../src/services/paywallService", () => ({
  getPaywallConfig: jest.fn(() => new Promise(() => undefined)),
  trackPaywallEvent: jest.fn(async () => undefined),
}));

jest.mock("../src/services/streaksService", () => ({
  getCurrentStreakSummary: jest.fn(() => new Promise(() => undefined)),
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
    return "";
  }

  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(child => extractText(child)).join("");
  }

  if (typeof node === "object" && "children" in node) {
    return extractText((node as { children?: unknown }).children);
  }

  return "";
}

function findPressableByLabel(
  root: ReactTestRenderer.ReactTestRenderer,
  label: string
) {
  const matches = root.root.findAll(
    node =>
      typeof node.props?.onPress === "function" &&
      extractText(node).includes(label)
  );

  if (!matches.length) {
    throw new Error(`Unable to find pressable with label: ${label}`);
  }

  return matches[0];
}

const flushMicrotasks = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

beforeEach(() => {
  jest.clearAllMocks();
});

test("shows lifetime offer copy and buyer count in the free-user banner", async () => {
  let root: ReactTestRenderer.ReactTestRenderer;
  let resolvePaywallConfig:
    | ((
        value: {
          offerings: Array<{
            key: string;
            purchasedUsersCount: number;
            purchaseLimit: number;
          }>;
        }
      ) => void)
    | null = null;
  const onOpenPaywall = jest.fn();

  (getPaywallConfig as jest.Mock).mockImplementationOnce(
    () =>
      new Promise(resolve => {
        resolvePaywallConfig = resolve;
      })
  );

  await ReactTestRenderer.act(() => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <ProfileScreen
          userName="Journal User"
          userEmail="journal@example.com"
          isPremium={false}
          onOpenPaywall={onOpenPaywall}
          onOpenSettings={jest.fn()}
          onOpenSubscription={jest.fn()}
          onOpenPrivacy={jest.fn()}
        />
      </SafeAreaProvider>
    );
  });

  expect(extractText(root!.toJSON())).toContain("Loading claims...");

  await ReactTestRenderer.act(async () => {
    resolvePaywallConfig?.({
      offerings: [
        {
          key: "lifetime",
          purchasedUsersCount: 42,
          purchaseLimit: 100,
        },
      ],
    });
    await flushMicrotasks();
  });

  expect(extractText(root!.toJSON())).toContain(
    "Unlock Lifetime Premium with one payment"
  );
  expect(extractText(root!.toJSON())).toContain(
    "42/100 claimed"
  );
  expect(extractText(root!.toJSON())).toContain("View lifetime offer");
  expect(extractText(root!.toJSON())).not.toContain(
    "Review the one-time premium unlock"
  );
  expect(getPaywallConfig).toHaveBeenCalledWith({
    placementKey: "profile_upgrade_banner",
    screenKey: "profile",
    triggerMode: "contextual",
  });

  ReactTestRenderer.act(() => {
    findPressableByLabel(root!, "Unlock Premium").props.onPress();
  });

  expect(onOpenPaywall).toHaveBeenCalledTimes(1);
});

test("hides the lifetime offer banner for premium users", async () => {
  let root: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(() => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <ProfileScreen
          userName="Premium User"
          userEmail="premium@example.com"
          isPremium
          onOpenPaywall={jest.fn()}
          onOpenSettings={jest.fn()}
          onOpenSubscription={jest.fn()}
          onOpenPrivacy={jest.fn()}
        />
      </SafeAreaProvider>
    );
  });

  await ReactTestRenderer.act(async () => {
    await flushMicrotasks();
  });

  expect(extractText(root!.toJSON())).not.toContain("Unlock Lifetime Premium");
});
