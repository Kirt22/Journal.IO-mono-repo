import * as ReactNative from 'react-native';

/**
 * Clipboard access lives behind this seam so screens never have to know which
 * module provides it. React Native still ships one; if it is ever dropped in
 * favour of `@react-native-clipboard/clipboard`, only this file changes.
 *
 * The lookup is lazy and cached: the core export is a getter that logs a
 * one-time deprecation notice, so it stays untouched until the first copy, and
 * runtimes without the native module (Jest, dev tooling) fall back to null
 * rather than throwing at import time.
 */

type ClipboardModule = {
  setString: (text: string) => void;
};

let cachedClipboard: ClipboardModule | null | undefined;

const getClipboard = (): ClipboardModule | null => {
  if (cachedClipboard !== undefined) {
    return cachedClipboard;
  }

  try {
    const resolved = (ReactNative as unknown as { Clipboard?: ClipboardModule })
      .Clipboard;

    cachedClipboard =
      typeof resolved?.setString === 'function' ? resolved : null;
  } catch {
    cachedClipboard = null;
  }

  return cachedClipboard;
};

/**
 * Copies `text` to the system clipboard. Returns false instead of throwing when
 * there is nothing to copy or the platform clipboard is unavailable, so callers
 * can skip their success feedback without a crash.
 */
export const copyToClipboard = (text: string): boolean => {
  const trimmed = text.trim();

  if (!trimmed) {
    return false;
  }

  const clipboard = getClipboard();

  if (!clipboard) {
    return false;
  }

  try {
    clipboard.setString(trimmed);
    return true;
  } catch {
    return false;
  }
};

export const resetClipboardForTests = () => {
  cachedClipboard = undefined;
};
