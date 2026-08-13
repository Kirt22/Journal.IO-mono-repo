/**
 * @format
 */

import React from 'react';
import { Image, Modal, StyleSheet } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import NewEntryChoiceSheet from '../src/components/NewEntryChoiceSheet';
import { ThemeProvider } from '../src/theme/provider';

const safeAreaMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, bottom: 34, left: 0, right: 0 },
};

const mountedRoots = new Set<ReactTestRenderer.ReactTestRenderer>();

afterEach(() => {
  ReactTestRenderer.act(() => {
    mountedRoots.forEach(root => root.unmount());
    mountedRoots.clear();
  });
});

function renderSheet({
  isGuidedLocked = false,
  onSelect = jest.fn(),
  onGuidedLockedPress = jest.fn(),
}: {
  isGuidedLocked?: boolean;
  onSelect?: jest.Mock;
  onGuidedLockedPress?: jest.Mock;
} = {}) {
  let root!: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <ThemeProvider modeOverride="light">
          <NewEntryChoiceSheet
            visible
            isGuidedLocked={isGuidedLocked}
            onSelect={onSelect}
            onGuidedLockedPress={onGuidedLockedPress}
            onClose={jest.fn()}
          />
        </ThemeProvider>
      </SafeAreaProvider>,
    );
  });

  mountedRoots.add(root);

  return root;
}

test('dims the screen behind the two PNG entry icons and opens both premium choices', () => {
  const onSelect = jest.fn();
  const root = renderSheet({ onSelect });

  // The sheet animates itself so the scrim can fade over the screen instead of
  // sliding up with the card, which is what Modal's own `slide` would do.
  expect(root.root.findByType(Modal).props.animationType).toBe('none');
  expect(root.root.findAllByType(Image)).toHaveLength(2);
  const scrim = root.root.findByProps({ testID: 'new-entry-choice-scrim' });
  expect(StyleSheet.flatten(scrim.props.style).backgroundColor).toBe(
    'rgba(45, 42, 38, 0.32)',
  );
  expect(root.root.findByProps({ accessibilityLabel: 'Dismiss' })).toBeTruthy();

  ReactTestRenderer.act(() => {
    root.root
      .findByProps({ accessibilityLabel: 'Guided reflection' })
      .props.onPress();
    root.root
      .findByProps({ accessibilityLabel: 'Open-ended entry' })
      .props.onPress();
  });

  expect(onSelect).toHaveBeenNthCalledWith(1, 'guided');
  expect(onSelect).toHaveBeenNthCalledWith(2, 'open_ended');
});

test('routes a locked Guided tap only to the Pro action', () => {
  const onSelect = jest.fn();
  const onGuidedLockedPress = jest.fn();
  const root = renderSheet({
    isGuidedLocked: true,
    onSelect,
    onGuidedLockedPress,
  });

  ReactTestRenderer.act(() => {
    root.root
      .findByProps({ accessibilityLabel: 'Guided reflection, Pro locked' })
      .props.onPress();
  });

  expect(onGuidedLockedPress).toHaveBeenCalledTimes(1);
  expect(onSelect).not.toHaveBeenCalled();
});

test('keeps the modal mounted and notifies once after native dismissal', () => {
  const onDismissComplete = jest.fn();
  let root!: ReactTestRenderer.ReactTestRenderer;

  const renderTree = (visible: boolean) => (
    <SafeAreaProvider initialMetrics={safeAreaMetrics}>
      <ThemeProvider modeOverride="light">
        <NewEntryChoiceSheet
          visible={visible}
          onSelect={jest.fn()}
          onClose={jest.fn()}
          onDismissComplete={onDismissComplete}
        />
      </ThemeProvider>
    </SafeAreaProvider>
  );

  ReactTestRenderer.act(() => {
    root = ReactTestRenderer.create(renderTree(true));
  });
  mountedRoots.add(root);

  ReactTestRenderer.act(() => {
    root.update(renderTree(false));
  });

  expect(onDismissComplete).not.toHaveBeenCalled();
  const dismissedModal = root.root.findByType(Modal);
  expect(dismissedModal.props.visible).toBe(false);

  ReactTestRenderer.act(() => {
    const notifyNativeDismiss = dismissedModal.props.onDismiss;
    notifyNativeDismiss();
    notifyNativeDismiss();
  });

  expect(onDismissComplete).toHaveBeenCalledTimes(1);
});
