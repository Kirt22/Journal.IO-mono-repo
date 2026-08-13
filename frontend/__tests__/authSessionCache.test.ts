import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Keychain from "react-native-keychain";
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
    };

    await saveCachedAuthUser(user);

    const serializedValue = (Keychain.setGenericPassword as jest.Mock).mock.calls[0][1];

    expect(serializedValue).toBe(JSON.stringify(user));
    expect(serializedValue).not.toContain("accessToken");
    expect(serializedValue).not.toContain("refreshToken");
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith("journalio.auth.user");
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
    };

    (Keychain.getGenericPassword as jest.Mock).mockResolvedValue({
      password: JSON.stringify(user),
      service: "journalio.auth.user.secure",
      username: "secure",
    });

    await expect(getCachedAuthUser()).resolves.toEqual(user);

    await clearCachedAuthUser();
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith("journalio.auth.user");
    expect(Keychain.resetGenericPassword).toHaveBeenCalled();
  });
});
