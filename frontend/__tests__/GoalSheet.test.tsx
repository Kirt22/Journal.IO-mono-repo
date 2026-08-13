/**
 * @format
 */

import React from 'react';
import * as ReactTestRenderer from 'react-test-renderer';
import { Alert } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import GoalSheet from '../src/components/GoalSheet';
import { ThemeProvider } from '../src/theme/provider';
import { REMINDER_TIME_OPTIONS } from '../src/constants/reminderTimes';
import type { SavedGoal } from '../src/services/goalsService';

jest.mock('../src/services/reminderNotificationsService', () => ({
  getReminderPermissionGranted: jest.fn(async () => true),
  requestReminderPermission: jest.fn(async () => true),
}));

const {
  getReminderPermissionGranted,
  requestReminderPermission,
} = require('../src/services/reminderNotificationsService');

const safeAreaMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const makeGoal = (overrides: Partial<SavedGoal> = {}): SavedGoal => ({
  id: 'g1',
  title: 'Journal every evening',
  description: 'One honest line.',
  icon: 'journal',
  iconSource: 'automatic',
  frequency: 'daily',
  status: 'active',
  reminderEnabled: false,
  reminderTime: null,
  lastCompletedLocalDate: null,
  isCompletedForPeriod: false,
  createdAt: '2026-08-04T09:00:00.000Z',
  updatedAt: '2026-08-04T09:00:00.000Z',
  ...overrides,
});

const renderSheet = (
  props: Partial<React.ComponentProps<typeof GoalSheet>> = {},
) =>
  ReactTestRenderer.create(
    <SafeAreaProvider initialMetrics={safeAreaMetrics}>
      <ThemeProvider modeOverride="light">
        <GoalSheet
          visible
          mode="add"
          isSubmitting={false}
          onSubmit={jest.fn()}
          onClose={jest.fn()}
          {...props}
        />
      </ThemeProvider>
    </SafeAreaProvider>,
  );

beforeEach(() => {
  jest.clearAllMocks();
  getReminderPermissionGranted.mockResolvedValue(true);
  requestReminderPermission.mockResolvedValue(true);
});

test('add mode shows the reminder toggle and offers the shared preset times', async () => {
  let root!: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(async () => {
    root = renderSheet();
  });

  const toggle = root.root.findByProps({
    accessibilityLabel: 'Remind me about this goal',
  });

  await ReactTestRenderer.act(async () => {
    toggle.props.onValueChange(true);
  });

  await ReactTestRenderer.act(async () => {
    root.root
      .findByProps({ accessibilityLabel: 'Choose reminder time' })
      .props.onPress();
  });

  const tree = JSON.stringify(root.toJSON());

  // Time choices come from the one shared list, not a local copy.
  for (const option of REMINDER_TIME_OPTIONS) {
    expect(tree).toContain(option.label);
  }
});

test('as_needed collapses and disables the reminder controls', async () => {
  let root!: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(async () => {
    root = renderSheet();
  });

  await ReactTestRenderer.act(async () => {
    root.root.findByProps({ accessibilityLabel: 'As needed' }).props.onPress();
  });

  // The body stays mounted for a smooth exit but cannot receive touches.
  expect(
    root.root.findByProps({
      accessibilityLabel: 'Remind me about this goal',
    }),
  ).toBeTruthy();
  expect(
    root.root.findAll(node => node.props.pointerEvents === 'none').length,
  ).toBeGreaterThan(0);
});

test('permission is requested only when the toggle is switched on', async () => {
  getReminderPermissionGranted.mockResolvedValue(false);

  let root!: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(async () => {
    root = renderSheet();
  });

  // Nothing asked just by opening the sheet.
  expect(requestReminderPermission).not.toHaveBeenCalled();

  await ReactTestRenderer.act(async () => {
    root.root
      .findByProps({ accessibilityLabel: 'Remind me about this goal' })
      .props.onValueChange(true);
  });

  expect(requestReminderPermission).toHaveBeenCalledTimes(1);
});

test('a denied permission keeps the preference on and explains why', async () => {
  getReminderPermissionGranted.mockResolvedValue(false);
  requestReminderPermission.mockResolvedValue(false);

  let root!: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(async () => {
    root = renderSheet();
  });

  await ReactTestRenderer.act(async () => {
    root.root
      .findByProps({ accessibilityLabel: 'Remind me about this goal' })
      .props.onValueChange(true);
  });

  // The preference stays on so it starts working the moment access is granted.
  expect(
    root.root.findByProps({ accessibilityLabel: 'Remind me about this goal' })
      .props.value,
  ).toBe(true);
  expect(
    root.root.findAllByProps({
      accessibilityLabel: 'Open notification settings',
    }).length,
  ).toBeGreaterThan(0);
});

test('submitting an add carries the whole draft', async () => {
  const onSubmit = jest.fn();
  let root!: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(async () => {
    root = renderSheet({ onSubmit });
  });

  await ReactTestRenderer.act(async () => {
    root.root
      .findByProps({ accessibilityLabel: 'Goal icon gym' })
      .props.onPress();
  });

  await ReactTestRenderer.act(async () => {
    root.root.findByProps({ accessibilityLabel: 'Weekly' }).props.onPress();
  });

  const input = root.root.findAllByType(require('react-native').TextInput)[0];

  await ReactTestRenderer.act(async () => {
    input.props.onChangeText('Gym session');
  });

  await ReactTestRenderer.act(async () => {
    root.root.findByProps({ accessibilityLabel: 'Add goal' }).props.onPress();
  });

  expect(onSubmit).toHaveBeenCalledWith(
    expect.objectContaining({
      title: 'Gym session',
      icon: 'gym',
      iconSource: 'fixed',
      frequency: 'weekly',
    }),
  );
});

test('edit mode on an active goal offers Archive but never Delete', async () => {
  let root!: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(async () => {
    root = renderSheet({
      mode: 'edit',
      goal: makeGoal(),
      onDelete: jest.fn(),
    });
  });

  expect(
    root.root.findAllByProps({
      accessibilityLabel: 'Archive goal Journal every evening',
    }).length,
  ).toBeGreaterThan(0);
  // Delete is only ever reachable for an already-archived goal.
  expect(
    root.root.findAllByProps({
      accessibilityLabel: 'Delete goal Journal every evening',
    }),
  ).toHaveLength(0);
});

test('edit mode on an archived goal offers confirmed Delete beside Unarchive', async () => {
  const onDelete = jest.fn();
  const alertSpy = jest
    .spyOn(Alert, 'alert')
    .mockImplementation((_title, _message, buttons) => {
      buttons?.find(button => button.text === 'Delete')?.onPress?.();
    });
  let root!: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(async () => {
    root = renderSheet({
      mode: 'edit',
      goal: makeGoal({ status: 'archived' }),
      onDelete,
    });
  });

  expect(
    root.root.findAllByProps({
      accessibilityLabel: 'Unarchive goal Journal every evening',
    }).length,
  ).toBeGreaterThan(0);
  const deleteButton = root.root.findByProps({
    accessibilityLabel: 'Delete goal Journal every evening',
  });

  await ReactTestRenderer.act(async () => {
    deleteButton.props.onPress();
  });

  expect(alertSpy).toHaveBeenCalledWith(
    'Delete goal?',
    'This archived goal will be permanently removed.',
    expect.any(Array),
  );
  expect(onDelete).toHaveBeenCalledWith(
    expect.objectContaining({ id: 'g1', status: 'archived' }),
  );
  expect(
    root.root.findAllByProps({
      accessibilityLabel: 'Archive goal Journal every evening',
    }),
  ).toHaveLength(0);

  alertSpy.mockRestore();
});

test('automatic mode follows the title and can be restored after a fixed choice', async () => {
  const onSubmit = jest.fn();
  let root!: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(async () => {
    root = renderSheet({ onSubmit });
  });

  const input = root.root.findAllByType(require('react-native').TextInput)[0];

  await ReactTestRenderer.act(async () => {
    input.props.onChangeText('Walk outside');
  });
  expect(
    root.root.findByProps({ accessibilityLabel: 'Selected goal icon walk' }),
  ).toBeTruthy();

  await ReactTestRenderer.act(async () => {
    root.root
      .findByProps({ accessibilityLabel: 'Goal icon gym' })
      .props.onPress();
    root.root
      .findByProps({ accessibilityLabel: 'Use automatic goal icon' })
      .props.onPress();
  });

  await ReactTestRenderer.act(async () => {
    root.root.findByProps({ accessibilityLabel: 'Add goal' }).props.onPress();
  });

  expect(onSubmit).toHaveBeenCalledWith(
    expect.objectContaining({ icon: 'walk', iconSource: 'automatic' }),
  );
});

test('edit mode seeds the sheet from the goal it was opened with', async () => {
  let root!: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(async () => {
    root = renderSheet({
      mode: 'edit',
      goal: makeGoal({ reminderEnabled: true, reminderTime: '21:00' }),
    });
  });

  const tree = JSON.stringify(root.toJSON());

  expect(tree).toContain('Edit goal');
  expect(tree).toContain('Journal every evening');
  expect(tree).toContain('One honest line.');
  expect(tree).toContain('9:00 PM');
});
