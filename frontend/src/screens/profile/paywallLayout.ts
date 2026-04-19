export type PaywallLayoutMetrics = {
  discountHeroIconSize: number;
  discountNewPriceSize: number;
  footerReservedSpace: number;
  horizontalPadding: number;
  isCompact: boolean;
  isVeryCompact: boolean;
  isWide: boolean;
  lifetimeHeroLayout: "column" | "row";
  lifetimeMascotStageWidth: number;
  postAuthHeroTitleSize: number;
  postAuthTimelineMaxWidth: number;
  postAuthTopContentPadding: number;
  swipeRailTextSize: number;
  swipeRailTextHorizontalPadding: number;
};

export function getPaywallLayoutMetrics(width: number): PaywallLayoutMetrics {
  const isVeryCompact = width < 350;
  const isCompact = width < 360;
  const isWide = width >= 430;

  return {
    discountHeroIconSize: isVeryCompact ? 84 : isCompact ? 90 : 96,
    discountNewPriceSize: isVeryCompact ? 44 : isCompact ? 48 : 52,
    footerReservedSpace: isCompact ? 146 : 126,
    horizontalPadding: isCompact ? 16 : isWide ? 28 : 22,
    isCompact,
    isVeryCompact,
    isWide,
    lifetimeHeroLayout: isCompact ? "column" : "row",
    lifetimeMascotStageWidth: isCompact ? 120 : 132,
    postAuthHeroTitleSize: isVeryCompact ? 28 : isCompact ? 30 : 32,
    postAuthTimelineMaxWidth: isVeryCompact ? 252 : isCompact ? 268 : 280,
    postAuthTopContentPadding: isCompact ? 8 : 0,
    swipeRailTextSize: isCompact ? 15 : 17,
    swipeRailTextHorizontalPadding: isCompact ? 56 : 68,
  };
}
