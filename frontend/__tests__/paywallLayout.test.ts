/**
 * @format
 */

import { getPaywallLayoutMetrics } from "../src/screens/profile/paywallLayout";

describe("getPaywallLayoutMetrics", () => {
  test("adapts compact and large phone paywall layout values", () => {
    const compact = getPaywallLayoutMetrics(320);
    const base = getPaywallLayoutMetrics(390);
    const large = getPaywallLayoutMetrics(440);

    expect(compact.isVeryCompact).toBe(true);
    expect(compact.postAuthHeroTitleSize).toBeLessThan(base.postAuthHeroTitleSize);
    expect(compact.discountNewPriceSize).toBeLessThan(base.discountNewPriceSize);
    expect(compact.lifetimeHeroLayout).toBe("column");
    expect(base.lifetimeHeroLayout).toBe("row");
    expect(compact.footerReservedSpace).toBeGreaterThan(base.footerReservedSpace);
    expect(large.horizontalPadding).toBeGreaterThan(base.horizontalPadding);
  });
});
