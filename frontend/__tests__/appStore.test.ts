import { act } from "react-test-renderer";
import { resetAppStore, useAppStore } from "../src/store/appStore";

const onboardingData = {
  ageRange: "25-34",
  journalingExperience: "Occasional journaler",
  goals: ["Daily Reflection", "Personal Growth"],
  supportFocusAreas: ["Stress", "Sleep"],
  reminderPreference: "Evening",
  aiComfort: true,
  privacyConsent: true,
};

describe("appStore", () => {
  beforeEach(() => {
    resetAppStore();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    resetAppStore();
  });

  it("preserves onboarding data and advances the flow after the handoff delay", async () => {
    const store = useAppStore;

    await act(async () => {
      const transition = store.getState().completeOnboarding(onboardingData);

      expect(store.getState().isCompletingOnboarding).toBe(true);
      expect(store.getState().onboardingData).toEqual(onboardingData);
      expect(store.getState().stage).toBe("onboarding");

      jest.advanceTimersByTime(220);
      await transition;
    });

    expect(store.getState().isCompletingOnboarding).toBe(false);
    expect(store.getState().stage).toBe("auth");
  });

  it("moves auth navigation into the shared store and resets cleanly", async () => {
    const store = useAppStore;

    await act(async () => {
      await store.getState().continueWithEmail();
    });

    expect(store.getState().authSource).toBe("email");
    expect(store.getState().stage).toBe("create-account");

    act(() => {
      store.getState().setActiveTab("profile");
      store.getState().openNewEntry();
      store.getState().setThemeModeOverride("dark");
      store.getState().restartFlow();
    });

    expect(store.getState().stage).toBe("onboarding");
    expect(store.getState().activeTab).toBe("home");
    expect(store.getState().authSource).toBeNull();
    expect(store.getState().themeModeOverride).toBeNull();
  });
});
