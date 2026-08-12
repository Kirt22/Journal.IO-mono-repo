import { forwardRef } from 'react';
import { Switch, type SwitchProps } from 'react-native';
import {
  triggerHaptic,
  type HapticEvent,
} from '../services/hapticsService';

export type HapticSwitchProps = SwitchProps & {
  hapticEvent?: HapticEvent | false;
};

const HapticSwitch = forwardRef<Switch, HapticSwitchProps>(
  (
    {
      disabled,
      hapticEvent = 'optionSelected',
      onValueChange,
      ...props
    },
    ref,
  ) => (
    <Switch
      {...props}
      disabled={disabled}
      onValueChange={
        onValueChange
          ? nextValue => {
              if (!disabled && hapticEvent) {
                triggerHaptic(hapticEvent).catch(() => undefined);
              }
              onValueChange(nextValue);
            }
          : undefined
      }
      ref={ref}
    />
  ),
);

HapticSwitch.displayName = 'HapticSwitch';

export default HapticSwitch;
