import {
  captureRef,
  type CaptureOptions,
  type ViewShotRef,
} from 'react-native-view-shot';

/**
 * Screenshotting the share card. Kept apart from `mindMapShareService` on
 * purpose: that module pulls in `react-native-share`, whose native module is
 * resolved with `TurboModuleRegistry.getEnforcing` *at import time*, so a build
 * that has not linked it yet throws while the module is still evaluating. Any
 * component importing it transitively then fails to render. Capturing only needs
 * `react-native-view-shot`, which resolves its native module lazily.
 *
 * No explicit width/height: iOS captures with `drawViewHierarchyInRect`, which is
 * unreliable when the target rect does not match the view's own bounds. Natural
 * bounds at device scale already export around 1000px wide.
 */
export const MIND_MAP_CARD_CAPTURE_OPTIONS: CaptureOptions = {
  fileName: 'journal-io-mind-map',
  format: 'png',
  quality: 1,
  result: 'tmpfile',
};

/**
 * Capture the share card, with a second strategy for when the first refuses.
 *
 * `drawViewHierarchyInRect` (view-shot's default on iOS) returns `NO` for some
 * hierarchies and rejects with "The view cannot be captured… potential technical
 * or security limitation". `useRenderInContext` draws the layer directly instead
 * and is not subject to that restriction. It cannot render gradients or blur,
 * which the flat share card does not use.
 */
export async function captureMindMapCard(node: ViewShotRef): Promise<string> {
  try {
    return await node.capture();
  } catch (error) {
    if (__DEV__) {
      console.warn(
        '[MindMapShare] drawViewHierarchyInRect capture failed, retrying with renderInContext',
        error,
      );
    }

    return captureRef(node, {
      ...MIND_MAP_CARD_CAPTURE_OPTIONS,
      useRenderInContext: true,
    });
  }
}
