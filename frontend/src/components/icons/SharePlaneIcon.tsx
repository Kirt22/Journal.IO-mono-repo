import Svg, { Polygon } from 'react-native-svg';

type Props = {
  /** Width and height in points. The artwork scales cleanly to any size. */
  size: number;
  /** Fill for the large upper wing — the lighter of the two tones. */
  wingColor: string;
  /** Fill for the folded lower wing — the darker tone. */
  foldColor: string;
  testID?: string;
};

// A flat two-tone paper plane. Drawn as vectors rather than shipped as a PNG so
// the share screen can fly it in large and shrink it to a header glyph without
// going soft, and so it can take the current theme's accent.
export default function SharePlaneIcon({
  foldColor,
  size,
  testID,
  wingColor,
}: Props) {
  return (
    <Svg
      accessibilityRole="image"
      height={size}
      testID={testID}
      viewBox="0 0 100 100"
      width={size}
    >
      <Polygon fill={wingColor} points="92,8 8,46 42,58" />
      <Polygon fill={foldColor} points="92,8 42,58 54,92" />
    </Svg>
  );
}
