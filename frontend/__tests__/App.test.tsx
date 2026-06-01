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
import { generateOnboardingDemoAnalysis } from "../src/services/onboardingService";
import { requestAndSyncOnboardingReminderPreference } from "../src/services/reminderNotificationsService";
import { resetAppStore, useAppStore } from "../src/store/appStore";

jest.mock("../src/services/appRatingService", () => ({
  requestAppRating: jest.fn(async () => ({ status: "requested" })),
}));

jest.mock("../src/services/onboardingService", () => ({
  generateOnboardingDemoAnalysis: jest.fn(async () => ({
    moodTone: "neutral and reflective",
    summary:
      'You named "scattered" as the feeling underneath the entry. "too many tabs open" appears associated with the part of the day that felt heavier. I noticed "Okay", "scattered", and "too many tabs open" and used those words as anchors for this read.',
    keywords: [
      {
        label: "Okay",
        description:
          "Your okay mood check-in gives this demo reflection its emotional starting point.",
      },
      {
        label: "scattered",
        description:
          'You named "scattered" as the feeling word, so the reflection keeps that emotion visible without judging it.',
      },
      {
        label: "too many tabs open",
        description:
          '"too many tabs open" appears to be the main gentle hurdle you wanted the reflection to notice.',
      },
    ],
    prompt:
      'What is one small, gentle thing that could make "scattered" feel a little lighter tomorrow?',
  })),
}));

jest.mock("../src/services/reminderNotificationsService", () => ({
  requestAndSyncOnboardingReminderPreference: jest.fn(async () => undefined),
}));

beforeEach(() => {
  resetAppStore();
  jest.clearAllMocks();
  jest.spyOn(Alert, "alert").mockImplementation(jest.fn());
  (generateOnboardingDemoAnalysis as jest.Mock).mockResolvedValue({
    moodTone: "neutral and reflective",
    summary:
      'You named "scattered" as the feeling underneath the entry. "too many tabs open" appears associated with the part of the day that felt heavier. I noticed "Okay", "scattered", and "too many tabs open" and used those words as anchors for this read.',
    keywords: [
      {
        label: "Okay",
        description:
          "Your okay mood check-in gives this demo reflection its emotional starting point.",
      },
      {
        label: "scattered",
        description:
          'You named "scattered" as the feeling word, so the reflection keeps that emotion visible without judging it.',
      },
      {
        label: "too many tabs open",
        description:
          '"too many tabs open" appears to be the main gentle hurdle you wanted the reflection to notice.',
      },
    ],
    prompt:
      'What is one small, gentle thing that could make "scattered" feel a little lighter tomorrow?',
  });
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

async function advanceToPrivacyStep(root: ReactTestRenderer.ReactTestRenderer) {
  await ReactTestRenderer.act(async () => {
    findPressableByLabel(root, "Continue").props.onPress();
  });

  await ReactTestRenderer.act(async () => {
    findPressablesByRole(root, "radio")[0]?.props.onPress();
  });

  await ReactTestRenderer.act(async () => {
    findPressableByLabel(root, "Continue").props.onPress();
  });

  await ReactTestRenderer.act(async () => {
    findPressablesByRole(root, "radio")[0]?.props.onPress();
  });

  await ReactTestRenderer.act(async () => {
    findPressableByLabel(root, "Continue").props.onPress();
  });

  await ReactTestRenderer.act(async () => {
    findPressableByLabel(root, "Continue").props.onPress();
  });

  await ReactTestRenderer.act(async () => {
    findPressableByLabel(root, "Continue").props.onPress();
  });

  await ReactTestRenderer.act(async () => {
    await findPressableByLabel(root, "Continue").props.onPress();
  });

  await ReactTestRenderer.act(async () => {
    findPressableByLabel(root, "Continue").props.onPress();
  });
}

async function acceptPrivacyAndOpenJournalDemo(
  root: ReactTestRenderer.ReactTestRenderer
) {
  await ReactTestRenderer.act(async () => {
    findPressablesByRole(root, "checkbox")[0]?.props.onPress();
  });

  await ReactTestRenderer.act(async () => {
    findPressableByLabel(root, "Continue").props.onPress();
  });
}

async function fillJournalDemoAndOpenReflection(
  root: ReactTestRenderer.ReactTestRenderer
) {
  await ReactTestRenderer.act(async () => {
    root.root.findByProps({ accessibilityLabel: "Mood Okay" }).props.onPress();
  });

  await ReactTestRenderer.act(async () => {
    root.root
      .findByProps({ accessibilityLabel: "One word feeling" })
      .props.onChangeText("scattered");
    root.root
      .findByProps({ accessibilityLabel: "Gentle hurdle" })
      .props.onChangeText("too many tabs open");
    root.root
      .findByProps({ accessibilityLabel: "Journal thoughts" })
      .props.onChangeText(
        "I felt pulled in too many directions today, but writing it down already feels lighter."
      );
  });

  await ReactTestRenderer.act(async () => {
    findPressableByLabel(root, "Continue").props.onPress();
  });
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
  expect(tree).toContain("Step 1 of 12");
  expect(tree).toContain("Continue");

  await ReactTestRenderer.act(() => {
    root!.root.findByProps({ accessibilityRole: "button" }).props.onPress();
  });

  const nextTree = extractText(root!.toJSON());

  expect(nextTree).toContain("How old are you?");
  expect(nextTree).toContain("Step 2 of 12");
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

test("renders the Figma rating step after the breathing demo", async () => {
  let root: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(() => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <OnboardingScreen isCompleting={false} onContinue={jest.fn()} />
      </SafeAreaProvider>
    );
  });

  await advanceToPrivacyStep(root!);
  await acceptPrivacyAndOpenJournalDemo(root!);
  await fillJournalDemoAndOpenReflection(root!);

  expect(generateOnboardingDemoAnalysis).toHaveBeenCalledWith({
    mood: "okay",
    feeling: "scattered",
    challenge: "too many tabs open",
    thoughts:
      "I felt pulled in too many directions today, but writing it down already feels lighter.",
  });
  expect(extractText(root!.toJSON())).toContain("AI reflection");
  expect(extractText(root!.toJSON())).toContain("Keywords noticed");

  await ReactTestRenderer.act(async () => {
    findPressableByLabel(root!, "Continue").props.onPress();
  });

  expect(extractText(root!.toJSON())).toContain("Let that insight land");
  expect(extractText(root!.toJSON())).toContain("Are you feeling a little calmer?");

  await ReactTestRenderer.act(async () => {
    findPressableByLabel(root!, "I feel calmer").props.onPress();
  });

  expect(extractText(root!.toJSON())).toContain("How excited are you to begin?");
  expect(extractText(root!.toJSON())).toContain("Step 12 of 12");

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

  expect(extractText(root!.toJSON())).toContain("Get Started");
});

test("shows the onboarding journal demo and generated AI reflection", async () => {
  const onContinue = jest.fn();
  let root: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(() => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <OnboardingScreen isCompleting={false} onContinue={onContinue} />
      </SafeAreaProvider>
    );
  });

  await advanceToPrivacyStep(root!);
  expect(extractText(root!.toJSON())).toContain("Privacy & security");
  expect(extractText(root!.toJSON())).toContain("Step 8 of 12");

  await acceptPrivacyAndOpenJournalDemo(root!);

  expect(extractText(root!.toJSON())).toContain("Your first entry");
  expect(extractText(root!.toJSON())).toContain("Step 9 of 12");

  await fillJournalDemoAndOpenReflection(root!);

  const analysisTree = extractText(root!.toJSON());

  expect(analysisTree).toContain("AI reflection");
  expect(analysisTree).toContain("Detected aura");
  expect(analysisTree).toContain("Keywords noticed");
  expect(analysisTree).toContain("neutral and reflective");
  expect(analysisTree).toContain("scattered");
  expect(analysisTree).toContain("too many tabs open");
  expect(analysisTree).toContain("feeling word");
  expect(analysisTree).toContain("main gentle hurdle");
  expect(analysisTree).toContain("Prompt for tomorrow");
  expect(analysisTree).toContain("Step 10 of 12");

  await ReactTestRenderer.act(async () => {
    findPressableByLabel(root!, "Continue").props.onPress();
  });

  expect(extractText(root!.toJSON())).toContain("Let that insight land");
  expect(extractText(root!.toJSON())).not.toContain("Step 11 of 12");
  expect(extractText(root!.toJSON())).toContain("I feel calmer");

  await ReactTestRenderer.act(async () => {
    findPressableByLabel(root!, "I feel calmer").props.onPress();
  });

  expect(extractText(root!.toJSON())).toContain("How excited are you to begin?");

  await ReactTestRenderer.act(async () => {
    findPressableByLabel(root!, "Get Started").props.onPress();
  });

  expect(onContinue).toHaveBeenCalledWith(
    expect.objectContaining({
      privacyConsent: true,
    })
  );
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

  await advanceToPrivacyStep(root!);

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
