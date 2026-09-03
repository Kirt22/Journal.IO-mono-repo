import { releaseCapture } from 'react-native-view-shot';

export type MindMapShareResult = 'shared' | 'dismissed';

const asFileUrl = (uri: string) =>
  uri.startsWith('file://') ? uri : `file://${uri}`;

/**
 * `react-native-share` resolves its native module with
 * `TurboModuleRegistry.getEnforcing('RNShare')` at import time, so a plain
 * top-level import throws while this module is still evaluating whenever the app
 * binary predates the library being linked — taking down every screen that
 * imports this file, not just the share action. Requiring it here keeps that
 * failure inside the one call that needs it, where it can be reported.
 */
function loadShare() {
  try {
    return require('react-native-share').default;
  } catch (error) {
    if (__DEV__) {
      console.warn('[MindMapShare] react-native-share failed to load', error);
    }
    throw new Error(
      'Sharing is unavailable in this build: the react-native-share native module is not in the app binary. Rebuild the app (npm run ios) — a Metro reload is not enough.',
    );
  }
}

export async function shareMindMapImage(
  captureUri: string,
): Promise<MindMapShareResult> {
  const Share = loadShare();
  const fileUrl = asFileUrl(captureUri);

  try {
    // `urls` is what the iOS module actually reads; `filename` and
    // `useInternalStorage` are for base64 payloads and Android respectively, and
    // passing them here only muddies the item the share sheet receives.
    const result = await Share.open({
      failOnCancel: false,
      saveToFiles: false,
      subject: 'My Mind Map',
      type: 'image/png',
      urls: [fileUrl],
    });

    return result.dismissedAction ? 'dismissed' : 'shared';
  } finally {
    // Safe here: react-native-share resolves from the activity controller's
    // completion handler, so the sheet is done with the file by now.
    releaseCapture(captureUri);
  }
}
