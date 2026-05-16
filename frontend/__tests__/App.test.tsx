/**
 * @format
 */

import React from "react";
import ReactTestRenderer from "react-test-renderer";
import { Alert } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
  getOnboardingResponsiveMetrics,
  OnboardingScreen,
} from "../src/screens/onboarding/OnboardingScreen";
import { requestAppRating } from "../src/services/appRatingService";
import { requestAndSyncOnboardingReminderPreference } from "../src/services/reminderNotificationsService";
import { resetAppStore, useAppStore } from "../src/store/appStore";

jest.mock("../src/services/appRatingService", () => ({
  requestAppRating: jest.fn(async () => ({ status: "requested" })),
}));

jest.mock("../src/services/reminderNotificationsService", () => ({
  requestAndSyncOnboardingReminderPreference: jest.fn(async () => undefined),
}));

beforeEach(() => {
  resetAppStore();
  jest.clearAllMocks();
  jest.spyOn(Alert, "alert").mockImplementation(jest.fn());
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
  expect(tree).toContain("Step 1 of 9");
  expect(tree).toContain("Continue");

  await ReactTestRenderer.act(() => {
    root!.root.findByProps({ accessibilityRole: "button" }).props.onPress();
  });

  const nextTree = extractText(root!.toJSON());

  expect(nextTree).toContain("How old are you?");
  expect(nextTree).toContain("Step 2 of 9");
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

test("renders the Figma rating step before privacy consent", async () => {
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

  await ReactTestRenderer.act(async () => {
    findPressableByLabel(root!, "Continue").props.onPress();
  });

  await ReactTestRenderer.act(async () => {
    findPressableByLabel(root!, "Continue").props.onPress();
  });

  expect(extractText(root!.toJSON())).toContain("How excited are you to begin?");
  expect(extractText(root!.toJSON())).toContain("Step 8 of 9");

  const fifthStar = root!.root.findByProps({
    accessibilityLabel: "Rate excitement 5 out of 5",
  });

  await ReactTestRenderer.act(async () => {
    fifthStar.props.onPress();
    await Promise.resolve();
  });

  expect(extractText(root!.toJSON())).toContain("100% committed and ready");
  expect(extractText(root!.toJSON())).toContain("Maya R.");
  expect(extractText(root!.toJSON())).toContain("Jordan P.");
  expect(Alert.alert).toHaveBeenCalledWith(
    "Rate Journal.IO",
    "Your feedback helps us keep Journal.IO calm, useful, and focused on reflection.",
    expect.any(Array)
  );
  expect(requestAppRating).not.toHaveBeenCalled();

  const alertButtons = (Alert.alert as jest.Mock).mock.calls[0][2] as Array<{
    onPress?: () => void;
    text: string;
  }>;
  const rateNowButton = alertButtons.find(button => button.text === "Rate now");

  await ReactTestRenderer.act(async () => {
    rateNowButton?.onPress?.();
    await Promise.resolve();
  });

  expect(requestAppRating).toHaveBeenCalledTimes(1);
  expect(extractText(root!.toJSON())).toContain("Thanks for supporting Journal.IO.");

  await ReactTestRenderer.act(async () => {
    findPressableByLabel(root!, "Continue").props.onPress();
  });

  expect(extractText(root!.toJSON())).toContain("Privacy & security");
  expect(extractText(root!.toJSON())).toContain("Step 9 of 9");
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
