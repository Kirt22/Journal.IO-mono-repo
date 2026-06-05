/**
 * @format
 */

import { act } from "react-test-renderer";
import { resetAppStore, useAppStore } from "../src/store/appStore";

describe("post-auth profile flow", () => {
  beforeEach(() => {
    resetAppStore();
  });

  afterEach(() => {
    resetAppStore();
  });

  it("continues from the post-auth paywall into profile setup for non-premium users", async () => {
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
            aiOptIn: true,
          },
        },
      });
    });

    await act(async () => {
      await useAppStore.getState().finishEmailVerification();
    });

    expect(useAppStore.getState().stage).toBe("paywall");
    expect(useAppStore.getState().paywallReturnStage).toBe("profile");

    act(() => {
      useAppStore.getState().continueFromPaywall();
    });

    expect(useAppStore.getState().stage).toBe("profile");
  });

  it("does not show a second purchase prompt after dismissing the hosted post-auth paywall", () => {
    act(() => {
      useAppStore.setState({
        stage: "hosted-paywall",
        paywallReturnStage: "profile",
        activePaywallPlacementKey: "post_auth",
        activePaywallScreenKey: "verify-email",
        activePaywallTriggerMode: "contextual",
        activeHostedPaywallTarget: "main",
        pendingPostAuthDiscountOffer: true,
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
            aiOptIn: true,
          },
        },
      });
    });

    act(() => {
      useAppStore.getState().continueFromHostedPaywall("dismiss");
    });

    expect(useAppStore.getState().stage).toBe("profile");
    expect(useAppStore.getState().activePaywallPlacementKey).toBeNull();
    expect(useAppStore.getState().activeHostedPaywallTarget).toBeNull();
    expect(useAppStore.getState().pendingPostAuthDiscountOffer).toBe(false);
  });
});
