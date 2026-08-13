import type { StyleProp, TextStyle } from 'react-native';
import { Text } from '../infrastructure/reactNative';

type PriceTextProps = {
  value: string;
  style?: StyleProp<TextStyle>;
  /**
   * Floor for the shrink, as a fraction of the style's `fontSize`. Default 0.7
   * keeps an 18pt plan price legible at 12.6pt in the worst case. Hero-scale
   * type can afford a lower floor.
   */
  minimumFontScale?: number;
  accessibilityLabel?: string;
  testID?: string;
};

/**
 * A price rendered on one line that scales itself down rather than wrapping.
 *
 * Prices come from StoreKit already localized to the user's App Store
 * storefront, so their width is not something the app controls: `$59.99` and
 * `Rp 1.499.000` land in the same box. Left alone they wrap and overflow the
 * card. Every money glyph in the app should come through here so that behaviour
 * is defined in one place instead of per screen.
 *
 * `Text` is imported from the infrastructure seam, not `react-native` — the seam
 * resolves the font family, and bypassing it silently falls back to the system
 * font.
 */
export default function PriceText({
  value,
  style,
  minimumFontScale = 0.7,
  accessibilityLabel,
  testID,
}: PriceTextProps) {
  return (
    <Text
      accessibilityLabel={accessibilityLabel}
      adjustsFontSizeToFit
      minimumFontScale={minimumFontScale}
      numberOfLines={1}
      style={style}
      testID={testID}
    >
      {value}
    </Text>
  );
}
