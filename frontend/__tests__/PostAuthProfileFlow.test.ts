/**
 * @format
 */

import { act } from "react-test-renderer";
import { resetAppStore, useAppStore } from "../src/store/appStore";

jest.mock("../src/services/reminderNotificationsService", () => ({
  cancelFreeTrialEndingReminder: jest.fn(async () => undefined),
  cancelReminderNotifications: jest.fn(async () => undefined),
  getDefaultReminderTimezone: jest.fn(() => "Asia/Kolkata"),
  getReminderPermissionGranted: jest.fn(async () => true),
  syncOnboardingReminderPreference: jest.fn(async () => undefined),
  syncReminderNotifications: jest.fn(async () => undefined),
  syncStoredDailyReminderNotifications: jest.fn(async () => null),
}));

describe("post-auth profile flow", () => {
  beforeEach(() => {
    resetAppStore();
  });

  afterEach(() => {
    resetAppStore();
  });

  it("continues from the post-auth paywall into the main app for non-premium users", async () => {
    act(() => {
      useAppStore.setState({
        stage: "verify-email",
        authSource: "email",
        pendingEmail: "alex@example.com",
        session: {
          accessToken: "access-token",
          refreshToken: "refresh-token",
          user: {
            userId: "user-123",
            name: "Alex",
            phoneNumber: null,
            email: "alex@example.com",
            isPremium: false,
            journalingGoals: [],
            avatarColor: "#8E4636",
            profileSetupCompleted: false,
            onboardingCompleted: true,
            profilePic: null,
          },
        },
      });
    });

    await act(async () => {
      await useAppStore.getState().finishEmailVerification();
    });

    expect(useAppStore.getState().stage).toBe("paywall");
    expect(useAppStore.getState().paywallReturnStage).toBe("main-app");

    act(() => {
      useAppStore.getState().continueFromPaywall();
    });

    expect(useAppStore.getState().stage).toBe("main-app");
  });

  it("does not show a second purchase prompt after dismissing the hosted post-auth paywall", () => {
    act(() => {
      useAppStore.setState({
        stage: "hosted-paywall",
        paywallReturnStage: "main-app",
        activePaywallPlacementKey: "post_auth",
        activePaywallScreenKey: "verify-email",
        activePaywallTriggerMode: "contextual",
        activeHostedPaywallTarget: "main",
        session: {
          accessToken: "access-token",
          refreshToken: "refresh-token",
          user: {
            userId: "user-123",
            name: "Alex",
            phoneNumber: null,
            email: "alex@example.com",
            isPremium: false,
            journalingGoals: [],
            avatarColor: "#8E4636",
            profileSetupCompleted: false,
            onboardingCompleted: true,
            profilePic: null,
          },
        },
      });
    });

    act(() => {
      useAppStore.getState().continueFromHostedPaywall("dismiss");
    });

    expect(useAppStore.getState().stage).toBe("main-app");
    expect(useAppStore.getState().activePaywallPlacementKey).toBeNull();
    expect(useAppStore.getState().activeHostedPaywallTarget).toBeNull();
  });
});
