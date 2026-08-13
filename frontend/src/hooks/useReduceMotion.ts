import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Tracks the system Reduce Motion preference so a screen can settle animated
 * values directly instead of springing them. Read this once per screen and pass
 * the result down — one listener per screen rather than one per animated child.
 */
const useReduceMotion = () => {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let isActive = true;

    AccessibilityInfo.isReduceMotionEnabled()
      .then(enabled => {
        if (isActive) {
          setReduceMotion(enabled);
        }
      })
      .catch(() => undefined);

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion,
    );

    return () => {
      isActive = false;
      subscription.remove();
    };
  }, []);

  return reduceMotion;
};

export { useReduceMotion };
