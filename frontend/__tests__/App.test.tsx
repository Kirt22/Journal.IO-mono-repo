/**
 * @format
 */

import React from "react";
import ReactTestRenderer from "react-test-renderer";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
  getOnboardingResponsiveMetrics,
  OnboardingScreen,
} from "../src/screens/onboarding/OnboardingScreen";
import { requestAndSyncOnboardingReminderPreference } from "../src/services/reminderNotificationsService";
import { resetAppStore, useAppStore } from "../src/store/appStore";

jest.mock("../src/services/reminderNotificationsService", () => ({
  requestAndSyncOnboardingReminderPreference: jest.fn(async () => undefined),
}));

beforeEach(() => {
  resetAppStore();
});

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

function findPressablesByRole(
  root: ReactTestRenderer.ReactTestRenderer,
  role: string
) {
  return root.root.findAll(
    node =>
      node.props?.accessibilityRole === role &&
      typeof node.props?.onPress === "function"
  );
}

function findLinkByLabel(root: ReactTestRenderer.ReactTestRenderer, label: string) {
  const matches = root.root.findAll(
    node =>
      node.props?.accessibilityRole === "link" &&
      typeof node.props?.onPress === "function" &&
      extractText(node).includes(label)
  );

  if (!matches.length) {
    throw new Error(`Unable to find link with label: ${label}`);
  }

  return matches[0];
}

test("renders the onboarding flow and advances to the next step", async () => {
  let root: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(() => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <OnboardingScreen isCompleting={false} onContinue={jest.fn()} />
      </SafeAreaProvider>
    );
  });

  const tree = extractText(root!.toJSON());

  expect(tree).toContain("Welcome to Journal.IO");
  expect(tree).toContain("Step 1 of 8");
  expect(tree).toContain("Continue");

  await ReactTestRenderer.act(() => {
    root!.root.findByProps({ accessibilityRole: "button" }).props.onPress();
  });

  const nextTree = extractText(root!.toJSON());

  expect(nextTree).toContain("How old are you?");
  expect(nextTree).toContain("Step 2 of 8");
});

test("requests local reminder setup when progressing past the reminder step", async () => {
  let root: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(() => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <OnboardingScreen isCompleting={false} onContinue={jest.fn()} />
      </SafeAreaProvider>
    );
  });

  await ReactTestRenderer.act(async () => {
    findPressableByLabel(root!, "Continue").props.onPress();
  });

  await ReactTestRenderer.act(async () => {
    findPressablesByRole(root!, "radio")[0]?.props.onPress();
  });

  await ReactTestRenderer.act(async () => {
    findPressableByLabel(root!, "Continue").props.onPress();
  });

  await ReactTestRenderer.act(async () => {
    findPressablesByRole(root!, "radio")[0]?.props.onPress();
  });

  await ReactTestRenderer.act(async () => {
    findPressableByLabel(root!, "Continue").props.onPress();
  });

  await ReactTestRenderer.act(async () => {
    findPressableByLabel(root!, "Continue").props.onPress();
  });

  await ReactTestRenderer.act(async () => {
    findPressableByLabel(root!, "Continue").props.onPress();
  });

  expect(extractText(root!.toJSON())).toContain("Set up daily reminders");

  await ReactTestRenderer.act(async () => {
    findPressablesByRole(root!, "radio")[0]?.props.onPress();
  });

  await ReactTestRenderer.act(async () => {
    await findPressableByLabel(root!, "Continue").props.onPress();
  });

  expect(requestAndSyncOnboardingReminderPreference).toHaveBeenCalledWith("morning");
  expect(extractText(root!.toJSON())).toContain("AI comfort and explanation");
});

test("opens the onboarding legal links through the legal browser state", async () => {
  let root: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(() => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <OnboardingScreen isCompleting={false} onContinue={jest.fn()} />
      </SafeAreaProvider>
    );
  });

  const advanceToConsentStep = async () => {
    await ReactTestRenderer.act(async () => {
      findPressableByLabel(root!, "Continue").props.onPress();
    });

    await ReactTestRenderer.act(async () => {
      findPressablesByRole(root!, "radio")[0]?.props.onPress();
    });

    await ReactTestRenderer.act(async () => {
      findPressableByLabel(root!, "Continue").props.onPress();
    });

    await ReactTestRenderer.act(async () => {
      findPressablesByRole(root!, "radio")[0]?.props.onPress();
    });

    await ReactTestRenderer.act(async () => {
      findPressableByLabel(root!, "Continue").props.onPress();
    });

    await ReactTestRenderer.act(async () => {
      findPressableByLabel(root!, "Continue").props.onPress();
    });

    await ReactTestRenderer.act(async () => {
      findPressableByLabel(root!, "Continue").props.onPress();
    });

    await ReactTestRenderer.act(async () => {
      findPressableByLabel(root!, "Continue").props.onPress();
    });

    await ReactTestRenderer.act(async () => {
      findPressableByLabel(root!, "Continue").props.onPress();
    });
  };

  await advanceToConsentStep();

  await ReactTestRenderer.act(async () => {
    findLinkByLabel(root!, "privacy policy").props.onPress();
  });

  expect(useAppStore.getState().legalBrowserUrl).toBe(
    "https://api.journalio.app/privacy"
  );
  expect(useAppStore.getState().legalBrowserTitle).toBe("Privacy Policy");

  await ReactTestRenderer.act(() => {
    useAppStore.getState().closeLegalBrowser();
  });

  await ReactTestRenderer.act(async () => {
    findLinkByLabel(root!, "terms of service").props.onPress();
  });

  expect(useAppStore.getState().legalBrowserUrl).toBe(
    "https://api.journalio.app/terms"
  );
  expect(useAppStore.getState().legalBrowserTitle).toBe("Terms of Service");
});

test("keeps step 4 goal cards in a two-column phone layout on larger iPhones", async () => {
  const iphoneSe = getOnboardingResponsiveMetrics(320);
  const iphone16Pro = getOnboardingResponsiveMetrics(402);
  const iphone16ProMax = getOnboardingResponsiveMetrics(440);

  expect(iphoneSe.goalColumns).toBe(1);
  expect(iphone16Pro.goalColumns).toBe(2);
  expect(iphone16ProMax.goalColumns).toBe(2);
  expect(iphone16Pro.goalCardWidth).toBeCloseTo(175, 0);
  expect(iphone16ProMax.goalCardWidth).toBeCloseTo(186, 0);
  expect(iphone16ProMax.goalCardWidth).toBeGreaterThan(iphone16Pro.goalCardWidth);
});
