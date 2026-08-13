import { Skia } from '@shopify/react-native-skia';

/**
 * SkSL port of the React Bits `Orb` GLSL fragment shader
 * (https://reactbits.dev/r/Orb-JS-CSS.json).
 *
 * Differences from the original, all deliberate:
 * - `vec2/3/4` become `float2/3/4`, `varying`/`gl_FragColor`/`precision` are
 *   dropped, and the entry point is `half4 main(float2 fragCoord)`. Skia hands
 *   us fragment coordinates already in the canvas' local logical space, so the
 *   shader is resolution independent.
 * - Output is premultiplied, which is what Skia expects and what keeps the
 *   canvas free of a rectangular background or visible boundary.
 * - The three hardcoded `baseColor` constants are uniforms, so the orb takes the
 *   active Journal.IO palette instead of the reference purple/cyan.
 * - The reference's background-luminance branch is removed. It filled the orb's
 *   centre with the background colour on light backgrounds, which read as a
 *   solid blob on the warm off-white rather than a ring. The centre is now
 *   always transparent and the two themes differ purely by palette.
 * - The original's `hover` and `hoverIntensity` collapse into one `intensity`
 *   uniform. At rest it is small but non-zero, which keeps the rim alive.
 * - Breathing is derived from `iTime` inside the shader, so it costs no uniform
 *   and freezes automatically whenever the clock stops.
 *
 * Functions stay in dependency order because SkSL has no forward declarations.
 * There are no loops anywhere in here.
 */
export const ORB_SHADER_SOURCE = `
uniform float  iTime;
uniform float2 iResolution;
uniform float  hue;
uniform float  intensity;
uniform float  rot;
uniform float3 primaryColor;
uniform float3 secondaryColor;
uniform float3 deepColor;

const float innerRadius = 0.6;
const float noiseScale = 0.65;

// Fits the ring inside the canvas so the bloom never clips at the frame edge.
// Ring diameter lands at roughly (2.0 / RING_FIT) of the canvas size.
const float RING_FIT = 2.35;

float3 rgb2yiq(float3 c) {
  float y = dot(c, float3(0.299, 0.587, 0.114));
  float i = dot(c, float3(0.596, -0.274, -0.322));
  float q = dot(c, float3(0.211, -0.523, 0.312));
  return float3(y, i, q);
}

float3 yiq2rgb(float3 c) {
  float r = c.x + 0.956 * c.y + 0.621 * c.z;
  float g = c.x - 0.272 * c.y - 0.647 * c.z;
  float b = c.x - 1.106 * c.y + 1.703 * c.z;
  return float3(r, g, b);
}

float3 adjustHue(float3 col, float hueDeg) {
  float hueRad = hueDeg * 3.14159265 / 180.0;
  float3 yiq = rgb2yiq(col);
  float cosA = cos(hueRad);
  float sinA = sin(hueRad);
  float i = yiq.y * cosA - yiq.z * sinA;
  float q = yiq.y * sinA + yiq.z * cosA;
  yiq.y = i;
  yiq.z = q;
  return yiq2rgb(yiq);
}

float3 hash33(float3 p3) {
  p3 = fract(p3 * float3(0.1031, 0.11369, 0.13787));
  p3 += dot(p3, p3.yxz + 19.19);
  return -1.0 + 2.0 * fract(float3(
    p3.x + p3.y,
    p3.x + p3.z,
    p3.y + p3.z
  ) * p3.zyx);
}

float snoise3(float3 p) {
  const float K1 = 0.333333333;
  const float K2 = 0.166666667;
  float3 i = floor(p + (p.x + p.y + p.z) * K1);
  float3 d0 = p - (i - (i.x + i.y + i.z) * K2);
  float3 e = step(float3(0.0), d0 - d0.yzx);
  float3 i1 = e * (1.0 - e.zxy);
  float3 i2 = 1.0 - e.zxy * (1.0 - e);
  float3 d1 = d0 - (i1 - K2);
  float3 d2 = d0 - (i2 - K1);
  float3 d3 = d0 - 0.5;
  float4 h = max(0.6 - float4(
    dot(d0, d0),
    dot(d1, d1),
    dot(d2, d2),
    dot(d3, d3)
  ), float4(0.0));
  float4 n = h * h * h * h * float4(
    dot(d0, hash33(i)),
    dot(d1, hash33(i + i1)),
    dot(d2, hash33(i + i2)),
    dot(d3, hash33(i + 1.0))
  );
  return dot(float4(31.316), n);
}

float4 extractAlpha(float3 colorIn) {
  float a = max(max(colorIn.r, colorIn.g), colorIn.b);
  return float4(colorIn.rgb / (a + 0.00001), a);
}

float light1(float power, float attenuation, float dist) {
  return power / (1.0 + dist * attenuation);
}

float light2(float power, float attenuation, float dist) {
  return power / (1.0 + dist * dist * attenuation);
}

float4 draw(float2 uv) {
  float3 color1 = adjustHue(primaryColor, hue);
  float3 color2 = adjustHue(secondaryColor, hue);
  float3 color3 = adjustHue(deepColor, hue);

  float ang = atan(uv.y, uv.x);
  float len = length(uv);
  float invLen = len > 0.0 ? 1.0 / len : 0.0;

  float n0 = snoise3(float3(uv * noiseScale, iTime * 0.5)) * 0.5 + 0.5;
  float r0 = mix(mix(innerRadius, 1.0, 0.4), mix(innerRadius, 1.0, 0.6), n0);
  float d0 = distance(uv, (r0 * invLen) * uv);
  float v0 = light1(1.0, 10.0, d0);

  v0 *= smoothstep(r0 * 1.05, r0, len);
  float cl = cos(ang + iTime * 2.0) * 0.5 + 0.5;

  float a = iTime * -1.0;
  float2 pos = float2(cos(a), sin(a)) * r0;
  float d = distance(uv, pos);
  float v1 = light2(1.5, 5.0, d);
  v1 *= light1(1.0, 50.0, d0);

  // v2 and v3 cut the disc back to a ring, which is what leaves the centre
  // fully transparent. The reference's light-background branch filled that
  // centre with the background colour instead, and on the warm off-white it
  // read as a solid blob rather than an energy ring — so it is gone.
  float v2 = smoothstep(1.0, mix(innerRadius, 1.0, n0 * 0.5), len);
  float v3 = smoothstep(innerRadius, mix(innerRadius, 1.0, 0.5), len);

  float3 colBase = mix(color1, color2, cl);
  // The reference adds the hotspot as flat white. On the warm off-white
  // background that blows out to the page colour and punches a hole in the
  // ring, so it is mostly tinted with the palette and only partly white.
  float3 hotspot = mix(colBase, float3(1.0), 0.35);
  float3 col = mix(color3, colBase, v0);
  col = (col + v1 * hotspot) * v2 * v3;
  col = clamp(col, 0.0, 1.0);

  return extractAlpha(col);
}

float4 mainImage(float2 fragCoord) {
  float2 center = iResolution * 0.5;
  float minSide = min(iResolution.x, iResolution.y);
  float2 uv = (fragCoord - center) / minSide * RING_FIT;

  // Dividing enlarges the apparent ring, so this breathes ~0.988 to ~1.013.
  float breathe = 1.0 + 0.0125 * sin(iTime * 0.55);
  uv /= breathe;

  float s = sin(rot);
  float c = cos(rot);
  uv = float2(c * uv.x - s * uv.y, s * uv.x + c * uv.y);

  uv.x += intensity * 0.1 * sin(uv.y * 10.0 + iTime);
  uv.y += intensity * 0.1 * sin(uv.x * 10.0 + iTime);

  return draw(uv);
}

half4 main(float2 fragCoord) {
  float4 col = mainImage(fragCoord);
  return half4(half3(col.rgb * col.a), half(col.a));
}
`;

/**
 * Compiled once at module scope. `null` means the device could not build the
 * effect, and `Orb` falls back to a static ring rather than rendering nothing.
 */
export const orbRuntimeEffect = Skia.RuntimeEffect.Make(ORB_SHADER_SOURCE);

if (!orbRuntimeEffect && __DEV__) {
  throw new Error(
    '[Orb] The SkSL runtime effect in orbShader.ts failed to compile. Skia ' +
      'logs the parser error to the native console (Xcode / logcat) — check ' +
      'there for the offending line, then fix ORB_SHADER_SOURCE.',
  );
}

const rgbCache = new Map<string, [number, number, number]>();

/**
 * Colours are normalized in JS, never in the shader. Results are cached because
 * the same handful of theme tokens are resolved on every render.
 */
export function normalizeRgb(color: string): [number, number, number] {
  const cached = rgbCache.get(color);

  if (cached) {
    return cached;
  }

  let hex = color.replace('#', '').trim();

  if (hex.length === 3) {
    hex = hex
      .split('')
      .map(char => char + char)
      .join('');
  }

  const value: [number, number, number] =
    hex.length === 6
      ? [
          Number.parseInt(hex.slice(0, 2), 16) / 255,
          Number.parseInt(hex.slice(2, 4), 16) / 255,
          Number.parseInt(hex.slice(4, 6), 16) / 255,
        ]
      : [0, 0, 0];

  rgbCache.set(color, value);

  return value;
}
