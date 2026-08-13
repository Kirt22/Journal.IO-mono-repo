import { PURCHASES_ERROR_CODE } from "react-native-purchases";
import {
  getPlanPriceLabel,
  getPurchaseErrorMessage,
  getTrialFootnote,
  type PaywallPlan,
} from "../src/screens/profile/paywallShared";

const createPlan = (overrides: Partial<PaywallPlan> = {}): PaywallPlan => ({
  id: "yearly",
  durationLabel: "Rp 1.499.000",
  title: "YEARLY",
  price: "Rp 1.499.000",
  periodLabel: "per year",
  subtitle: "Rp 124.917/mo",
  planKey: "annual",
  ...overrides,
});

describe("paywallShared", () => {
  it("rejoins price and period for prose contexts", () => {
    expect(getPlanPriceLabel(createPlan())).toBe("Rp 1.499.000 per year");
  });

  it("omits the period when a plan has none", () => {
    expect(getPlanPriceLabel(createPlan({ periodLabel: "" }))).toBe(
      "Rp 1.499.000"
    );
  });

  it("keeps the trial footnote grammatical with a split price", () => {
    const footnote = getTrialFootnote(createPlan(), {
      price: "Rp 0",
      period: "P7D",
      unitCount: 7,
      unitLabel: "day",
      durationCount: 7,
      durationLabel: "7 days",
      cycles: 1,
      isFreeTrial: true,
    });

    expect(footnote).toBe(
      "If eligible, 7 days free, then Rp 1.499.000 per year. Apple confirms final introductory terms before purchase."
    );
  });

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
