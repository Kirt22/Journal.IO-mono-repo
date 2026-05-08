import appleAuth from "@invertase/react-native-apple-authentication";
import { getAppleSignInCredential } from "../src/config/appleSignIn";

describe("getAppleSignInCredential", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("silently treats Apple AuthorizationServices errors as an interrupted sign-in", async () => {
    jest.mocked(appleAuth.performRequest).mockRejectedValueOnce(
      new Error(
        "The operation couldn’t be completed. (com.apple.AuthenticationServices.AuthorizationError error 1000.)"
      )
    );

    await expect(getAppleSignInCredential()).resolves.toBeNull();
  });
});
