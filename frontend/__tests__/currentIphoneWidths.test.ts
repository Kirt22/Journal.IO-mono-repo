/**
 * @format
 */

import { getAuthLayoutMetrics } from '../src/screens/auth/authLayout';
import { getPaywallLayoutMetrics } from '../src/screens/profile/paywallLayout';
import { getBottomNavBarMaxWidth } from '../src/components/BottomNav';
import { getInkCurrentPresentationMetrics } from '../src/components/JournalWordmark';

/**
 * The widths the app actually ships against. 402 and 440 arrived with the
 * iPhone 16 Pro and Pro Max and are the two the older breakpoints had never
 * been checked at.
 */
const IPHONE_WIDTHS = [
  { device: 'iPhone 16 / 16e', width: 393 },
  { device: 'iPhone 16 Pro', width: 402 },
  { device: 'iPhone 16 Plus', width: 430 },
  { device: 'iPhone 16 Pro Max', width: 440 },
] as const;

describe.each(IPHONE_WIDTHS)('$device ($width pt)', ({ width }) => {
  test('treats the width as a full-size phone, not a compact one', () => {
    const auth = getAuthLayoutMetrics(width);
    const paywall = getPaywallLayoutMetrics(width);

    expect(auth.isCompact).toBe(false);
    expect(auth.isVeryCompact).toBe(false);
    expect(paywall.isCompact).toBe(false);
    expect(paywall.lifetimeHeroLayout).toBe('row');
  });

  test('keeps padded content inside the screen', () => {
    const auth = getAuthLayoutMetrics(width);
    const paywall = getPaywallLayoutMetrics(width);

    expect(auth.horizontalPadding * 2).toBeLessThan(width);
    expect(paywall.horizontalPadding * 2).toBeLessThan(width);
    expect(auth.heroSubtitleMaxWidth).toBeLessThanOrEqual(
      width - auth.horizontalPadding * 2,
    );
  });

  test('leaves the bottom nav full-bleed', () => {
    // A cap at or below the screen width insets the bar and exposes the
    // background down both sides; only a tablet should ever be capped.
    expect(getBottomNavBarMaxWidth(width)).toBeUndefined();
  });

  test('sizes the wordmark to fit the auth sheet', () => {
    const { finalFontSize } = getInkCurrentPresentationMetrics(width);
    // Bricolage Grotesque Bold sets "journal.io" at ~4.1x the point size.
    const lockupWidth = finalFontSize * 4.1;

    expect(lockupWidth).toBeLessThan(
      width - getAuthLayoutMetrics(width).horizontalPadding * 2,
    );
  });
});

test('still caps the bottom nav on a tablet', () => {
  expect(getBottomNavBarMaxWidth(744)).toBe(430);
  expect(getBottomNavBarMaxWidth(1024)).toBe(430);
});
