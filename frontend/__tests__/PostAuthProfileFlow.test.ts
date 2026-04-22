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
});
