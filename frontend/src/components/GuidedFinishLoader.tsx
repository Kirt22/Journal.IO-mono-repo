import { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '../infrastructure/reactNative';
import JournalLoader from './JournalLoader';

const GUIDED_FINISH_STEPS = [
  'Saving your entry',
  'Noticing patterns',
  'Preparing analysis',
] as const;

/**
 * Inline save progress that lives on the button itself, so finishing an entry
 * never hands the user off to a full-screen loader. Shared by the guided
 * reflection finish step and the open-ended composer.
 */
export default function GuidedFinishLoader({
  active,
  color,
}: {
  active: boolean;
  color: string;
}) {
  const [step, setStep] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then(enabled => mounted && setReduceMotion(enabled))
      .catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion,
    );

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!active || reduceMotion) {
      setStep(0);
      return undefined;
    }

    const timer = setInterval(() => {
      setStep(current => (current + 1) % GUIDED_FINISH_STEPS.length);
    }, 950);
    return () => clearInterval(timer);
  }, [active, reduceMotion]);

  return (
    <View style={styles.row}>
      <JournalLoader animating={active} color={color} size="small" />
      <Text style={[styles.text, { color }]}>
        {reduceMotion ? 'Preparing analysis...' : GUIDED_FINISH_STEPS[step]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'center',
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 15,
  },
});
