import { useRef, type ReactNode } from 'react';
import {
  StyleSheet,
  View,
  type GestureResponderEvent,
} from 'react-native';
import { triggerHaptic } from '../services/hapticsService';

const MAX_TAP_DISTANCE = 12;
const MAX_TAP_DURATION_MS = 550;

type TouchStart = {
  pageX: number;
  pageY: number;
  startedAt: number;
};

type HapticInteractionLayerProps = {
  children: ReactNode;
};

export default function HapticInteractionLayer({
  children,
}: HapticInteractionLayerProps) {
  const touchStartRef = useRef<TouchStart | null>(null);

  const handleTouchStart = (event: GestureResponderEvent) => {
    const { pageX, pageY } = event.nativeEvent;

    touchStartRef.current = {
      pageX,
      pageY,
      startedAt: Date.now(),
    };
  };

  const handleTouchEnd = (event: GestureResponderEvent) => {
    const touchStart = touchStartRef.current;
    touchStartRef.current = null;

    if (!touchStart) {
      return;
    }

    const { pageX, pageY } = event.nativeEvent;
    const distance = Math.hypot(pageX - touchStart.pageX, pageY - touchStart.pageY);
    const duration = Date.now() - touchStart.startedAt;

    // Avoid feedback for scroll gestures and long-press text selection.
    if (distance > MAX_TAP_DISTANCE || duration > MAX_TAP_DURATION_MS) {
      return;
    }

    triggerHaptic('optionSelected').catch(() => undefined);
  };

  return (
    <View
      onTouchEnd={handleTouchEnd}
      onTouchStart={handleTouchStart}
      style={styles.root}
      testID="haptic-interaction-layer"
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
