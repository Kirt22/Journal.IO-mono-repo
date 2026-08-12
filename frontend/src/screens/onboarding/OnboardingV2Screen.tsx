import HapticPressable from '../../components/HapticPressable';
import {
  useEffect,
  useMemo,
  useRef,
  useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Alert,
  Animated,
  Easing,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TouchableWithoutFeedback,
  useWindowDimensions,
  View,
  type GestureResponderEvent,
  type ImageSourcePropType,
} from 'react-native';
import {
  Text,
  TextInput,
} from '../../infrastructure/reactNative';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import OnboardingBottomSheet from '../../components/OnboardingBottomSheet';
import OnboardingHero from '../../components/OnboardingHero';
import OnboardingOptionCard from '../../components/OnboardingOptionCard';
import OnboardingProgressDots from '../../components/OnboardingProgressDots';
import ThemePreviewCard from '../../components/ThemePreviewCard';
import WavingHandIcon from '../../components/WavingHandIcon';
import {
  ENABLE_ONBOARDING_DEV_SHORTCUTS,
  REQUIRE_ONBOARDING_V2_PRIVACY_CONSENT,
} from '../../config/onboarding';
import { buildDevFirstReflectionStreakPayload } from './devOnboardingFixtures';
import { useOnboardingV2State } from '../../hooks/useOnboardingV2State';
import { triggerHaptic } from '../../services/hapticsService';
import { useAppStore } from '../../store/appStore';
import { useTheme, useThemeTransition } from '../../theme/provider';
import type { ThemePreference } from '../../theme/theme';
import type { RootStackParamList } from '../../navigation/navigation';
import { LEGAL_URLS, openExternalUrl } from '../../utils/legalLinks';
import {
  AGE_RANGE_OPTIONS,
  PRIMARY_CONTEXT_OPTIONS,
  READY_FEATURE_CARDS,
  REFERRAL_SOURCE_OPTIONS,
  REFLECTION_TONE_OPTIONS,
  SUPPORT_FOCUS_OPTIONS,
  THEME_OPTIONS,
  getOnboardingThemeDefault,
  type OnboardingV2Option,
} from './onboardingV2.constants';

type OnboardingV2Step =
  | 'intro'
  | 'name'
  | 'referral'
  | 'age'
  | 'occupation'
  | 'tone'
  | 'support'
  | 'theme'
  | 'ready';

type AutoAdvanceKey =
  | 'referralSource'
  | 'ageRange'
  | 'primaryContext'
  | 'reflectionTone'
  | 'supportFocusAreas'
  | 'preferredTheme';

const steps: OnboardingV2Step[] = [
  'intro',
  'name',
  'referral',
  'age',
  'occupation',
  'tone',
  'support',
  'theme',
  'ready',
];

const AUTO_ADVANCE_DELAY_MS = 360;
const MAX_REVEAL_CARD_COUNT = 8;
const READY_CARD_INITIAL_DELAY_MS = 620;
const READY_CARD_STAGGER_MS = 430;
const READY_CARD_DURATION_MS = 760;
const FIRST_REFLECTION_START_DELAY_MS = 2500;
const BOTTOM_SHEET_CLOSE_DURATION_MS = 230;

const disclaimerPoints = [
  'AI can ask thoughtful questions and help you notice patterns.',
  'Your entries are private to you and can be deleted anytime.',
  'Journal.IO supports reflection, but does not diagnose or replace professional care.',
];

const readyCelebrationIcon = require('../../assets/png/onboarding/ready-congratulations.png');
const readyFeatureIcons = [
  require('../../assets/png/onboarding/ready-question.png'),
  require('../../assets/png/onboarding/ready-privacy.png'),
  require('../../assets/png/onboarding/ready-growth.png'),
] satisfies ImageSourcePropType[];

const hexToRgba = (hex: string, alpha: number) => {
  const normalized = hex.replace('#', '');

  if (normalized.length !== 6) {
    return hex;
  }

  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};

const getRevealCardCount = (step: OnboardingV2Step) => {
  switch (step) {
    case 'referral':
      return REFERRAL_SOURCE_OPTIONS.length;
    case 'age':
      return AGE_RANGE_OPTIONS.length;
    case 'occupation':
      return PRIMARY_CONTEXT_OPTIONS.length;
    case 'tone':
      return REFLECTION_TONE_OPTIONS.length;
    case 'support':
      return SUPPORT_FOCUS_OPTIONS.length;
    case 'theme':
      return THEME_OPTIONS.length;
    default:
      return 0;
  }
};

const getFirstName = (name?: string | null) => {
  const trimmedName = name?.trim();

  if (!trimmedName) {
    return __DEV__ ? 'Dev' : null;
  }

  return trimmedName.split(/\s+/)[0];
};

const referralAssetById = {
  app_store: require('../../assets/png/onboarding/referral-app-store.png'),
  friend_family: require('../../assets/png/onboarding/referral-friend-family.png'),
  instagram: require('../../assets/png/onboarding/referral-instagram.png'),
  other: require('../../assets/png/onboarding/referral-other.png'),
  reddit_community: require('../../assets/png/onboarding/referral-reddit.png'),
  tiktok: require('../../assets/png/onboarding/referral-tiktok.png'),
  x_twitter: require('../../assets/png/onboarding/referral-x.png'),
} satisfies Record<string, ImageSourcePropType>;

type ReferralAssetId = keyof typeof referralAssetById;

const hasReferralAsset = (id: string): id is ReferralAssetId =>
  id in referralAssetById;

const occupationAssetById = {
  creative_work: require('../../assets/png/onboarding/occupation-creative-work.png'),
  founder_builder: require('../../assets/png/onboarding/occupation-founder-builder.png'),
  looking_for_work: require('../../assets/png/onboarding/occupation-looking-for-work.png'),
  other_prefer_not: require('../../assets/png/onboarding/occupation-other.png'),
  student: require('../../assets/png/onboarding/occupation-student.png'),
  working_professional: require('../../assets/png/onboarding/occupation-working-professional.png'),
} satisfies Record<string, ImageSourcePropType>;

type OccupationAssetId = keyof typeof occupationAssetById;

const hasOccupationAsset = (id: string): id is OccupationAssetId =>
  id in occupationAssetById;

const toneAssetById = {
  deep: require('../../assets/png/onboarding/tone-deep.png'),
  direct: require('../../assets/png/onboarding/tone-direct.png'),
  gentle: require('../../assets/png/onboarding/tone-gentle.png'),
  motivating: require('../../assets/png/onboarding/tone-motivating.png'),
  neutral: require('../../assets/png/onboarding/tone-neutral.png'),
} satisfies Record<string, ImageSourcePropType>;

type ToneAssetId = keyof typeof toneAssetById;

const hasToneAsset = (id: string): id is ToneAssetId => id in toneAssetById;

const supportAssetById = {
  anger: require('../../assets/png/onboarding/support-anger.png'),
  focus: require('../../assets/png/onboarding/support-focus.png'),
  loneliness: require('../../assets/png/onboarding/support-loneliness.png'),
  low_mood: require('../../assets/png/onboarding/support-low-mood.png'),
  overthinking: require('../../assets/png/onboarding/support-overthinking.png'),
  stress: require('../../assets/png/onboarding/support-stress.png'),
} satisfies Record<string, ImageSourcePropType>;

type SupportAssetId = keyof typeof supportAssetById;

const hasSupportAsset = (id: string): id is SupportAssetId =>
  id in supportAssetById;

export default function OnboardingV2Screen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const theme = useTheme();
  const startThemeTransition = useThemeTransition();
  const { width } = useWindowDimensions();
  const sessionName = useAppStore(state => state.session?.user.name);
  const setThemeModeOverride = useAppStore(state => state.setThemeModeOverride);
  const { draft, setDraftArraySingleValue, setDraftValue } =
    useOnboardingV2State();
  const [stepIndex, setStepIndex] = useState(0);
  const [isDisclaimerVisible, setIsDisclaimerVisible] = useState(false);
  const [isStartingFirstReflection, setIsStartingFirstReflection] =
    useState(false);
  const [isAutoAdvancing, setIsAutoAdvancing] = useState(false);
  const [isReadyCtaEnabled, setIsReadyCtaEnabled] = useState(false);
  const [otherReferralInput, setOtherReferralInput] = useState('');
  const [displayNameError, setDisplayNameError] = useState<string | null>(null);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const autoAdvanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const firstReflectionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const displayNameInputRef = useRef<TextInput>(null);
  const featureRevealValues = useRef(
    READY_FEATURE_CARDS.map(() => new Animated.Value(0)),
  ).current;
  const cardRevealValues = useRef(
    Array.from({ length: MAX_REVEAL_CARD_COUNT }, () => new Animated.Value(0)),
  ).current;
  const screenOpacity = useRef(new Animated.Value(1)).current;
  const screenTranslateY = useRef(new Animated.Value(0)).current;
  const otherReferralReveal = useRef(new Animated.Value(0)).current;
  const ageEyebrowPop = useRef(new Animated.Value(0)).current;
  const supportContinueReveal = useRef(new Animated.Value(0)).current;
  const readyIconShake = useRef(new Animated.Value(0)).current;
  const readyButtonReveal = useRef(new Animated.Value(0)).current;
  const readyButtonPulse = useRef(new Animated.Value(0)).current;
  const previousSupportSelectionCountRef = useRef(0);
  const hasPlayedInitialTransitionRef = useRef(false);
  const hasPrefilledDisplayNameRef = useRef(false);
  const navigationDirectionRef = useRef<'forward' | 'back'>('forward');
  const step = steps[stepIndex];
  const displayName = draft.displayName ?? sessionName ?? '';
  const firstName = getFirstName(draft.displayName || sessionName);
  const isCompact = width < 360;
  const contentMaxWidth = Math.min(width - (isCompact ? 24 : 32), 410);
  const showBack = stepIndex > 0;
  const displayNameInputStyle = useMemo(
    () => ({
      backgroundColor: 'transparent',
      borderColor: displayNameError
        ? theme.colors.destructive
        : 'transparent',
      color: theme.colors.foreground,
    }),
    [displayNameError, theme.colors.destructive, theme.colors.foreground],
  );
  const selectedTheme = useMemo(
    () => THEME_OPTIONS.find(item => item.id === draft.preferredTheme),
    [draft.preferredTheme],
  );
  const supportSelections = draft.supportFocusAreas || [];
  const isOtherReferralSelected = draft.referralSource === 'other';
  const accentColor =
    step === 'theme' && selectedTheme
      ? selectedTheme.primaryColor
      : theme.colors.primary;
  const progressTotal = steps.length;
  const progressIndex = Math.min(stepIndex, progressTotal - 1);

  useEffect(() => {
    if (hasPrefilledDisplayNameRef.current) {
      return;
    }

    hasPrefilledDisplayNameRef.current = true;
    if (!draft.displayName && sessionName?.trim()) {
      setDraftValue('displayName', sessionName.trim().slice(0, 60));
    }
  }, [draft.displayName, sessionName, setDraftValue]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSubscription = Keyboard.addListener(showEvent, () =>
      setIsKeyboardVisible(true),
    );
    const hideSubscription = Keyboard.addListener(hideEvent, () =>
      setIsKeyboardVisible(false),
    );

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  useEffect(() => {
    if (step !== 'theme' || draft.preferredTheme) {
      return;
    }

    const themeDefault = getOnboardingThemeDefault(theme.mode);

    // Match the active app appearance; later visits retain the user's choice.
    setDraftValue('preferredTheme', themeDefault);
    setThemeModeOverride(themeDefault);
  }, [
    draft.preferredTheme,
    setDraftValue,
    setThemeModeOverride,
    step,
    theme.mode,
  ]);

  useEffect(() => {
    if (!hasPlayedInitialTransitionRef.current) {
      hasPlayedInitialTransitionRef.current = true;
    }

    screenOpacity.setValue(0);
    screenTranslateY.setValue(18);
    Animated.parallel([
      Animated.timing(screenOpacity, {
        toValue: 1,
        duration: 520,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(screenTranslateY, {
        toValue: 0,
        duration: 520,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [screenOpacity, screenTranslateY, step]);

  useEffect(() => {
    if (step !== 'ready') {
      featureRevealValues.forEach(value => value.setValue(0));
      readyButtonReveal.setValue(0);
      readyButtonPulse.setValue(0);
      setIsReadyCtaEnabled(false);
      return;
    }

    featureRevealValues.forEach(value => value.setValue(0));
    readyIconShake.setValue(0);
    readyButtonReveal.setValue(0);
    readyButtonPulse.setValue(0);
    setIsReadyCtaEnabled(false);

    const iconAnimation = Animated.sequence([
      Animated.delay(170),
      Animated.timing(readyIconShake, {
        toValue: 1,
        duration: 110,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(readyIconShake, {
        toValue: 2,
        duration: 120,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(readyIconShake, {
        toValue: 3,
        duration: 140,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);
    const cardAnimation = Animated.sequence([
      Animated.delay(READY_CARD_INITIAL_DELAY_MS),
      Animated.stagger(
        READY_CARD_STAGGER_MS,
        featureRevealValues.map(value =>
          Animated.timing(value, {
            toValue: 1,
            duration: READY_CARD_DURATION_MS,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ),
      ),
    ]);
    const introAnimation = Animated.parallel([iconAnimation, cardAnimation]);
    const buttonDelay =
      READY_CARD_INITIAL_DELAY_MS +
      (READY_FEATURE_CARDS.length - 1) * READY_CARD_STAGGER_MS +
      READY_CARD_DURATION_MS +
      150;
    const buttonAnimation = Animated.sequence([
      Animated.delay(buttonDelay),
      Animated.spring(readyButtonReveal, {
        toValue: 1,
        damping: 17,
        stiffness: 145,
        mass: 0.9,
        useNativeDriver: true,
      }),
    ]);
    let pulseAnimation: Animated.CompositeAnimation | null = null;

    introAnimation.start();
    buttonAnimation.start(({ finished }) => {
      if (!finished) {
        return;
      }

      setIsReadyCtaEnabled(true);
      pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(readyButtonPulse, {
            toValue: 1,
            duration: 950,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(readyButtonPulse, {
            toValue: 0,
            duration: 950,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.delay(420),
        ]),
      );
      pulseAnimation.start();
    });

    return () => {
      introAnimation.stop();
      buttonAnimation.stop();
      pulseAnimation?.stop();
    };
  }, [
    featureRevealValues,
    readyButtonPulse,
    readyButtonReveal,
    readyIconShake,
    step,
  ]);

  useEffect(() => {
    const revealCount = getRevealCardCount(step);

    if (navigationDirectionRef.current === 'back') {
      cardRevealValues.forEach(value => value.setValue(1));
      return undefined;
    }

    cardRevealValues.forEach(value => value.setValue(0));

    if (!revealCount) {
      return undefined;
    }

    const animation = Animated.sequence([
      Animated.delay(130),
      Animated.stagger(
        54,
        cardRevealValues.slice(0, revealCount).map(value =>
          Animated.timing(value, {
            toValue: 1,
            duration: 360,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ),
      ),
    ]);

    animation.start();

    return () => {
      animation.stop();
    };
  }, [cardRevealValues, step]);

  useEffect(() => {
    const previousCount = previousSupportSelectionCountRef.current;
    const nextCount = supportSelections.length;

    previousSupportSelectionCountRef.current = nextCount;

    if (step !== 'support' || !nextCount) {
      supportContinueReveal.setValue(0);
      return;
    }

    if (previousCount > 0) {
      supportContinueReveal.setValue(1);
      return;
    }

    supportContinueReveal.setValue(0);
    const animation = Animated.spring(supportContinueReveal, {
      toValue: 1,
      damping: 16,
      stiffness: 220,
      mass: 0.85,
      useNativeDriver: true,
    });

    animation.start();

    return () => {
      animation.stop();
    };
  }, [step, supportContinueReveal, supportSelections.length]);

  useEffect(() => {
    if (!isOtherReferralSelected) {
      otherReferralReveal.setValue(0);
      return;
    }

    otherReferralReveal.setValue(0);

    const animation = Animated.spring(otherReferralReveal, {
      toValue: 1,
      damping: 15,
      stiffness: 210,
      mass: 0.8,
      useNativeDriver: true,
    });

    animation.start();

    return () => {
      animation.stop();
    };
  }, [isOtherReferralSelected, otherReferralReveal]);

  useEffect(() => {
    if (step !== 'age') {
      ageEyebrowPop.setValue(0);
      return;
    }

    ageEyebrowPop.setValue(0);

    const animation = Animated.spring(ageEyebrowPop, {
      toValue: 1,
      damping: 18,
      stiffness: 70,
      mass: 1.2,
      useNativeDriver: true,
    });

    animation.start();

    return () => {
      animation.stop();
    };
  }, [ageEyebrowPop, step]);

  useEffect(
    () => () => {
      if (autoAdvanceTimerRef.current) {
        clearTimeout(autoAdvanceTimerRef.current);
      }
      if (firstReflectionTimerRef.current) {
        clearTimeout(firstReflectionTimerRef.current);
      }
    },
    [],
  );

  const clearAutoAdvanceTimer = () => {
    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }
    setIsAutoAdvancing(false);
  };

  const goToStep = (nextIndex: number) => {
    const direction = nextIndex < stepIndex ? 'back' : 'forward';

    Keyboard.dismiss();
    setIsKeyboardVisible(false);

    navigationDirectionRef.current = direction;
    if (direction === 'back') {
      cardRevealValues.forEach(value => value.setValue(1));
    } else {
      cardRevealValues.forEach(value => value.setValue(0));
    }

    setStepIndex(Math.min(Math.max(nextIndex, 0), steps.length - 1));
  };

  const goNext = () => {
    clearAutoAdvanceTimer();

    if (step === 'name') {
      const trimmedDisplayName = displayName.trim();

      if (!trimmedDisplayName) {
        setDisplayNameError('Please add the name you would like us to use.');
        return;
      }

      setDraftValue('displayName', trimmedDisplayName);
      setDisplayNameError(null);
    }

    triggerHaptic('primaryAction').catch(() => undefined);

    if (step === 'ready') {
      setIsDisclaimerVisible(true);
      return;
    }

    goToStep(stepIndex + 1);
  };

  const goBack = () => {
    clearAutoAdvanceTimer();
    triggerHaptic('back').catch(() => undefined);
    goToStep(stepIndex - 1);
  };

  const selectAndAdvance = (
    key: AutoAdvanceKey,
    value: string,
    event?: GestureResponderEvent,
  ) => {
    if (isAutoAdvancing) {
      return;
    }

    if (key === 'referralSource' && value === 'other') {
      setDraftValue('referralSource', value);
      triggerHaptic('optionSelected').catch(() => undefined);
      clearAutoAdvanceTimer();
      return;
    }

    if (key === 'reflectionTone') {
      setDraftArraySingleValue('reflectionTone', value);
    } else if (key === 'preferredTheme') {
      setDraftValue('preferredTheme', value);
      cardRevealValues.forEach(revealValue => revealValue.setValue(1));
      startThemeTransition({
        originX: event?.nativeEvent.pageX,
        originY: event?.nativeEvent.pageY,
        nextModeOverride: value as ThemePreference,
        onCovered: () => setThemeModeOverride(value as ThemePreference),
      });
      triggerHaptic('themeSelected').catch(() => undefined);
      return;
    } else if (key === 'supportFocusAreas') {
      setDraftValue('primarySupportFocus', value);
      setDraftArraySingleValue('supportFocusAreas', value);
    } else {
      setDraftValue(key, value);
    }

    triggerHaptic('optionSelected').catch(() => undefined);
    setIsAutoAdvancing(true);

    autoAdvanceTimerRef.current = setTimeout(() => {
      setIsAutoAdvancing(false);
      goToStep(stepIndex + 1);
      autoAdvanceTimerRef.current = null;
    }, AUTO_ADVANCE_DELAY_MS);
  };

  const toggleSupportSelection = (value: string) => {
    if (isAutoAdvancing) {
      return;
    }

    const nextSelections = supportSelections.includes(value)
      ? supportSelections.filter(item => item !== value)
      : [...supportSelections, value];

    setDraftValue('supportFocusAreas', nextSelections);
    setDraftValue('primarySupportFocus', nextSelections[0]);
    triggerHaptic('optionSelected').catch(() => undefined);
  };

  const continueFromSupport = () => {
    if (!supportSelections.length) {
      return;
    }

    triggerHaptic('primaryAction').catch(() => undefined);
    goToStep(stepIndex + 1);
  };

  const continueFromTheme = () => {
    triggerHaptic('primaryAction').catch(() => undefined);
    goToStep(stepIndex + 1);
  };

  const skipCurrentStep = () => {
    triggerHaptic('secondaryAction').catch(() => undefined);
    goToStep(stepIndex + 1);
  };

  const openLegalDocument = (url: string, title: string) => {
    openExternalUrl(url, title).catch(error => {
      Alert.alert(
        title,
        error instanceof Error ? error.message : 'Unable to open this link.',
      );
    });
  };

  const openLegalDocumentFromDisclaimer = (url: string, title: string) => {
    setIsDisclaimerVisible(false);
    setTimeout(() => {
      openLegalDocument(url, title);
    }, 260);
  };

  const continueFromDisclaimer = () => {
    if (
      isStartingFirstReflection ||
      (REQUIRE_ONBOARDING_V2_PRIVACY_CONSENT && !draft.privacyConsent)
    ) {
      return;
    }

    setIsStartingFirstReflection(true);

    firstReflectionTimerRef.current = setTimeout(() => {
      firstReflectionTimerRef.current = null;
      setIsDisclaimerVisible(false);

      setTimeout(() => {
        setIsStartingFirstReflection(false);
        navigation.navigate('FirstGuidedReflection', {
          draft,
        });
      }, BOTTOM_SHEET_CLOSE_DURATION_MS);
    }, FIRST_REFLECTION_START_DELAY_MS);
  };

  /**
   * Jumps past the guided reflection, its session analysis, and goal
   * generation, landing on the rating step with a fabricated payload.
   *
   * Uses `navigate` rather than `replace` so the stack ends up the same depth
   * as the real path. Nothing is persisted — no entry is written and no goals
   * are saved — so the streak and Mind Map steps after this render from the
   * fixture rather than from anything the account actually has.
   */
  const skipToRatingForDev = () => {
    if (!ENABLE_ONBOARDING_DEV_SHORTCUTS) {
      return;
    }

    setIsDisclaimerVisible(false);
    navigation.navigate(
      'FirstReflectionRating',
      buildDevFirstReflectionStreakPayload(draft),
    );
  };

  const continueFromOtherReferral = () => {
    const trimmedReferral = otherReferralInput.trim();

    if (!trimmedReferral || isAutoAdvancing) {
      return;
    }

    setDraftValue('referralSourceOther', trimmedReferral);
    triggerHaptic('primaryAction').catch(() => undefined);
    setIsAutoAdvancing(true);

    autoAdvanceTimerRef.current = setTimeout(() => {
      setIsAutoAdvancing(false);
      goToStep(stepIndex + 1);
      autoAdvanceTimerRef.current = null;
    }, AUTO_ADVANCE_DELAY_MS);
  };

  const readyButtonAnimatedStyle = {
    opacity: readyButtonReveal,
    transform: [
      {
        translateY: readyButtonReveal.interpolate({
          inputRange: [0, 1],
          outputRange: [12, 0],
        }),
      },
      {
        scale: readyButtonPulse.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 1.026],
        }),
      },
    ],
  };

  const renderReferralIcon = (option: OnboardingV2Option) => {
    if (!hasReferralAsset(option.id)) {
      return null;
    }

    return (
      <Image
        accessibilityIgnoresInvertColors
        resizeMode="contain"
        source={referralAssetById[option.id]}
        style={styles.referralIconImage}
      />
    );
  };

  const renderOccupationIcon = (option: OnboardingV2Option) => {
    if (!hasOccupationAsset(option.id)) {
      return null;
    }

    return (
      <Image
        accessibilityIgnoresInvertColors
        resizeMode="contain"
        source={occupationAssetById[option.id]}
        style={styles.referralIconImage}
      />
    );
  };

  const renderToneIcon = (option: OnboardingV2Option) => {
    if (!hasToneAsset(option.id)) {
      return null;
    }

    return (
      <Image
        accessibilityIgnoresInvertColors
        resizeMode="contain"
        source={toneAssetById[option.id]}
        style={styles.referralIconImage}
      />
    );
  };

  const renderSupportIcon = (option: OnboardingV2Option) => {
    if (!hasSupportAsset(option.id)) {
      return null;
    }

    return (
      <Image
        accessibilityIgnoresInvertColors
        resizeMode="contain"
        source={supportAssetById[option.id]}
        style={styles.referralIconImage}
      />
    );
  };

  const renderOptionIcon = (
    option: OnboardingV2Option,
    key: AutoAdvanceKey,
  ) => {
    if (key === 'referralSource') {
      return renderReferralIcon(option);
    }

    if (key === 'primaryContext') {
      return renderOccupationIcon(option);
    }

    if (key === 'reflectionTone') {
      return renderToneIcon(option);
    }

    if (key === 'supportFocusAreas') {
      return renderSupportIcon(option);
    }

    return null;
  };

  const getCardRevealStyle = (index: number) => {
    const revealValue = cardRevealValues[index] || cardRevealValues[0];

    return {
      opacity: revealValue,
      transform: [
        {
          translateY: revealValue.interpolate({
            inputRange: [0, 1],
            outputRange: [14, 0],
          }),
        },
        {
          scale: revealValue.interpolate({
            inputRange: [0, 1],
            outputRange: [0.97, 1],
          }),
        },
      ],
    };
  };

  const renderOptionList = (
    options: OnboardingV2Option[],
    selectedValue: string | undefined,
    key: AutoAdvanceKey,
    config?: {
      multiSelect?: boolean;
      selectedValues?: string[];
      onPressOption?: (optionId: string) => void;
    },
  ) => (
    <View style={styles.optionList}>
      {options.map((option, index) => (
        <Animated.View key={option.id} style={getCardRevealStyle(index)}>
          <OnboardingOptionCard
            accessibilityRole={config?.multiSelect ? 'checkbox' : 'radio'}
            compact
            label={option.label}
            leadingIcon={renderOptionIcon(option, key)}
            multiSelect={config?.multiSelect}
            onPress={() =>
              config?.onPressOption
                ? config.onPressOption(option.id)
                : selectAndAdvance(key, option.id)
            }
            selected={
              config?.multiSelect
                ? Boolean(config.selectedValues?.includes(option.id))
                : selectedValue === option.id
            }
          />
        </Animated.View>
      ))}
    </View>
  );

  const renderThemeOptions = () => (
    <View style={styles.themeGrid}>
      {THEME_OPTIONS.map((option, index) => (
        <Animated.View
          key={option.id}
          style={[styles.themeCardReveal, getCardRevealStyle(index)]}
        >
          <ThemePreviewCard
            onPress={event =>
              selectAndAdvance('preferredTheme', option.id, event)
            }
            selected={draft.preferredTheme === option.id}
            style={styles.themeCardFill}
            themeOption={option}
          />
        </Animated.View>
      ))}
    </View>
  );

  const renderInlinePrimaryButton = (
    label: string,
    onPress: () => void,
    animatedStyle?: object,
  ) => (
    <Animated.View style={[styles.inlineButtonWrap, animatedStyle]}>
      <HapticPressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [
          styles.primaryButton,
          { backgroundColor: accentColor },
          pressed && styles.buttonPressed,
        ]}
      >
        <Text
          style={[
            styles.primaryButtonText,
            { color: theme.colors.primaryForeground },
          ]}
        >
          {label}
        </Text>
      </HapticPressable>
    </Animated.View>
  );

  const renderSkipAction = () => (
    <HapticPressable
      accessibilityRole="button"
      onPress={skipCurrentStep}
      style={({ pressed }) => [
        styles.inlineSkipAction,
        pressed && styles.footerSecondaryPressed,
      ]}
    >
      <Text
        style={[
          styles.footerSecondaryText,
          { color: theme.colors.mutedForeground },
        ]}
      >
        Skip
      </Text>
    </HapticPressable>
  );

  const renderSkipOnlyActions = () => (
    <View style={styles.inlineActionArea}>
      <View style={styles.inlineButtonSpace} />
      {renderSkipAction()}
    </View>
  );

  const renderSupportActions = () => (
    <View style={styles.inlineActionArea}>
      <View style={styles.inlineButtonSpace}>
        {supportSelections.length
          ? renderInlinePrimaryButton('Continue', continueFromSupport, {
              opacity: supportContinueReveal,
              transform: [
                {
                  translateY: supportContinueReveal.interpolate({
                    inputRange: [0, 1],
                    outputRange: [10, 0],
                  }),
                },
                {
                  scale: supportContinueReveal.interpolate({
                    inputRange: [0, 0.72, 1],
                    outputRange: [0.94, 1.035, 1],
                  }),
                },
              ],
            })
          : null}
      </View>
      {renderSkipAction()}
    </View>
  );

  const renderThemeActions = () => (
    <View style={[styles.inlineActionArea, styles.themeActionArea]}>
      {renderInlinePrimaryButton('Continue', continueFromTheme)}
      <Text
        style={[styles.footerNote, { color: theme.colors.mutedForeground }]}
      >
        This can be changed later in the app.
      </Text>
    </View>
  );

  const renderReadyFeatures = () => (
    <View style={styles.featureList}>
      {READY_FEATURE_CARDS.map((feature, index) => {
        const revealValue = featureRevealValues[index];
        const isDark = theme.mode === 'dark';

        return (
          <Animated.View
            key={feature.text}
            style={[
              styles.featureCard,
              {
                backgroundColor: isDark
                  ? hexToRgba(theme.colors.secondary, 0.78)
                  : hexToRgba(theme.colors.card, 0.86),
                borderColor: hexToRgba(
                  theme.colors.primary,
                  isDark ? 0.24 : 0.16,
                ),
                opacity: revealValue,
                transform: [
                  {
                    translateY: revealValue.interpolate({
                      inputRange: [0, 1],
                      outputRange: [14, 0],
                    }),
                  },
                  {
                    scale: revealValue.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.98, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <View
              style={[
                styles.featureIconWrap,
                {
                  backgroundColor: hexToRgba(
                    theme.colors.primary,
                    isDark ? 0.18 : 0.1,
                  ),
                },
              ]}
            >
              <Image
                accessibilityIgnoresInvertColors
                resizeMode="contain"
                source={readyFeatureIcons[index]}
                style={styles.featureIcon}
              />
            </View>
            <Text
              style={[styles.featureText, { color: theme.colors.foreground }]}
            >
              {feature.text}
            </Text>
          </Animated.View>
        );
      })}
    </View>
  );

  const renderStepContent = () => {
    switch (step) {
      case 'intro':
        return (
          <View style={styles.centeredCopy}>
            <OnboardingHero variant="welcome" />
            <View style={styles.greetingBlock}>
              {firstName ? (
                <View style={styles.greetingRow}>
                  <Text
                    style={[
                      styles.greetingText,
                      { color: theme.colors.foreground },
                    ]}
                  >
                    Hi {firstName}
                  </Text>
                  <WavingHandIcon />
                </View>
              ) : null}
              <Text
                style={[
                  styles.title,
                  {
                    color: theme.colors.foreground,
                    fontSize: isCompact ? 28 : 31,
                  },
                ]}
              >
                Ready to begin?
              </Text>
            </View>
            <Text
              style={[styles.body, { color: theme.colors.mutedForeground }]}
            >
              Start your journaling journey with a space that learns what kind
              of reflection helps you most.
            </Text>
          </View>
        );
      case 'name':
        return (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={24}
            style={styles.nameKeyboardArea}
          >
            <TouchableWithoutFeedback
              accessible={false}
              onPress={Keyboard.dismiss}
            >
              <View style={styles.nameStepCopy}>
                <Text
                  style={[
                    styles.title,
                    {
                      color: theme.colors.foreground,
                      fontSize: isCompact ? 28 : 31,
                    },
                  ]}
                >
                  Hey! What do we call you?
                </Text>
                <Text
                  style={[styles.body, { color: theme.colors.mutedForeground }]}
                >
                  Use the name that feels right for your reflection space.
                </Text>
                <View style={styles.displayNameFieldWrap}>
                  <TextInput
                    ref={displayNameInputRef}
                    accessibilityLabel="What should Journal.IO call you?"
                    autoCapitalize="words"
                    editable={!isAutoAdvancing}
                    maxLength={60}
                    onBlur={() => setIsKeyboardVisible(false)}
                    onChangeText={value => {
                      setDraftValue('displayName', value);
                      if (displayNameError) {
                        setDisplayNameError(null);
                      }
                    }}
                    onSubmitEditing={() => {
                      displayNameInputRef.current?.blur();
                      Keyboard.dismiss();
                    }}
                    onFocus={() => setIsKeyboardVisible(true)}
                    placeholder="Your name"
                    placeholderTextColor={theme.colors.mutedForeground}
                    returnKeyType="done"
                    style={[styles.displayNameInput, displayNameInputStyle]}
                    textContentType="name"
                    value={displayName}
                  />
                  {displayNameError ? (
                    <Text
                      accessibilityLiveRegion="polite"
                      style={[
                        styles.displayNameError,
                        { color: theme.colors.destructive },
                      ]}
                    >
                      {displayNameError}
                    </Text>
                  ) : null}
                </View>
              </View>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        );
      case 'referral':
        return (
          <View style={styles.stepCopy}>
            <Text
              style={[styles.sectionTitle, { color: theme.colors.foreground }]}
            >
              {firstName || 'There'}, how did you hear about us?
            </Text>
            <Text
              style={[
                styles.sectionBody,
                { color: theme.colors.mutedForeground },
              ]}
            >
              Just helps us understand what's working.
            </Text>
            {renderOptionList(
              REFERRAL_SOURCE_OPTIONS,
              draft.referralSource,
              'referralSource',
            )}
            {isOtherReferralSelected ? (
              <Animated.View
                style={[
                  styles.otherReferralWrap,
                  {
                    opacity: otherReferralReveal,
                    transform: [
                      {
                        translateY: otherReferralReveal.interpolate({
                          inputRange: [0, 1],
                          outputRange: [12, 0],
                        }),
                      },
                      {
                        scale: otherReferralReveal.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.96, 1],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <TextInput
                  accessibilityLabel="Where did you hear about Journal.IO?"
                  autoCapitalize="sentences"
                  onChangeText={setOtherReferralInput}
                  onSubmitEditing={continueFromOtherReferral}
                  placeholder="Type where you found us"
                  placeholderTextColor={theme.colors.mutedForeground}
                  returnKeyType="done"
                  style={[
                    styles.otherReferralInput,
                    {
                      backgroundColor: theme.colors.inputBackground,
                      borderColor: theme.colors.border,
                      color: theme.colors.foreground,
                    },
                  ]}
                  value={otherReferralInput}
                />
                <HapticPressable
                  accessibilityRole="button"
                  disabled={!otherReferralInput.trim() || isAutoAdvancing}
                  onPress={continueFromOtherReferral}
                  style={({ pressed }) => [
                    styles.otherReferralButton,
                    {
                      backgroundColor: otherReferralInput.trim()
                        ? theme.colors.primary
                        : theme.colors.muted,
                    },
                    pressed && styles.buttonPressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.otherReferralButtonText,
                      {
                        color: otherReferralInput.trim()
                          ? theme.colors.primaryForeground
                          : theme.colors.mutedForeground,
                      },
                    ]}
                  >
                    Continue
                  </Text>
                </HapticPressable>
              </Animated.View>
            ) : null}
          </View>
        );
      case 'age':
        return (
          <View style={styles.ageStepCopy}>
            <Animated.View
              style={[
                styles.ageHeadingWrap,
                {
                  opacity: ageEyebrowPop,
                  transform: [
                    {
                      translateY: ageEyebrowPop.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-10, 0],
                      }),
                    },
                    {
                      scale: ageEyebrowPop.interpolate({
                        inputRange: [0, 0.68, 1],
                        outputRange: [0.88, 1.07, 1],
                      }),
                    },
                  ],
                },
              ]}
            >
              <View style={styles.ageKickerRow}>
                <View
                  style={[
                    styles.ageKickerDot,
                    { backgroundColor: theme.colors.primary },
                  ]}
                />
                <Text
                  style={[
                    styles.ageEyebrowText,
                    {
                      color: theme.colors.primary,
                    },
                  ]}
                >
                  Personalisation starts here
                </Text>
              </View>
            </Animated.View>
            <Text
              style={[
                styles.ageQuestionTitle,
                { color: theme.colors.foreground },
              ]}
            >
              What's your age range?
            </Text>
            <Text
              style={[
                styles.sectionBody,
                { color: theme.colors.mutedForeground },
              ]}
            >
              Used only to tune the tone of prompts.
            </Text>
            {renderOptionList(AGE_RANGE_OPTIONS, draft.ageRange, 'ageRange')}
          </View>
        );
      case 'occupation':
        return (
          <View style={styles.stepCopy}>
            <Text
              style={[styles.sectionTitle, { color: theme.colors.foreground }]}
            >
              What do you do most days?
            </Text>
            <Text
              style={[
                styles.sectionBody,
                { color: theme.colors.mutedForeground },
              ]}
            >
              This helps make prompts feel more relevant.
            </Text>
            {renderOptionList(
              PRIMARY_CONTEXT_OPTIONS,
              draft.primaryContext,
              'primaryContext',
            )}
            {renderSkipOnlyActions()}
          </View>
        );
      case 'tone':
        return (
          <View style={styles.stepCopy}>
            <Text
              style={[styles.sectionTitle, { color: theme.colors.foreground }]}
            >
              How should the AI reflect with you?
            </Text>
            <Text
              style={[
                styles.sectionBody,
                { color: theme.colors.mutedForeground },
              ]}
            >
              Choose the tone that would help you most.
            </Text>
            {renderOptionList(
              REFLECTION_TONE_OPTIONS,
              draft.reflectionTone?.[0],
              'reflectionTone',
            )}
            {renderSkipOnlyActions()}
          </View>
        );
      case 'support':
        return (
          <View style={styles.stepCopy}>
            <Text
              style={[styles.sectionTitle, { color: theme.colors.foreground }]}
            >
              What are you dealing with lately?
            </Text>
            <Text
              style={[
                styles.sectionBody,
                { color: theme.colors.mutedForeground },
              ]}
            >
              Choose any that feel true right now.
            </Text>
            {renderOptionList(
              SUPPORT_FOCUS_OPTIONS,
              draft.primarySupportFocus || draft.supportFocusAreas?.[0],
              'supportFocusAreas',
              {
                multiSelect: true,
                onPressOption: toggleSupportSelection,
                selectedValues: supportSelections,
              },
            )}
            {renderSupportActions()}
          </View>
        );
      case 'theme':
        return (
          <View style={styles.stepCopy}>
            <Text
              style={[styles.sectionTitle, { color: theme.colors.foreground }]}
            >
              Choose your app theme
            </Text>
            <Text
              style={[
                styles.sectionBody,
                { color: theme.colors.mutedForeground },
              ]}
            >
              Preview how Journal.IO can feel.
            </Text>
            {renderThemeOptions()}
            {renderThemeActions()}
          </View>
        );
      case 'ready':
        return (
          <View style={styles.readyCopy}>
            <View style={styles.readyHeaderGroup}>
              <Animated.Image
                accessibilityIgnoresInvertColors
                accessibilityLabel="Celebration"
                resizeMode="contain"
                source={readyCelebrationIcon}
                style={[
                  styles.readyIcon,
                  {
                    transform: [
                      {
                        rotate: readyIconShake.interpolate({
                          inputRange: [0, 1, 2, 3],
                          outputRange: ['0deg', '-8deg', '8deg', '0deg'],
                        }),
                      },
                      {
                        scale: readyIconShake.interpolate({
                          inputRange: [0, 1, 2, 3],
                          outputRange: [1, 1.05, 1.03, 1],
                        }),
                      },
                    ],
                  },
                ]}
              />
              <Text
                adjustsFontSizeToFit
                numberOfLines={1}
                style={[styles.readyTitle, { color: theme.colors.foreground }]}
              >
                Your personalization is ready.
              </Text>
              <Text
                style={[
                  styles.readyBody,
                  { color: theme.colors.mutedForeground },
                ]}
              >
                Next, we'll write your first entry.
              </Text>
            </View>
            {renderReadyFeatures()}
          </View>
        );
      default:
        return (
          <View style={styles.centeredCopy}>
            <Text
              style={[
                styles.title,
                isCompact ? styles.titleCompact : styles.titleRegular,
                { color: theme.colors.foreground },
              ]}
            >
              Your reflection is almost ready.
            </Text>
            <Text
              style={[styles.body, { color: theme.colors.mutedForeground }]}
            >
              We'll keep your setup safe while the next screen opens.
            </Text>
          </View>
        );
    }
  };

  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: theme.colors.background }]}
      edges={['top', 'bottom']}
    >
      <View style={styles.backgroundGlowTop} />
      <View style={styles.backgroundGlowBottom} />
      <View style={[styles.shell, { maxWidth: contentMaxWidth }]}>
        <View style={styles.topBar}>
          {showBack ? (
            <HapticPressable
              accessibilityLabel="Go back"
              accessibilityRole="button"
              onPress={goBack}
              style={({ pressed }) => [
                styles.backButton,
                pressed && styles.backButtonPressed,
              ]}
            >
              <ArrowLeft
                color={theme.colors.foreground}
                size={20}
                strokeWidth={1.9}
              />
            </HapticPressable>
          ) : (
            <View style={styles.backButtonSpacer} />
          )}
          <OnboardingProgressDots
            accentColor={accentColor}
            currentIndex={progressIndex}
            total={progressTotal}
          />
          <View style={styles.backButtonSpacer} />

          {/* Debug builds only — `__DEV__` compiles this out of release
              bundles. It sits absolutely over the empty right-hand spacer, so
              the progress dots stay centred, and it lives inside the top bar
              rather than the screen root so the safe-area inset keeps it clear
              of the status bar. */}
          {ENABLE_ONBOARDING_DEV_SHORTCUTS ? (
            <HapticPressable
              accessibilityLabel="Dev: skip to the rating step"
              accessibilityRole="button"
              hitSlop={12}
              onPress={skipToRatingForDev}
              style={({ pressed }) => [
                styles.devSkipButton,
                {
                  backgroundColor: theme.colors.background,
                  borderColor: theme.colors.warning,
                },
                pressed && styles.devSkipButtonPressed,
              ]}
            >
              <Text
                style={[styles.devSkipText, { color: theme.colors.warning }]}
              >
                DEV SKIP
              </Text>
            </HapticPressable>
          ) : null}
        </View>
        <Animated.View
          style={[
            styles.animatedContent,
            {
              opacity: screenOpacity,
              transform: [{ translateY: screenTranslateY }],
            },
          ]}
        >
          <View style={styles.contentWrap}>{renderStepContent()}</View>
        </Animated.View>
        {step === 'intro' ||
        (step === 'name' && !isKeyboardVisible) ||
        step === 'ready' ? (
          <View style={styles.footer}>
            {step === 'intro' || step === 'name' || step === 'ready' ? (
              <Animated.View
                pointerEvents={
                  step === 'ready' && !isReadyCtaEnabled ? 'none' : 'auto'
                }
                style={[
                  styles.footerButtonWrap,
                  step === 'ready' ? readyButtonAnimatedStyle : undefined,
                ]}
              >
                {step === 'ready' ? (
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      styles.readyButtonHalo,
                      {
                        backgroundColor: accentColor,
                        opacity: readyButtonPulse.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.08, 0.22],
                        }),
                        transform: [
                          {
                            scaleX: readyButtonPulse.interpolate({
                              inputRange: [0, 1],
                              outputRange: [1, 1.07],
                            }),
                          },
                          {
                            scaleY: readyButtonPulse.interpolate({
                              inputRange: [0, 1],
                              outputRange: [1, 1.3],
                            }),
                          },
                        ],
                      },
                    ]}
                  />
                ) : null}
                <HapticPressable
                  accessibilityRole="button"
                  disabled={step === 'ready' && !isReadyCtaEnabled}
                  onPress={goNext}
                  testID="onboarding-primary-action"
                  style={({ pressed }) => [
                    styles.primaryButton,
                    { backgroundColor: accentColor },
                    pressed && styles.buttonPressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.primaryButtonText,
                      { color: theme.colors.primaryForeground },
                    ]}
                  >
                    {step === 'intro'
                      ? 'Start my journey'
                      : step === 'ready'
                      ? 'Continue'
                      : 'Continue'}
                  </Text>
                </HapticPressable>
              </Animated.View>
            ) : null}
          </View>
        ) : null}
      </View>
      <OnboardingBottomSheet
        bodyPoints={disclaimerPoints}
        consentAccepted={Boolean(draft.privacyConsent)}
        onContinue={continueFromDisclaimer}
        onDismiss={
          isStartingFirstReflection
            ? undefined
            : () => setIsDisclaimerVisible(false)
        }
        onPrivacyPress={() =>
          openLegalDocumentFromDisclaimer(
            LEGAL_URLS.privacyPolicy,
            'Privacy Policy',
          )
        }
        onTermsPress={() =>
          openLegalDocumentFromDisclaimer(
            LEGAL_URLS.termsOfService,
            'Terms of Service',
          )
        }
        onToggleConsent={() => {
          setDraftValue('privacyConsent', !draft.privacyConsent);
        }}
        primaryLabel="Begin my first reflection"
        requireConsent={REQUIRE_ONBOARDING_V2_PRIVACY_CONSENT}
        isSubmitting={isStartingFirstReflection}
        title="You're in control."
        visible={isDisclaimerVisible}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  devSkipButton: {
    alignItems: 'center',
    borderRadius: 999,
    // Dashed so it never reads as shippable UI.
    borderStyle: 'dashed',
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 26,
    paddingHorizontal: 10,
    position: 'absolute',
    right: 0,
    top: 4,
    zIndex: 20,
  },
  devSkipButtonPressed: {
    opacity: 0.6,
  },
  devSkipText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  ageEyebrowText: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.45,
    lineHeight: 26,
    maxWidth: 330,
  },
  ageHeadingWrap: {
    paddingBottom: 2,
  },
  ageKickerDot: {
    borderRadius: 999,
    height: 8,
    width: 8,
  },
  ageKickerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 9,
  },
  ageQuestionTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.25,
    lineHeight: 25,
  },
  ageStepCopy: {
    gap: 9,
    justifyContent: 'center',
  },
  animatedContent: {
    flex: 1,
  },
  backButton: {
    alignItems: 'center',
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  backButtonPressed: {
    opacity: 0.5,
    transform: [{ translateX: -1 }],
  },
  backButtonSpacer: {
    height: 34,
    width: 34,
  },
  backgroundGlowBottom: {
    backgroundColor: '#F5BF8A',
    borderRadius: 120,
    bottom: -78,
    height: 190,
    opacity: 0.09,
    position: 'absolute',
    right: -84,
    width: 190,
  },
  backgroundGlowTop: {
    backgroundColor: '#F6D8AE',
    borderRadius: 140,
    height: 220,
    left: -112,
    opacity: 0.16,
    position: 'absolute',
    top: -124,
    width: 220,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 320,
    textAlign: 'center',
  },
  displayNameError: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
    marginTop: 7,
    textAlign: 'center',
  },
  displayNameFieldWrap: {
    marginTop: 6,
    maxWidth: 320,
    width: '100%',
  },
  displayNameInput: {
    borderWidth: 0,
    fontSize: 23,
    fontWeight: '700',
    letterSpacing: -0.3,
    minHeight: 52,
    paddingHorizontal: 0,
    textAlign: 'center',
  },
  nameKeyboardArea: {
    flex: 1,
    justifyContent: 'center',
    width: '100%',
  },
  nameStepCopy: {
    alignItems: 'center',
    flex: 1,
    gap: 12,
    justifyContent: 'center',
    paddingBottom: 20,
    width: '100%',
  },
  buttonPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
  centeredCopy: {
    alignItems: 'center',
    flex: 1,
    gap: 14,
    justifyContent: 'center',
    paddingBottom: 8,
  },
  contentWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 10,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.6,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  featureCard: {
    alignItems: 'center',
    borderRadius: 15,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 11,
    minHeight: 50,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  featureIcon: {
    height: 25,
    width: 25,
  },
  featureIconWrap: {
    alignItems: 'center',
    borderRadius: 13,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  featureList: {
    gap: 9,
    marginTop: 12,
    width: '100%',
  },
  featureText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  footer: {
    alignItems: 'center',
    paddingBottom: 4,
    paddingTop: 8,
  },
  footerButtonWrap: {
    alignItems: 'center',
    width: '100%',
  },
  footerNote: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
    marginTop: 12,
    textAlign: 'center',
  },
  footerSecondaryAction: {
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  footerSecondaryPressed: {
    opacity: 0.64,
  },
  footerSecondaryText: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  inlineActionArea: {
    alignItems: 'center',
    gap: 10,
    paddingTop: 8,
  },
  inlineButtonSpace: {
    alignItems: 'center',
    height: 50,
    justifyContent: 'center',
    width: '100%',
  },
  inlineButtonWrap: {
    alignItems: 'center',
    width: '100%',
  },
  inlineSkipAction: {
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  optionList: {
    gap: 8,
    paddingTop: 4,
  },
  otherReferralButton: {
    alignItems: 'center',
    borderRadius: 15,
    minHeight: 42,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  otherReferralButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  otherReferralInput: {
    borderRadius: 15,
    borderWidth: 1,
    fontSize: 14,
    fontWeight: '700',
    minHeight: 44,
    paddingHorizontal: 14,
  },
  otherReferralWrap: {
    gap: 9,
    paddingTop: 4,
  },
  previewNote: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
    marginTop: 1,
    textAlign: 'center',
  },
  referralIconImage: {
    alignItems: 'center',
    height: 23,
    width: 23,
  },
  primaryButton: {
    alignItems: 'center',
    borderRadius: 18,
    justifyContent: 'center',
    maxWidth: 280,
    minHeight: 50,
    shadowColor: '#8E4636',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.13,
    shadowRadius: 16,
    width: '76%',
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  readyBody: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 22,
    maxWidth: 320,
    textAlign: 'center',
  },
  readyButtonHalo: {
    borderRadius: 24,
    height: 66,
    maxWidth: 280,
    position: 'absolute',
    top: -8,
    width: '76%',
  },
  readyCopy: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 8,
  },
  readyHeaderGroup: {
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  readyIcon: {
    height: 62,
    marginBottom: 2,
    width: 62,
  },
  readyTitle: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.45,
    lineHeight: 30,
    maxWidth: 350,
    textAlign: 'center',
  },
  root: {
    flex: 1,
  },
  sectionBody: {
    fontSize: 13,
    lineHeight: 19,
  },
  sectionTitle: {
    fontSize: 25,
    fontWeight: '700',
    letterSpacing: -0.35,
    lineHeight: 30,
  },
  shell: {
    alignSelf: 'center',
    flex: 1,
    paddingHorizontal: 18,
    width: '100%',
  },
  stepCopy: {
    gap: 9,
    justifyContent: 'center',
  },
  themeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
    paddingTop: 6,
  },
  themeCardFill: {
    width: '100%',
  },
  themeCardReveal: {
    width: '39%',
  },
  themeActionArea: {
    paddingTop: 18,
  },
  greetingBlock: {
    alignItems: 'center',
    gap: 5,
  },
  greetingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  greetingText: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  title: {
    fontWeight: '700',
    letterSpacing: -0.65,
    lineHeight: 37,
    maxWidth: 360,
    textAlign: 'center',
  },
  titleCompact: {
    fontSize: 28,
    letterSpacing: -0.6,  },
  titleRegular: {
    fontSize: 31,
    letterSpacing: -0.7,  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 2,
  },
});
