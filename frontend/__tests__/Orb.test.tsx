import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { AccessibilityInfo, Animated } from 'react-native';
import { useDerivedValue, useFrameCallback } from 'react-native-reanimated';
import Orb, { type OrbHandle } from '../src/components/orb';
import { ORB_SHADER_SOURCE, normalizeRgb } from '../src/components/orb/orbShader';

const COLORS = {
  primaryColor: '#E87461',
  secondaryColor: '#A99BD6',
  deepColor: '#4A2E52',
};

const renderOrb = (
  props: Partial<React.ComponentProps<typeof Orb>> = {},
  scrollY?: Animated.Value,
) =>
  ReactTestRenderer.create(
    <Orb {...COLORS} scrollY={scrollY} size={300} {...props} />,
  );

const mockIsReduceMotionEnabled =
  AccessibilityInfo.isReduceMotionEnabled as jest.MockedFunction<
    typeof AccessibilityInfo.isReduceMotionEnabled
  >;

const latestFrameCallback = () => {
  const results = (useFrameCallback as jest.Mock).mock.results;
  return results[results.length - 1].value as { setActive: jest.Mock };
};

beforeEach(() => {
  jest.clearAllMocks();
  mockIsReduceMotionEnabled.mockImplementation(async () => false);
});

describe('SkSL source', () => {
  test('declares every uniform the component supplies', () => {
    for (const uniform of [
      'uniform float  iTime;',
      'uniform float2 iResolution;',
      'uniform float  hue;',
      'uniform float  intensity;',
      'uniform float  rot;',
      'uniform float3 primaryColor;',
      'uniform float3 secondaryColor;',
      'uniform float3 deepColor;',
    ]) {
      expect(ORB_SHADER_SOURCE).toContain(uniform);
    }
  });

  test('is SkSL, not GLSL', () => {
    // These would all compile under GLSL ES and silently fail under SkSL.
    for (const glslOnly of [
      'gl_FragColor',
      'varying',
      'precision',
      'vec2(',
      'vec3(',
      'vec4(',
      'uniform vec',
    ]) {
      expect(ORB_SHADER_SOURCE).not.toContain(glslOnly);
    }

    expect(ORB_SHADER_SOURCE).toContain('half4 main(float2 fragCoord)');
    // Skia expects premultiplied output.
    expect(ORB_SHADER_SOURCE).toContain('half4(half3(col.rgb * col.a)');
  });

  test('leaves the centre transparent instead of filling it', () => {
    // The reference filled the centre with the background colour on light
    // backgrounds, which read as a solid blob on the warm off-white.
    expect(ORB_SHADER_SOURCE).not.toContain('bgLuminance');
    expect(ORB_SHADER_SOURCE).not.toContain('backgroundColor');
    expect(ORB_SHADER_SOURCE).toContain('col = (col + v1 * hotspot) * v2 * v3;');
  });

  test('keeps the reference colours out of the shader body', () => {
    expect(ORB_SHADER_SOURCE).not.toContain('baseColor1');
    expect(ORB_SHADER_SOURCE).not.toContain('0.611765');
    expect(ORB_SHADER_SOURCE).not.toContain('0.913725');
  });
});

describe('normalizeRgb', () => {
  test('normalizes six-digit and shorthand hex', () => {
    expect(normalizeRgb('#FFFFFF')).toEqual([1, 1, 1]);
    expect(normalizeRgb('#000000')).toEqual([0, 0, 0]);
    expect(normalizeRgb('#fff')).toEqual([1, 1, 1]);

    const [r, g, b] = normalizeRgb('#E87461');
    expect(r).toBeCloseTo(0.9098, 3);
    expect(g).toBeCloseTo(0.4549, 3);
    expect(b).toBeCloseTo(0.3804, 3);
  });

  test('returns the same array instance for a repeated colour', () => {
    expect(normalizeRgb('#123456')).toBe(normalizeRgb('#123456'));
  });
});

describe('Orb', () => {
  test('is decorative and hidden from assistive tech', async () => {
    let root: ReactTestRenderer.ReactTestRenderer;

    await ReactTestRenderer.act(async () => {
      root = renderOrb();
      await Promise.resolve();
    });

    const orb = root!.root.findByProps({ testID: 'home-orb' });
    expect(orb.props.accessibilityElementsHidden).toBe(true);
    expect(orb.props.importantForAccessibility).toBe('no-hide-descendants');
    expect(orb.props.pointerEvents).toBe('none');

    ReactTestRenderer.act(() => root!.unmount());
  });

  test('runs the frame callback while visible and stops it on unmount', async () => {
    let root: ReactTestRenderer.ReactTestRenderer;

    await ReactTestRenderer.act(async () => {
      root = renderOrb();
      await Promise.resolve();
    });

    const { setActive } = latestFrameCallback();
    expect(setActive).toHaveBeenLastCalledWith(true);

    ReactTestRenderer.act(() => root!.unmount());
    expect(setActive).toHaveBeenLastCalledWith(false);
  });

  test('does not run the frame callback while paused', async () => {
    let root: ReactTestRenderer.ReactTestRenderer;

    await ReactTestRenderer.act(async () => {
      root = renderOrb({ paused: true });
      await Promise.resolve();
    });

    expect(latestFrameCallback().setActive).not.toHaveBeenCalledWith(true);

    ReactTestRenderer.act(() => root!.unmount());
  });

  test('does not run the frame callback under Reduce Motion', async () => {
    mockIsReduceMotionEnabled.mockResolvedValue(true);
    let root: ReactTestRenderer.ReactTestRenderer;

    await ReactTestRenderer.act(async () => {
      root = renderOrb();
      await Promise.resolve();
    });

    expect(latestFrameCallback().setActive).toHaveBeenLastCalledWith(false);

    ReactTestRenderer.act(() => root!.unmount());
  });

  test('parallaxes and dissolves as the screen scrolls past it', async () => {
    const scrollY = new Animated.Value(0);
    let root: ReactTestRenderer.ReactTestRenderer;

    await ReactTestRenderer.act(async () => {
      root = renderOrb({}, scrollY);
      await Promise.resolve();
    });

    const orb = root!.root.findByProps({ testID: 'home-orb' });
    const style = orb.props.style.find(
      (entry: { opacity?: unknown } | null) => entry && entry.opacity,
    );
    const readOpacity = () => style.opacity.__getValue();
    const readTranslateY = () => style.transform[0].translateY.__getValue();
    const readScale = () => style.transform[1].scale.__getValue();

    expect(readOpacity()).toBe(1);
    expect(readTranslateY()).toBe(0);
    expect(readScale()).toBe(1);

    // size 300 -> fade distance 210.
    ReactTestRenderer.act(() => scrollY.setValue(210));
    expect(readOpacity()).toBe(0);
    expect(readTranslateY()).toBeCloseTo(88.2, 1);
    expect(readScale()).toBeCloseTo(0.9, 2);

    // Past the fade distance everything stays clamped.
    ReactTestRenderer.act(() => scrollY.setValue(900));
    expect(readOpacity()).toBe(0);
    expect(readScale()).toBeCloseTo(0.9, 2);

    // Overscrolling upward grows it slightly.
    ReactTestRenderer.act(() => scrollY.setValue(-120));
    expect(readOpacity()).toBe(1);
    expect(readScale()).toBeCloseTo(1.04, 2);

    ReactTestRenderer.act(() => root!.unmount());
  });

  test('pauses once it has scrolled out of view and resumes on the way back', async () => {
    const scrollY = new Animated.Value(0);
    let root: ReactTestRenderer.ReactTestRenderer;

    await ReactTestRenderer.act(async () => {
      root = renderOrb({}, scrollY);
      await Promise.resolve();
    });

    expect(latestFrameCallback().setActive).toHaveBeenLastCalledWith(true);

    // 210 fade distance + the 48pt hysteresis band.
    await ReactTestRenderer.act(async () => {
      scrollY.setValue(400);
      await Promise.resolve();
    });
    expect(latestFrameCallback().setActive).toHaveBeenLastCalledWith(false);

    await ReactTestRenderer.act(async () => {
      scrollY.setValue(0);
      await Promise.resolve();
    });
    expect(latestFrameCallback().setActive).toHaveBeenLastCalledWith(true);

    ReactTestRenderer.act(() => root!.unmount());
  });
});

describe('press surge', () => {
  /**
   * The shader warps the ring with `intensity`, so the press reaction is
   * observable as a uniform value rather than as a rendered element. The mocked
   * `useDerivedValue` only runs its factory once, so re-invoke the latest one to
   * read the uniforms as they stand now.
   */
  const latestUniforms = () => {
    const calls = (useDerivedValue as jest.Mock).mock.calls;
    const factory = calls[calls.length - 1][0] as () => { intensity: number };
    return factory();
  };

  test('exposes a pulse handle that surges the ring, not an overlay', async () => {
    const ref = React.createRef<OrbHandle>();
    let root: ReactTestRenderer.ReactTestRenderer;

    await ReactTestRenderer.act(async () => {
      root = renderOrb({ ref });
      await Promise.resolve();
    });

    expect(typeof ref.current?.pulse).toBe('function');
    expect(latestUniforms().intensity).toBeCloseTo(0.28, 5);

    ReactTestRenderer.act(() => {
      ref.current?.pulse();
    });

    // Peaks well short of activeIntensity (1.3): rendering the shader across a
    // sweep showed the ring becomes a six-lobed flower up there, so the press
    // charge stops where the silhouette is still a circle.
    expect(latestUniforms().intensity).toBeCloseTo(0.6, 5);
    expect(latestUniforms().intensity).toBeLessThan(1.3);

    ReactTestRenderer.act(() => root!.unmount());
  });

  test('honours an explicit pressIntensity peak', async () => {
    const ref = React.createRef<OrbHandle>();
    let root: ReactTestRenderer.ReactTestRenderer;

    await ReactTestRenderer.act(async () => {
      root = renderOrb({ ref, pressIntensity: 0.9 });
      await Promise.resolve();
    });

    ReactTestRenderer.act(() => {
      ref.current?.pulse();
    });

    expect(latestUniforms().intensity).toBeCloseTo(0.9, 5);

    ReactTestRenderer.act(() => root!.unmount());
  });

  test('stays settled under Reduce Motion', async () => {
    mockIsReduceMotionEnabled.mockImplementation(async () => true);

    const ref = React.createRef<OrbHandle>();
    let root: ReactTestRenderer.ReactTestRenderer;

    await ReactTestRenderer.act(async () => {
      root = renderOrb({ ref });
      await Promise.resolve();
    });

    ReactTestRenderer.act(() => {
      ref.current?.pulse();
    });

    // The orb renders a settled frame on purpose here; a press must not warp it.
    expect(latestUniforms().intensity).toBeCloseTo(0.28, 5);

    ReactTestRenderer.act(() => root!.unmount());
  });
});
