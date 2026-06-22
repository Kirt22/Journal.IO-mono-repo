import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  clearCachedAuthUser,
  getCachedAuthUser,
  saveCachedAuthUser,
} from "../src/utils/authSessionCache";

describe("authSessionCache", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("persists only the verified user profile without auth tokens", async () => {
    const user = {
      userId: "user-123",
      name: "Alex",
      phoneNumber: null,
      email: "alex@example.com",
      isPremium: true,
      journalingGoals: ["growth"],
      avatarColor: "#8E4636",
      profileSetupCompleted: true,
      onboardingCompleted: true,
      profilePic: null,
      aiOptIn: true,
    };

    await saveCachedAuthUser(user);

    const serializedValue = (AsyncStorage.setItem as jest.Mock).mock.calls[0][1];

    expect(serializedValue).toBe(JSON.stringify(user));
    expect(serializedValue).not.toContain("accessToken");
    expect(serializedValue).not.toContain("refreshToken");
  });

  it("returns a valid cached profile and clears it when requested", async () => {
    const user = {
      userId: "user-123",
      name: "Alex",
      phoneNumber: null,
      email: "alex@example.com",
      isPremium: false,
      journalingGoals: [],
      avatarColor: null,
      profileSetupCompleted: true,
      onboardingCompleted: true,
      profilePic: null,
      aiOptIn: true,
    };

    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(user));

    await expect(getCachedAuthUser()).resolves.toEqual(user);

    await clearCachedAuthUser();
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith("journalio.auth.user");
  });
});
