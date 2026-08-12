import HapticPressable from './HapticPressable';
import {
  InputAccessoryView,
  Keyboard,
  Platform,
  StyleSheet,
  View,
} from "react-native";
import {
  Text,
} from "../infrastructure/reactNative";

type KeyboardDismissAccessoryProps = {
  nativeID: string;
  backgroundColor: string;
  borderColor: string;
  actionColor: string;
};

export default function KeyboardDismissAccessory({
  nativeID,
  backgroundColor,
  borderColor,
  actionColor,
}: KeyboardDismissAccessoryProps) {
  if (Platform.OS !== "ios") {
    return null;
  }

  return (
    <InputAccessoryView nativeID={nativeID}>
      <View
        style={[
          styles.toolbar,
          {
            backgroundColor,
            borderTopColor: borderColor,
          },
        ]}
      >
        <HapticPressable
          hapticEvent={false}
          accessibilityRole="button"
          accessibilityLabel="Dismiss keyboard"
          hitSlop={8}
          onPress={Keyboard.dismiss}
          style={({ pressed }) => [
            styles.doneButton,
            pressed && styles.doneButtonPressed,
          ]}
        >
          <Text style={[styles.doneText, { color: actionColor }]}>Done</Text>
        </HapticPressable>
      </View>
    </InputAccessoryView>
  );
}

const styles = StyleSheet.create({
  toolbar: {
    alignItems: "flex-end",
    borderTopWidth: StyleSheet.hairlineWidth,
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  doneButton: {
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  doneButtonPressed: {
    opacity: 0.55,
  },
  doneText: {
    fontSize: 16,
    fontWeight: "700",
  },
});
