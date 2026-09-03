/**
 * @format
 */

import {
  isOnboardingResumePoint,
  resolveOnboardingResumePoint,
} from '../src/utils/onboardingResume';
import type { OnboardingV2Draft } from '../src/types/onboarding';

const draft: OnboardingV2Draft = {
  version: 2,
  whatBringsYouHere: ['clarity'],
  supportFocusAreas: ['stress'],
  reflectionTone: ['direct'],
  privacyConsent: true,
  displayName: 'Alex',
};

describe('resolveOnboardingResumePoint', () => {
  it('checkpoints the AI-driven middle of the journey back to the reflection', () => {
    // FirstReflectionMindMap and friends are re-entered with analysis payloads
    // that only ever existed in memory, so they cannot be resumed directly.
    expect(
      resolveOnboardingResumePoint(
        'FirstReflectionMindMap',
        { draft },
        'user-1',
      ),
    ).toEqual({
      routeName: 'FirstGuidedReflection',
      userId: 'user-1',
      draft,
    });
  });

  it('resumes the closing steps exactly where they were', () => {
    expect(
      resolveOnboardingResumePoint(
        'OnboardingCommitment',
        { displayName: 'Alex', draft },
        'user-1',
      ),
    ).toEqual({
      routeName: 'OnboardingCommitment',
      userId: 'user-1',
      displayName: 'Alex',
      draft,
    });
  });

  it('folds the widget confirmation back onto the setup step', () => {
    expect(
      resolveOnboardingResumePoint(
        'OnboardingWidgetActivated',
        { draft, didEnableWidget: true },
        'user-1',
      )?.routeName,
    ).toBe('OnboardingWidgetSetup');
  });

  it('has nothing to resume outside the journey, without a draft, or without a user', () => {
    expect(resolveOnboardingResumePoint('MainApp', { draft }, 'user-1')).toBeNull();
    // The questionnaire writes nothing anywhere, so a clean restart loses nothing.
    expect(resolveOnboardingResumePoint('Onboarding', undefined, 'user-1')).toBeNull();
    expect(
      resolveOnboardingResumePoint('OnboardingReminders', {}, 'user-1'),
    ).toBeNull();
    expect(
      resolveOnboardingResumePoint('OnboardingReminders', { draft }, null),
    ).toBeNull();
  });
});

describe('isOnboardingResumePoint', () => {
  it('accepts what resolve produced', () => {
    expect(
      isOnboardingResumePoint(
        resolveOnboardingResumePoint('OnboardingTrialIntro', { draft }, 'user-1'),
      ),
    ).toBe(true);
  });

  it('rejects anything a corrupted or stale keychain entry could hold', () => {
    expect(isOnboardingResumePoint(null)).toBe(false);
    expect(isOnboardingResumePoint({ routeName: 'MainApp', userId: 'u', draft })).toBe(
      false,
    );
    // A checkpoint we cannot re-enter is not a resume point.
    expect(
      isOnboardingResumePoint({
        routeName: 'FirstReflectionMindMap',
        userId: 'u',
        draft,
      }),
    ).toBe(false);
    expect(
      isOnboardingResumePoint({ routeName: 'OnboardingReminders', draft }),
    ).toBe(false);
    expect(
      isOnboardingResumePoint({
        routeName: 'OnboardingReminders',
        userId: 'u',
        draft: { version: 1 },
      }),
    ).toBe(false);
  });
});
