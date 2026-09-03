import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, type ViewProps } from 'react-native';
import {
  WebView,
  type WebViewMessageEvent,
} from 'react-native-webview';
import type { BrainMapColors } from '../brainMapTheme';
import type { MindMapNativeRegion } from '../mindMapRegionTypes';
import {
  buildMindMapHtml,
  type MindMapPresentationMode,
  type MindMapSceneTheme,
} from './buildMindMapHtml';

export type NativeMindMapRegionPressEvent = {
  nativeEvent: { regionId: string };
};

/**
 * Where the selected pin landed in the share snapshot, as fractions of the
 * captured square. The pins are DOM overlays, so they are not in the WebGL
 * capture — the card redraws the marker at these coordinates instead.
 */
export type MindMapSharePin = {
  x: number;
  y: number;
  rank: number;
  visible: boolean;
};

export type WebMindMapViewProps = ViewProps & {
  regions: MindMapNativeRegion[];
  selectedRegionId?: string | null;
  graphPalette: BrainMapColors;
  themeMode: 'dark' | 'light';
  cameraResetToken?: number;
  reduceMotionEnabled?: boolean;
  presentationMode?: MindMapPresentationMode;
  // Bump to ask the scene for a fresh share snapshot. Rendered into an explicit
  // frame inside the WebView, so the capture never depends on this view's layout.
  shareCaptureToken?: number;
  /** Width / height of the frame the snapshot has to fill, so it is not letterboxed. */
  shareCaptureAspect?: number;
  onContentReady?: () => void;
  onSceneError?: (message?: string) => void;
  onReady?: () => void;
  onRegionPress?: (event: NativeMindMapRegionPressEvent) => void;
  onShareSnapshot?: (dataUri: string, pin: MindMapSharePin | null) => void;
};

const SHARE_SNAPSHOT_SIZE = 900;

type SceneTheme = MindMapSceneTheme;

function hexToRgb(hex: string): [number, number, number] | null {
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) {
    return null;
  }
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ];
}

// Mix a hex color toward a target (0 = original, 1 = target). Used to derive a
// subtly lifted scene-center from the theme background so the radial has depth.
function mix(hex: string, target: string, t: number): string {
  const a = hexToRgb(hex);
  const b = hexToRgb(target);
  if (!a || !b) {
    return hex;
  }
  const r = Math.round(a[0] + (b[0] - a[0]) * t);
  const g = Math.round(a[1] + (b[1] - a[1]) * t);
  const bl = Math.round(a[2] + (b[2] - a[2]) * t);
  return `rgb(${r}, ${g}, ${bl})`;
}

function buildSceneTheme(
  colors: BrainMapColors,
  themeMode: 'dark' | 'light',
): SceneTheme {
  const isDark = themeMode === 'dark';
  // Keep the design's warm gradient for the default light theme; derive from the
  // theme background otherwise so non-warm themes still read as one system.
  const bgCenter =
    themeMode === 'light' && colors.background.toUpperCase() === '#FDFCFB'
      ? '#FFF4EA'
      : mix(colors.background, isDark ? '#FFFFFF' : '#FFFFFF', isDark ? 0.06 : 0.12);
  const bgEdge =
    themeMode === 'light' && colors.background.toUpperCase() === '#FDFCFB'
      ? '#E7D4C1'
      : colors.background;

  return {
    bgCenter,
    bgEdge,
    pinBg: isDark ? 'rgba(245, 238, 230, 0.92)' : 'rgba(38, 34, 32, 0.82)',
    pinText: isDark ? '#1B1815' : '#FDF8F3',
    strong: colors.edgeActive,
    tipBg: isDark ? '#F5EEE6' : '#2D2A26',
    tipText: isDark ? '#241F1C' : '#FDF8F3',
  };
}

export default function WebMindMapView({
  regions,
  selectedRegionId,
  graphPalette,
  themeMode,
  cameraResetToken,
  reduceMotionEnabled,
  presentationMode = 'interactive',
  shareCaptureToken,
  shareCaptureAspect,
  onContentReady,
  onSceneError,
  onReady,
  onRegionPress,
  onShareSnapshot,
  style,
  ...rest
}: WebMindMapViewProps) {
  const webViewRef = useRef<WebView>(null);
  const [isReady, setIsReady] = useState(false);
  // Bake the theme into the initial HTML so the loader/background paint themed on
  // first frame. Captured once; later theme changes flow through __setMindMap
  // (updating the CSS vars live) rather than reloading the WebView.
  const initialTheme = useRef(buildSceneTheme(graphPalette, themeMode)).current;
  const html = useMemo(
    () => buildMindMapHtml(initialTheme, presentationMode),
    [initialTheme, presentationMode],
  );

  const payloadJson = useMemo(() => {
    const theme = buildSceneTheme(graphPalette, themeMode);
    return JSON.stringify({
      theme,
      reduceMotion: Boolean(reduceMotionEnabled),
      selectedId: selectedRegionId ?? null,
      regions: regions.map(region => ({
        id: region.id,
        label: region.label,
        subtitle: region.subtitle,
        signalScore: region.signalScore,
        rank: region.rank,
        isStrongest: region.isStrongest,
      })),
    });
  }, [
    graphPalette,
    themeMode,
    reduceMotionEnabled,
    selectedRegionId,
    regions,
  ]);

  // Push the latest data into the scene once it is ready and on every change.
  useEffect(() => {
    if (!isReady) {
      return;
    }
    webViewRef.current?.injectJavaScript(
      `window.__setMindMap && window.__setMindMap(${payloadJson}); true;`,
    );
  }, [isReady, payloadJson]);

  useEffect(() => {
    if (!isReady || cameraResetToken === undefined) {
      return;
    }
    webViewRef.current?.injectJavaScript(
      'window.__recenter && window.__recenter(); true;',
    );
  }, [isReady, cameraResetToken]);

  // The scene needs its data before it can frame the highlighted region, so the
  // request rides behind the payload injection above.
  useEffect(() => {
    if (!isReady || shareCaptureToken === undefined) {
      return;
    }
    const aspect =
      shareCaptureAspect && shareCaptureAspect > 0 ? shareCaptureAspect : 1;
    const width = Math.round(
      aspect >= 1 ? SHARE_SNAPSHOT_SIZE : SHARE_SNAPSHOT_SIZE * aspect,
    );
    const height = Math.round(
      aspect >= 1 ? SHARE_SNAPSHOT_SIZE / aspect : SHARE_SNAPSHOT_SIZE,
    );
    webViewRef.current?.injectJavaScript(
      'window.__captureShare && window.__captureShare({ width: ' +
        String(width) +
        ', height: ' +
        String(height) +
        ', dpr: 1 }); true;',
    );
  }, [isReady, payloadJson, shareCaptureAspect, shareCaptureToken]);

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      let message: {
        type?: string;
        message?: string;
        regionId?: string;
        snapshot?: string;
        pin?: MindMapSharePin | null;
      } | null = null;
      try {
        message = JSON.parse(event.nativeEvent.data);
      } catch {
        return;
      }

      if (!message) {
        return;
      }

      if (message.type === 'ready') {
        setIsReady(true);
        onReady?.();
        return;
      }

      if (message.type === 'pinTap' && message.regionId) {
        onRegionPress?.({ nativeEvent: { regionId: message.regionId } });
        return;
      }

      if (message.type === 'contentReady') {
        onContentReady?.();
        return;
      }

      if (message.type === 'shareSnapshot' && message.snapshot) {
        onShareSnapshot?.(message.snapshot, message.pin ?? null);
        return;
      }

      if (message.type === 'error') {
        onSceneError?.(message.message ?? 'The Mind Map renderer could not finish.');
      }
    },
    [onContentReady, onReady, onRegionPress, onSceneError, onShareSnapshot],
  );

  return (
    <WebView
      ref={webViewRef}
      {...rest}
      style={[styles.webView, style]}
      source={{ html }}
      originWhitelist={['*']}
      onMessage={handleMessage}
      onError={() => onSceneError?.('The Mind Map renderer could not load.')}
      scrollEnabled={false}
      bounces={false}
      overScrollMode="never"
      showsVerticalScrollIndicator={false}
      showsHorizontalScrollIndicator={false}
      setSupportMultipleWindows={false}
      javaScriptEnabled
      domStorageEnabled={false}
      androidLayerType="hardware"
      // Local content only; nothing to load from the network.
      cacheEnabled={false}
    />
  );
}

const styles = StyleSheet.create({
  webView: {
    backgroundColor: 'transparent',
  },
});
