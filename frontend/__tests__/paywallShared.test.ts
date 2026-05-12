import { PURCHASES_ERROR_CODE } from "react-native-purchases";
import { getPurchaseErrorMessage } from "../src/screens/profile/paywallShared";

describe("paywallShared", () => {
  it("sanitizes RevenueCat Test Store simulated purchase failures", () => {
    const message = getPurchaseErrorMessage({
      code: PURCHASES_ERROR_CODE.TEST_STORE_SIMULATED_PURCHASE_ERROR,
      message: "Error 42: Purchase failure simulated successfully in Test Store.",
      readableErrorCode: "TEST_STORE_SIMULATED_PURCHASE_ERROR",
      userInfo: {
        readableErrorCode: "TEST_STORE_SIMULATED_PURCHASE_ERROR",
      },
      underlyingErrorMessage:
        "Purchase failure simulated successfully in Test Store.",
      userCancelled: false,
    });

    expect(message).toBe(
      "The test purchase was declined. No charge was made. You can try again when you're ready."
    );
    expect(message).not.toContain("Error 42");
    expect(message).not.toContain("RevenueCat");
  });

  it("does not expose raw unknown purchase errors to users", () => {
    const message = getPurchaseErrorMessage(
      new Error("StoreKit failed with raw internal purchase details.")
    );

    expect(message).toBe(
      "We could not complete that purchase right now. No charge was made. Please try again."
    );
    expect(message).not.toContain("StoreKit");
  });

  it("keeps network purchase failures actionable", () => {
    expect(
      getPurchaseErrorMessage({
        code: PURCHASES_ERROR_CODE.NETWORK_ERROR,
        message: "The Internet connection appears to be offline.",
      })
    ).toBe(
      "We could not reach purchases right now. Check your connection and try again."
    );
  });
});
