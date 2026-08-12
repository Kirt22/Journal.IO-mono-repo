import * as ReactNative from "react-native";
import React from "react";
import type { TextStyle } from "react-native";
import { fontFamilies, resolveFontFamily, roleForSize } from "../theme/typography";

type Component = React.ComponentType<any>;

const ActivityIndicator =
  ReactNative.ActivityIndicator as unknown as Component;
const KeyboardAvoidingView =
  ReactNative.KeyboardAvoidingView as unknown as Component;
const ScrollView = ReactNative.ScrollView as unknown as Component;
const StatusBar = ReactNative.StatusBar as unknown as Component;
const View = ReactNative.View as unknown as Component;

const Platform = ReactNative.Platform;
const StyleSheet = ReactNative.StyleSheet;

/**
 * Every `Text` and `TextInput` in the app flows through here so the type system
 * in `theme/typography.ts` applies without each screen restating it.
 *
 * The app carries ~700 `fontWeight` declarations across ~96 StyleSheet blocks.
 * Rather than annotate each one with a family, this resolves the weight to a
 * concrete font file at render time and then *removes* the weight: leaving it
 * set makes Android synthesise fake-bold on top of an already-bold file, which
 * reads as a smear. An explicit `fontFamily` in a style always wins, which is
 * how display type opts into Bricolage Grotesque.
 */
const DEFAULT_TEXT_STYLE: TextStyle = {
  fontFamily: fontFamilies.ui.regular,
  ...(ReactNative.Platform.OS === "android"
    ? { includeFontPadding: false }
    : null),
};

// Registered StyleSheet styles are stable numeric ids, so resolution is cached
// against them. Inline object styles get a fresh identity every render and are
// deliberately not cached, to keep this map from growing without bound.
const resolvedStyleCache = new Map<string, TextStyle>();

function cacheKey(style: unknown): string | null {
  if (typeof style === "number") {
    return String(style);
  }

  if (Array.isArray(style)) {
    let key = "";

    for (const entry of style) {
      if (typeof entry === "number") {
        key += `${entry},`;
      } else if (entry == null || entry === false) {
        key += "_,";
      } else {
        return null;
      }
    }

    return key;
  }

  return null;
}

function applyFont(style: unknown): unknown {
  if (style == null || style === false) {
    return DEFAULT_TEXT_STYLE;
  }

  const key = cacheKey(style);

  if (key !== null) {
    const cached = resolvedStyleCache.get(key);

    if (cached) {
      return cached;
    }
  }

  const flattened = StyleSheet.flatten(style as never) as TextStyle | undefined;

  if (!flattened) {
    return DEFAULT_TEXT_STYLE;
  }

  const { fontWeight, ...rest } = flattened;
  const resolved: TextStyle = {
    ...DEFAULT_TEXT_STYLE,
    ...rest,
    fontFamily:
      flattened.fontFamily ??
      resolveFontFamily(
        fontWeight,
        roleForSize(flattened.fontSize),
        flattened.fontStyle === "italic",
      ),
  };

  if (key !== null) {
    resolvedStyleCache.set(key, resolved);
  }

  return resolved;
}

// React Native declares Text and TextInput as classes, so each name carries an
// instance type as well as a value. The wrappers are cast back to the original
// component types, and a matching type alias is declared alongside, so callers
// keep both `<Text style={…}>` and `useRef<TextInput>(null)` working unchanged.
const RNText = ReactNative.Text as unknown as Component;
const RNTextInput = ReactNative.TextInput as unknown as Component;

const Text = React.forwardRef<unknown, Record<string, unknown>>(
  ({ style, ...props }, ref) =>
    React.createElement(RNText, { ...props, ref, style: applyFont(style) }),
) as unknown as typeof ReactNative.Text;
(Text as unknown as Component).displayName = "Text";
type Text = ReactNative.Text;

const TextInput = React.forwardRef<unknown, Record<string, unknown>>(
  ({ style, ...props }, ref) =>
    React.createElement(RNTextInput, { ...props, ref, style: applyFont(style) }),
) as unknown as typeof ReactNative.TextInput;
(TextInput as unknown as Component).displayName = "TextInput";
type TextInput = ReactNative.TextInput;

export {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
};
