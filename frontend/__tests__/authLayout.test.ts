/**
 * @format
 */

import { getAuthLayoutMetrics } from '../src/screens/auth/authLayout';

describe('getAuthLayoutMetrics', () => {
  test('shrinks auth headings and otp inputs on very compact phones', () => {
    const compact = getAuthLayoutMetrics(320);
    const base = getAuthLayoutMetrics(390);
    const large = getAuthLayoutMetrics(440);

    expect(compact.isVeryCompact).toBe(true);
    expect(compact.heroTitleSize).toBeLessThan(base.heroTitleSize);
    expect(compact.otpInputSize).toBeLessThan(base.otpInputSize);
    expect(base.sheetMaxWidth).toBe(420);
    expect(large.sheetMaxWidth).toBe(460);
    expect(large.heroTitleSize).toBeGreaterThan(base.heroTitleSize);
  });
});
