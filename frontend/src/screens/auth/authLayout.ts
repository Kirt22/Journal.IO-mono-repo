export type AuthLayoutMetrics = {
  contentPaddingBottom: number;
  contentPaddingTop: number;
  heroImageSize: number;
  heroSubtitleMaxWidth: number;
  heroTitleSize: number;
  horizontalPadding: number;
  isCompact: boolean;
  isVeryCompact: boolean;
  isWide: boolean;
  otpGap: number;
  otpInputSize: number;
  sheetMaxWidth: number;
};

export function getAuthLayoutMetrics(width: number): AuthLayoutMetrics {
  const isVeryCompact = width < 350;
  const isCompact = width < 360;
  const isWide = width >= 430;

  return {
    contentPaddingBottom: isCompact ? 20 : 24,
    contentPaddingTop: isCompact ? 12 : 16,
    heroImageSize: isVeryCompact ? 74 : isCompact ? 84 : isWide ? 104 : 94,
    heroSubtitleMaxWidth: isVeryCompact ? 252 : isCompact ? 284 : 340,
    heroTitleSize: isVeryCompact ? 24 : isCompact ? 26 : isWide ? 30 : 28,
    horizontalPadding: isCompact ? 16 : isWide ? 28 : 24,
    isCompact,
    isVeryCompact,
    isWide,
    otpGap: isVeryCompact ? 6 : isCompact ? 8 : 12,
    otpInputSize: isVeryCompact ? 38 : isCompact ? 40 : isWide ? 50 : 44,
    sheetMaxWidth: isWide ? 460 : 420,
  };
}
