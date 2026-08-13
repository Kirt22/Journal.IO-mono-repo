/**
 * @format
 */

import React from 'react';
import * as ReactTestRenderer from 'react-test-renderer';
import { StyleSheet } from 'react-native';
import GoalRow from '../src/components/GoalRow';
import type { SavedGoal } from '../src/services/goalsService';
import { ThemeProvider } from '../src/theme/provider';

jest.mock('../src/services/hapticsService', () => ({
  triggerHaptic: jest.fn(async () => undefined),
}));

const makeGoal = (overrides: Partial<SavedGoal> = {}): SavedGoal => ({
  id: 'goal-1',
  title: 'Walk after lunch',
  description: null,
  icon: 'walk',
  iconSource: 'automatic',
  frequency: 'daily',
  status: 'active',
  reminderEnabled: false,
  reminderTime: null,
  lastCompletedLocalDate: null,
  isCompletedForPeriod: false,
  createdAt: '2026-08-06T08:00:00.000Z',
  updatedAt: '2026-08-06T08:00:00.000Z',
  ...overrides,
});

const renderRow = (
  goal: SavedGoal,
  props: Partial<React.ComponentProps<typeof GoalRow>> = {},
) =>
  ReactTestRenderer.create(
    <ThemeProvider modeOverride="light">
      <GoalRow
        goal={goal}
        presentation="manage"
        onToggleComplete={jest.fn()}
        onEdit={jest.fn()}
        onArchive={jest.fn()}
        onUnarchive={jest.fn()}
        {...props}
      />
    </ThemeProvider>,
  );

test('offers edit and archive actions without a delete action', async () => {
  let root!: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(async () => {
    root = renderRow(makeGoal());
    await Promise.resolve();
  });

  expect(
    root.root.findByProps({ accessibilityLabel: 'Edit goal Walk after lunch' }),
  ).toBeTruthy();
  expect(
    root.root.findByProps({
      accessibilityLabel: 'Archive goal Walk after lunch',
    }),
  ).toBeTruthy();
  expect(JSON.stringify(root.toJSON())).not.toContain('Delete');
});

test('an archived goal exposes unarchive and completion only fills the tick', async () => {
  const goal = makeGoal({ status: 'archived' });
  const onToggleComplete = jest.fn();
  let root!: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(async () => {
    root = renderRow(goal, { onToggleComplete });
    await Promise.resolve();
  });

  expect(
    root.root.findByProps({
      accessibilityLabel: 'Unarchive goal Walk after lunch',
    }),
  ).toBeTruthy();

  await ReactTestRenderer.act(async () => {
    root.root
      .findByProps({
        accessibilityLabel: 'Mark goal complete: Walk after lunch',
      })
      .props.onPress();
    await Promise.resolve();
  });

  expect(onToggleComplete).toHaveBeenCalledWith(goal, true);
  expect(JSON.stringify(root.toJSON())).not.toContain('line-through');
});

test('keeps tick motion and fill on separate animated style nodes', async () => {
  let root!: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(async () => {
    root = renderRow(makeGoal(), { presentation: 'home' });
    await Promise.resolve();
  });

  const motionStyle = StyleSheet.flatten(
    root.root.findByProps({ testID: 'goal-tick-motion' }).props.style,
  );
  const fillStyle = StyleSheet.flatten(
    root.root.findByProps({ testID: 'goal-tick-fill' }).props.style,
  );

  expect(motionStyle.transform).toBeDefined();
  expect(motionStyle.backgroundColor).toBeUndefined();
  expect(fillStyle.transform).toBeUndefined();
  expect(fillStyle.backgroundColor).toBeDefined();
  expect(fillStyle.borderColor).toBeDefined();
});

test('applies the Home exit animation to the whole swipe row shell', async () => {
  let root!: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(async () => {
    root = renderRow(makeGoal(), { presentation: 'home' });
    await Promise.resolve();
  });

  const shellStyle = StyleSheet.flatten(
    root.root.findByProps({ testID: 'goal-row-shell' }).props.style,
  );
  const foregroundStyle = StyleSheet.flatten(
    root.root.findByProps({ testID: 'goal-row-foreground' }).props.style,
  );

  expect(shellStyle.opacity).toBeDefined();
  expect(shellStyle.transform).toHaveLength(2);
  expect(shellStyle.transform[0].translateY).toBeDefined();
  expect(shellStyle.transform[1].scale).toBeDefined();
  expect(foregroundStyle.opacity).toBeUndefined();
  expect(foregroundStyle.transform).toHaveLength(1);
  expect(foregroundStyle.transform[0].translateX).toBeDefined();
});
