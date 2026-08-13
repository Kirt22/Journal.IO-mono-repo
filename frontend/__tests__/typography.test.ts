import { fontFamilies, resolveFontFamily, typography } from "../src/theme/typography";

describe("resolveFontFamily", () => {
  it("maps each supported UI weight onto its own font file", () => {
    expect(resolveFontFamily("400")).toBe(fontFamilies.ui.regular);
    expect(resolveFontFamily("500")).toBe(fontFamilies.ui.medium);
    expect(resolveFontFamily("600")).toBe(fontFamilies.ui.semibold);
    expect(resolveFontFamily("700")).toBe(fontFamilies.ui.bold);
  });

  it("clamps the app's legacy 800 and 900 weights to Bold rather than faking a heavier cut", () => {
    expect(resolveFontFamily("800")).toBe(fontFamilies.ui.bold);
    expect(resolveFontFamily("900")).toBe(fontFamilies.ui.bold);
  });

  it("treats a missing or keyword weight as regular text", () => {
    expect(resolveFontFamily(undefined)).toBe(fontFamilies.ui.regular);
    expect(resolveFontFamily("normal")).toBe(fontFamilies.ui.regular);
    expect(resolveFontFamily("bold")).toBe(fontFamilies.ui.bold);
  });

  it("uses Bricolage Grotesque for display type", () => {
    expect(resolveFontFamily("600", "display")).toBe(fontFamilies.display.semibold);
    expect(resolveFontFamily("900", "display")).toBe(fontFamilies.display.bold);
  });

  it("falls back to the single italic cut regardless of weight", () => {
    expect(resolveFontFamily("700", "ui", true)).toBe(fontFamilies.ui.italic);
  });
});

describe("typography scale", () => {
  it("gives every token an explicit family and line height", () => {
    for (const [token, style] of Object.entries(typography)) {
      expect(`${token}:${style.fontFamily}`).toMatch(/(SchibstedGrotesk|BricolageGrotesque)-/);
      expect(typeof style.lineHeight).toBe("number");
    }
  });

  it("tightens display type and opens up small type", () => {
    expect(typography.display.letterSpacing).toBeLessThan(0);
    expect(typography.hero.letterSpacing).toBeLessThan(0);
    expect(typography.caption.letterSpacing).toBeGreaterThan(0);
    expect(typography.overline.letterSpacing).toBeGreaterThan(0);
  });

  it("keeps standalone figures on tabular numerals so counts do not jitter", () => {
    expect(typography.numeral.fontVariant).toContain("tabular-nums");
  });
});
