import {
  getPaywallContent,
  PAYWALL_CONTENT,
  PREMIUM_FEATURES,
} from "../src/screens/profile/paywallContent";

test("returns feature-specific copy for the AI insights gate", () => {
  const copy = getPaywallContent("insights_ai_tab_locked", "insights");
  expect(copy.headline).toBe("Your weekly read is ready.");
  expect(copy.eyebrow).toBe("AI INSIGHTS");
  expect(copy.bullets.length).toBeGreaterThan(0);
});

test("returns distinct copy per premium feature", () => {
  const insights = getPaywallContent("insights_ai_tab_locked");
  const quick = getPaywallContent("entry_quick_analysis_locked");
  const privacy = getPaywallContent("settings_biometric_lock_locked");
  expect(insights.headline).not.toBe(quick.headline);
  expect(quick.headline).not.toBe(privacy.headline);
  expect(privacy.headline).toMatch(/Face ID/i);
});

test("the locked session analysis has its own copy rather than the default", () => {
  const copy = getPaywallContent("entry_session_analysis_locked");
  expect(copy.eyebrow).toBe("SESSION ANALYSIS");
  expect(copy.headline).not.toBe(PAYWALL_CONTENT.post_auth.headline);
});

test("falls back to the default (post_auth) copy for unknown placements", () => {
  const fallback = getPaywallContent("some_unmapped_placement");
  expect(fallback.headline).toBe(PAYWALL_CONTENT.post_auth.headline);
});

test("falls back to a screen-key match when the placement is unmapped", () => {
  const copy = getPaywallContent("unmapped", "subscription_screen");
  expect(copy.headline).toBe(PAYWALL_CONTENT.subscription_screen.headline);
});

test("every context sells the same feature list", () => {
  // The headline stays contextual; the product on offer does not change with
  // whichever gate the user happened to tap.
  Object.values(PAYWALL_CONTENT).forEach(copy => {
    expect(copy.bullets).toBe(PREMIUM_FEATURES);
  });
  expect(getPaywallContent("some_unmapped_placement").bullets).toBe(
    PREMIUM_FEATURES
  );
});

test("every feature row carries an icon asset and unique text", () => {
  const texts = PREMIUM_FEATURES.map(feature => feature.text);
  expect(new Set(texts).size).toBe(texts.length);
  PREMIUM_FEATURES.forEach(feature => {
    expect(feature.icon).toBeTruthy();
  });
});

test("every mapped context has a headline, subhead, and at least one bullet", () => {
  Object.values(PAYWALL_CONTENT).forEach(copy => {
    expect(copy.headline.length).toBeGreaterThan(0);
    expect(copy.subhead.length).toBeGreaterThan(0);
    expect(copy.bullets.length).toBeGreaterThan(0);
    copy.bullets.forEach(bullet => {
      expect(typeof bullet.text).toBe("string");
      expect(bullet.icon).toBeTruthy();
    });
  });
});

test("Ask Jade is sold on every paywall, with its own icon", () => {
  const askJade = PREMIUM_FEATURES.find(feature =>
    feature.text.startsWith("Ask Jade")
  );

  expect(askJade).toBeTruthy();
  expect(askJade?.icon).toBeTruthy();

  // The list is shared by reference, so one row reaches every in-app paywall.
  Object.values(PAYWALL_CONTENT).forEach(copy => {
    expect(copy.bullets).toContain(askJade);
  });
});

test("the Ask Jade gate has its own headline rather than the default", () => {
  const copy = getPaywallContent("ask_jade_locked");

  expect(copy.eyebrow).toBe("ASK JADE");
  expect(copy.headline).not.toBe(PAYWALL_CONTENT.post_auth.headline);
});
