/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {
  BACK_SWIPE_SCREEN_OPTIONS,
  getGuidedEntryMindMapParams,
  NewEntryRoute,
  TabFrame,
} from '../src/screens/main/MainAppShell';
import { resetAppStore, useAppStore } from '../src/store/appStore';

const mockNewEntryScreen = jest.fn((_props: unknown) => null);
const mockNewEntryChoiceSheet = jest.fn((_props: unknown) => null);
const mockNavigation = {
  navigate: jest.fn(),
  replace: jest.fn(),
};

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => mockNavigation,
}));

jest.mock('../src/components/NewEntryChoiceSheet', () => ({
  __esModule: true,
  default: (props: unknown) => mockNewEntryChoiceSheet(props),
}));

jest.mock('../src/components/BottomNav', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../src/screens/NewEntryScreen', () => ({
  __esModule: true,
  default: (props: unknown) => mockNewEntryScreen(props),
}));

beforeEach(() => {
  ReactTestRenderer.act(() => {
    resetAppStore();
  });
  mockNewEntryScreen.mockClear();
  mockNewEntryChoiceSheet.mockClear();
  mockNavigation.navigate.mockClear();
  mockNavigation.replace.mockClear();
});

test('enables swipe-back behavior on pushed main app screens', () => {
  expect(BACK_SWIPE_SCREEN_OPTIONS).toMatchObject({
    gestureEnabled: true,
    animation: 'slide_from_right',
    animationMatchesGesture: true,
  });
});

test('uses the app-store close flow when backing out of New Entry', () => {
  const closeNewEntry = jest.fn();

  useAppStore.setState({
    closeNewEntry,
    pendingNewEntryPrompt: 'Reflect on what felt heavy today.',
  });

  ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<NewEntryRoute />);
  });

  expect(mockNewEntryScreen).toHaveBeenCalledWith(
    expect.objectContaining({
      initialPrompt: 'Reflect on what felt heavy today.',
      onBack: closeNewEntry,
    }),
  );
});

test('routes a completed guided goals session to its saved entry Mind Map', () => {
  expect(
    getGuidedEntryMindMapParams({
      answers: {
        good_exciting: 'A focused morning.',
        hurdle: 'I avoided one difficult task.',
        carry_tomorrow: 'Start with the difficult task.',
      },
      aiSummary: 'The avoided task remains the clearest friction point.',
      draft: { version: 2 },
      journalId: 'guided-journal-1',
      goalSuggestions: [],
      sessionAnalysis: {} as never,
      threadMessages: [],
    }),
  ).toEqual({
    journalId: 'guided-journal-1',
    sessionAnalysis: {},
  });
  expect(getGuidedEntryMindMapParams(null)).toBeNull();
});

test('opens the Guided paywall only after the choice sheet has dismissed', () => {
  const openPaywallForPlacement = jest.fn();
  let root!: ReactTestRenderer.ReactTestRenderer;

  useAppStore.setState({
    isNewEntryChoiceVisible: true,
    openPaywallForPlacement,
    session: {
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      user: {
        userId: 'user-123',
        name: 'Alex',
        phoneNumber: null,
        email: 'alex@example.com',
        isPremium: false,
        journalingGoals: [],
        avatarColor: '#8E4636',
        profileSetupCompleted: true,
        onboardingCompleted: true,
        profilePic: null,
      },
    },
  });

  ReactTestRenderer.act(() => {
    root = ReactTestRenderer.create(
      <TabFrame activeKey="home">
        <></>
      </TabFrame>,
    );
  });

  const choiceProps = mockNewEntryChoiceSheet.mock.calls.at(-1)?.[0] as {
    onDismissComplete: () => void;
    onGuidedLockedPress: () => void;
  };

  ReactTestRenderer.act(() => {
    choiceProps.onGuidedLockedPress();
  });

  expect(useAppStore.getState().isNewEntryChoiceVisible).toBe(false);
  expect(openPaywallForPlacement).not.toHaveBeenCalled();

  ReactTestRenderer.act(() => {
    choiceProps.onDismissComplete();
    choiceProps.onDismissComplete();
  });

  expect(openPaywallForPlacement).toHaveBeenCalledTimes(1);
  expect(openPaywallForPlacement).toHaveBeenCalledWith({
    placementKey: 'new_entry_guided_locked',
    returnStage: 'main-app',
    screenKey: 'new_entry_choice',
  });

  ReactTestRenderer.act(() => root.unmount());
});
