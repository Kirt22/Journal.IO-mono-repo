import { forwardRef } from 'react';
import {
  Pressable,
  type PressableProps,
  type View,
} from 'react-native';
import {
  triggerHaptic,
  type HapticEvent,
} from '../services/hapticsService';

export type HapticPressableProps = PressableProps & {
  hapticEvent?: HapticEvent | false;
  hapticLongPressEvent?: HapticEvent | false;
};

const HapticPressable = forwardRef<View, HapticPressableProps>(
  (
    {
      disabled,
      hapticEvent = 'optionSelected',
      hapticLongPressEvent = hapticEvent,
      onLongPress,
      onPress,
      ...props
    },
    ref,
  ) => {
    const handlePress: PressableProps['onPress'] = event => {
      if (!disabled && hapticEvent) {
        triggerHaptic(hapticEvent).catch(() => undefined);
      }

      onPress?.(event);
    };
    const handleLongPress: PressableProps['onLongPress'] = event => {
      if (!disabled && hapticLongPressEvent) {
        triggerHaptic(hapticLongPressEvent).catch(() => undefined);
      }

      onLongPress?.(event);
    };

    return (
      <Pressable
        {...props}
        disabled={disabled}
        onLongPress={onLongPress ? handleLongPress : undefined}
        onPress={onPress ? handlePress : undefined}
        ref={ref}
      />
    );
  },
);

HapticPressable.displayName = 'HapticPressable';

export default HapticPressable;
