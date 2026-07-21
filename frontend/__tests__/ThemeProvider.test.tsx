/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Appearance, Pressable, Text } from 'react-native';
import { ThemeProvider, useThemeTransition } from '../src/theme/provider';
import { getTheme } from '../src/theme/theme';

function ThemeTransitionTrigger({ onCovered }: { onCovered: () => void }) {
  const startThemeTransition = useThemeTransition();

  return (
    <Pressable
      accessibilityLabel="Start theme transition"
      onPress={() =>
        startThemeTransition({
          nextModeOverride: 'dark',
          onCovered,
        })
      }
    >
      <Text>Change theme</Text>
    </Pressable>
  );
}

describe('ThemeProvider', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('syncs the native appearance to the app theme override', () => {
    const setColorSchemeSpy = jest.spyOn(Appearance, 'setColorScheme');

    let renderer: ReactTestRenderer.ReactTestRenderer;

    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider modeOverride="dark">
          <Text>Journal.IO</Text>
        </ThemeProvider>,
      );
    });

    expect(setColorSchemeSpy).toHaveBeenCalledWith('dark');

    ReactTestRenderer.act(() => {
      renderer!.update(
        <ThemeProvider modeOverride={null}>
          <Text>Journal.IO</Text>
        </ThemeProvider>,
      );
    });

    expect(setColorSchemeSpy).toHaveBeenLastCalledWith('unspecified');
  });

  it('commits the new theme after the ripple covers the screen', () => {
    jest.useFakeTimers();
    const onCovered = jest.fn();
    let renderer: ReactTestRenderer.ReactTestRenderer;

    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider modeOverride="light">
          <ThemeTransitionTrigger onCovered={onCovered} />
        </ThemeProvider>,
      );
    });

    ReactTestRenderer.act(() => {
      renderer!.root
        .findByProps({ accessibilityLabel: 'Start theme transition' })
        .props.onPress();
    });

    expect(onCovered).not.toHaveBeenCalled();

    ReactTestRenderer.act(() => {
      jest.advanceTimersByTime(220);
    });

    expect(onCovered).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it('uses the Sky Blue palette for new and legacy grey selections', () => {
    expect(getTheme('sky_blue').colors.primary).toBe('#3B82C4');
    expect(getTheme('minimal_grey').colors.primary).toBe('#3B82C4');
  });
});
