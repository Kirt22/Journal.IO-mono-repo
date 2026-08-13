import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { StyleSheet } from 'react-native';
import { Heart } from 'lucide-react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import WidgetsScreen from '../src/screens/profile/WidgetsScreen';
import {
  getWidgetManagementState,
  setWidgetEnabled,
} from '../src/services/widgetService';
import { useAppStore } from '../src/store/appStore';

jest.mock('../src/services/widgetService', () => ({
  getWidgetManagementState: jest.fn(),
  setWidgetEnabled: jest.fn(),
}));

jest.mock('../src/services/hapticsService', () => ({
  triggerHaptic: jest.fn(async () => undefined),
}));

const safeAreaMetrics = {
  frame: {
    x: 0,
    y: 0,
    width: 390,
    height: 844,
  },
  insets: {
    top: 47,
    bottom: 34,
    left: 0,
    right: 0,
  },
};

const emptyWidgetStatus = {
  expiresAt: null,
  isAvailable: true,
  installedKinds: [],
  hasConfiguredSession: false,
  isInitialized: false,
  enabledKinds: [],
  hasPremiumAccess: false,
  updatedAt: null,
};

const activeStreakStatus = {
  ...emptyWidgetStatus,
  isInitialized: true,
  enabledKinds: ['JournalStreakWidget'],
  installedKinds: ['JournalStreakWidget'],
};

function extractText(node: unknown): string {
  if (node == null) {
    return '';
  }

  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(child => extractText(child)).join('');
  }

  if (typeof node === 'object' && 'children' in node) {
    return extractText((node as { children?: unknown }).children);
  }

  return '';
}

function setSession(isPremium = false) {
  useAppStore.setState({
    session: {
      accessToken: 'test-access',
      refreshToken: 'test-refresh',
      user: {
        userId: 'user-test',
        name: 'Journal User',
        phoneNumber: null,
        email: 'journal@example.com',
        isPremium,
        journalingGoals: [],
        avatarColor: null,
        profileSetupCompleted: true,
        onboardingCompleted: true,
        profilePic: null,
      },
    },
  });
}

async function renderWidgetsScreen({
  isPremium = false,
  onOpenPremium = jest.fn(),
}: {
  isPremium?: boolean;
  onOpenPremium?: jest.Mock;
} = {}) {
  let root!: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(async () => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <WidgetsScreen
          isPremium={isPremium}
          onBack={jest.fn()}
          onOpenPremium={onOpenPremium}
        />
      </SafeAreaProvider>,
    );
    await Promise.resolve();
  });

  return root;
}

beforeEach(() => {
  jest.clearAllMocks();
  setSession(false);
  (getWidgetManagementState as jest.Mock).mockResolvedValue(emptyWidgetStatus);
  (setWidgetEnabled as jest.Mock).mockResolvedValue('enabled');
});

test('shows equal native-style previews with concise management copy', async () => {
  const root = await renderWidgetsScreen();
  const renderedText = extractText(root.toJSON());
  const previews = root.root.findAll(
    node =>
      typeof node.props.testID === 'string' &&
      node.props.testID.startsWith('widget-preview-'),
  );
  const previewIds = Array.from(
    new Set(previews.map(preview => preview.props.testID)),
  );

  expect(renderedText).toContain('Active widgets');
  expect(renderedText).toContain('Swipe left to remove.');
  expect(renderedText).toContain('No active widgets');
  expect(renderedText).not.toContain('Press and hold below to add.');
  expect(renderedText).toContain('All widgets');
  expect(renderedText).toContain('Press and hold to add.');
  expect(renderedText).toContain('30-Day Activity');
  expect(renderedText).toContain('How are you feeling?');
  expect(renderedText).toContain('Quick thought');
  expect(renderedText).toContain('How to add a widget');
  expect(renderedText).not.toContain('See your streak, best run');
  expect(renderedText).not.toContain('Add to your Home Screen');
  expect(
    StyleSheet.flatten(
      root.root.findByProps({ testID: 'empty-active-widgets-title' }).props
        .style,
    ).textAlign,
  ).toBe('center');
  expect(previewIds).toEqual([
    'widget-preview-JournalStreakWidget',
    'widget-preview-JournalMoodWidget',
    'widget-preview-JournalQuickThoughtWidget',
  ]);
  previewIds.forEach(testID => {
    const preview = previews.find(node => node.props.testID === testID);
    expect(StyleSheet.flatten(preview?.props.style)).toMatchObject({
      aspectRatio: 2.08,
      backgroundColor: '#FFFFFF',
      borderWidth: 1.5,
      elevation: 4,
    });
  });
  expect(root.root.findAllByType(Heart)).toHaveLength(0);
  const activityCell = root.root.findAllByProps({
    testID: 'streak-activity-cell-0',
  })[0];
  expect(StyleSheet.flatten(activityCell.props.style)).toMatchObject({
    height: 12,
    width: 12,
  });
  expect(
    StyleSheet.flatten(
      root.root.findByProps({ testID: 'streak-activity-grid' }).props.style,
    ),
  ).toMatchObject({
    gap: 3,
    width: 147,
  });
  expect(root.root.findByProps({ testID: 'how-to-widget-icon' })).toBeTruthy();
});

test('long-pressing an available widget activates it and hides it from the catalog', async () => {
  (getWidgetManagementState as jest.Mock)
    .mockResolvedValueOnce(emptyWidgetStatus)
    .mockResolvedValueOnce(activeStreakStatus);

  const root = await renderWidgetsScreen();

  await ReactTestRenderer.act(async () => {
    root.root
      .findByProps({ accessibilityLabel: 'Streak, available widget' })
      .props.onLongPress();
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(setWidgetEnabled).toHaveBeenCalledWith({
    kind: 'JournalStreakWidget',
    enabled: true,
    userId: 'user-test',
    hasPremiumAccess: false,
  });
  expect(
    root.root.findByProps({
      accessibilityLabel: 'Streak, active widget, Small + Medium',
    }),
  ).toBeTruthy();
  expect(
    root.root.findAllByProps({
      accessibilityLabel: 'Streak, available widget',
    }),
  ).toHaveLength(0);
});

test('an active widget exposes Remove and returns to the catalog after removal', async () => {
  (getWidgetManagementState as jest.Mock)
    .mockResolvedValueOnce(activeStreakStatus)
    .mockResolvedValueOnce(emptyWidgetStatus);
  (setWidgetEnabled as jest.Mock).mockResolvedValue('disabled');

  const root = await renderWidgetsScreen();
  const activeRow = root.root.findByProps({
    accessibilityLabel: 'Streak, active widget, Small + Medium',
  });

  expect(
    root.root.findByProps({
      accessibilityLabel: 'Remove Streak widget',
    }),
  ).toBeTruthy();

  await ReactTestRenderer.act(async () => {
    activeRow.props.onAccessibilityAction({
      nativeEvent: { actionName: 'delete' },
    });
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(setWidgetEnabled).toHaveBeenCalledWith({
    kind: 'JournalStreakWidget',
    enabled: false,
    userId: 'user-test',
    hasPremiumAccess: false,
  });
  expect(
    root.root.findAllByProps({
      accessibilityLabel: 'Streak, active widget, Small + Medium',
    }),
  ).toHaveLength(0);
  expect(
    root.root.findByProps({
      accessibilityLabel: 'Streak, available widget',
    }),
  ).toBeTruthy();
});

test('an unexpected activation failure clears the busy state and stays recoverable', async () => {
  (setWidgetEnabled as jest.Mock).mockRejectedValue(
    new Error('Unexpected native bridge failure'),
  );

  const root = await renderWidgetsScreen();

  await ReactTestRenderer.act(async () => {
    root.root
      .findByProps({ accessibilityLabel: 'Streak, available widget' })
      .props.onLongPress();
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(extractText(root.toJSON())).toContain(
    'The widget was selected, but its connection could not be finished.',
  );
  expect(
    root.root.findByProps({
      accessibilityLabel: 'Streak, available widget',
    }).props.accessibilityState,
  ).toEqual({ busy: false, disabled: false });
});

test('locked Premium widgets open the paywall without activating', async () => {
  const onOpenPremium = jest.fn();
  const root = await renderWidgetsScreen({ onOpenPremium });
  const renderedText = extractText(root.toJSON());
  const lockedPreview = root.root.findByProps({
    testID: 'locked-widget-preview-JournalMoodWidget',
  });

  expect(StyleSheet.flatten(lockedPreview.props.style).filter).toEqual([
    { blur: 12 },
  ]);
  expect(StyleSheet.flatten(lockedPreview.props.style).opacity).toBe(0.42);
  expect(
    root.root.findByProps({
      testID: 'premium-lock-icon-JournalMoodWidget',
    }),
  ).toBeTruthy();
  expect(renderedText).toContain('Purchase Premium to unlock');
  expect(renderedText).not.toContain('Premium required');

  ReactTestRenderer.act(() => {
    root.root
      .findByProps({
        accessibilityLabel: 'Mood Check-in, Premium widget',
      })
      .props.onLongPress();
  });

  expect(onOpenPremium).toHaveBeenCalledTimes(1);
  expect(setWidgetEnabled).not.toHaveBeenCalled();
});

test('Premium widgets become unblurred and can be activated', async () => {
  setSession(true);
  const activeMoodStatus = {
    ...emptyWidgetStatus,
    isInitialized: true,
    enabledKinds: ['JournalMoodWidget'],
    hasPremiumAccess: true,
  };
  (getWidgetManagementState as jest.Mock)
    .mockResolvedValueOnce({
      ...emptyWidgetStatus,
      hasPremiumAccess: true,
    })
    .mockResolvedValueOnce(activeMoodStatus);

  const root = await renderWidgetsScreen({ isPremium: true });

  expect(
    root.root.findAllByProps({
      testID: 'locked-widget-preview-JournalMoodWidget',
    }),
  ).toHaveLength(0);

  await ReactTestRenderer.act(async () => {
    root.root
      .findByProps({
        accessibilityLabel: 'Mood Check-in, available widget',
      })
      .props.onLongPress();
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(setWidgetEnabled).toHaveBeenCalledWith({
    kind: 'JournalMoodWidget',
    enabled: true,
    userId: 'user-test',
    hasPremiumAccess: true,
  });
  expect(
    root.root.findByProps({
      accessibilityLabel: 'Mood Check-in, active widget, Medium',
    }),
  ).toBeTruthy();
});

test('opens the Home Screen widget walkthrough', async () => {
  const root = await renderWidgetsScreen();

  ReactTestRenderer.act(() => {
    root.root
      .findByProps({ accessibilityLabel: 'How to add a widget' })
      .props.onPress();
  });

  const renderedText = extractText(root.toJSON());
  expect(renderedText).toContain('Add a widget');
  // The written steps were replaced by the recording; they only survive as the
  // codec/VoiceOver fallback inside AddWidgetDemoPhone.
  expect(renderedText).not.toContain(
    'Touch and hold an empty area on your Home Screen.',
  );
  expect(root.root.findAllByProps({ testID: 'add-widget-demo-video' }).length)
    .toBeGreaterThanOrEqual(1);
  expect(renderedText).toContain(
    'iOS lists every Journal.IO widget type. Only active widgets show your data.',
  );
  expect(
    root.root.findAllByProps({
      accessibilityLabel: 'Close widget instructions',
    }).length,
  ).toBeGreaterThanOrEqual(2);
});
