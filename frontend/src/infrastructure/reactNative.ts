import * as ReactNative from "react-native";
import type React from "react";

type Component = React.ComponentType<any>;

const ActivityIndicator =
  ReactNative.ActivityIndicator as unknown as Component;
const KeyboardAvoidingView =
  ReactNative.KeyboardAvoidingView as unknown as Component;
const Pressable = ReactNative.Pressable as unknown as Component;
const ScrollView = ReactNative.ScrollView as unknown as Component;
const StatusBar = ReactNative.StatusBar as unknown as Component;
const Text = ReactNative.Text as unknown as Component;
const TextInput = ReactNative.TextInput as unknown as Component;
const View = ReactNative.View as unknown as Component;

const Platform = ReactNative.Platform;
const StyleSheet = ReactNative.StyleSheet;

export {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
};
