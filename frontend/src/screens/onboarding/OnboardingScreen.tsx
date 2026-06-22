import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import {
  Bell,
  BookHeart,
  Brain,
  Check,
  CloudRain,
  Coffee,
  Download,
  Frown,
  Heart,
  Laugh,
  Meh,
  Moon,
  Quote,
  Smile,
  Sparkles,
  Shield,
  ShieldOff,
  Star,
  Sun,
  Target,
  TrendingUp,
  Wand2,
} from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { OnboardingProgressIndicator } from "../../components/OnboardingProgressIndicator";
import { OnboardingValueCard } from "../../components/OnboardingValueCard";
import KeyboardDismissAccessory from "../../components/KeyboardDismissAccessory";
import { requestAppRating } from "../../services/appRatingService";
import {
  generateOnboardingDemoAnalysis,
  type OnboardingDemoAnalysisResponse,
  type OnboardingDemoMood,
} from "../../services/onboardingService";
import { requestAndSyncOnboardingReminderPreference } from "../../services/reminderNotificationsService";
import { useTheme } from "../../theme/provider";
import type { OnboardingCompletionData } from "../../types/onboarding";
import { LEGAL_URLS, openExternalUrl } from "../../utils/legalLinks";

const mascotImage = require("../../assets/png/Masscott.png");
const TOTAL_STEPS = 12;
const PRIVACY_STEP = 8;
const JOURNAL_DEMO_STEP = 9;
const AI_REFLECTION_STEP = 10;
const BREATHING_STEP = 11;
const RATING_STEP = 12;
const REFLECTION_WAIT_SECONDS = 3;
const BREATHING_WAIT_SECONDS = 5;
const isTestEnvironment = typeof jest !== "undefined";
const ONBOARDING_KEYBOARD_ACCESSORY_ID = "onboarding-keyboard-actions";

const valueCards = [
  {
    Icon: Sparkles,
    title: "AI-Powered Insights",
    description: "Get personalized prompts and weekly reflections from your journal trends.",
  },
  {
    Icon: TrendingUp,
    title: "Track Your Journey",
    description: "Spot recurring behavior patterns and growth over time.",
  },
  {
    Icon: Shield,
    title: "Private & Secure",
    description: "Your entries stay protected and visible only to your account.",
  },
];

const ageRanges = ["18-24", "25-34", "35-44", "45-54", "55+"];

const journalingExperience = [
  {
    id: "new",
    label: "New to journaling",
    description: "Just getting started",
  },
  {
    id: "occasional",
    label: "Occasional journaler",
    description: "A few times a month",
  },
  {
    id: "regular",
    label: "Regular journaler",
    description: "A few times a week",
  },
  {
    id: "daily",
    label: "Daily journaler",
    description: "Every day or almost every day",
  },
];

const journalingGoals = [
  {
    id: "reflection",
    label: "Daily Reflection",
    icon: BookHeart,
  },
  {
    id: "mindfulness",
    label: "Mindfulness Practice",
    icon: Sparkles,
  },
  {
    id: "growth",
    label: "Personal Growth",
    icon: TrendingUp,
  },
  {
    id: "gratitude",
    label: "Gratitude Journaling",
    icon: Heart,
  },
  {
    id: "support",
    label: "Supportive Check-ins",
    icon: Brain,
  },
  {
    id: "habits",
    label: "Habit Tracking",
    icon: Target,
  },
];

const supportFocusAreas = [
  {
    id: "stress",
    label: "Managing stress",
    icon: Moon,
  },
  {
    id: "anxiety",
    label: "Reducing worry",
    icon: Brain,
  },
  {
    id: "sleep",
    label: "Better sleep",
    icon: Moon,
  },
  {
    id: "focus",
    label: "Improving focus",
    icon: Target,
  },
  {
    id: "relationships",
    label: "Relationships",
    icon: Heart,
  },
  {
    id: "self-awareness",
    label: "Self-awareness",
    icon: Sparkles,
  },
];

const reminderPreferences = [
  {
    id: "morning",
    label: "Morning",
    time: "08:00",
    icon: Coffee,
  },
  {
    id: "afternoon",
    label: "Afternoon",
    time: "14:00",
    icon: Sun,
  },
  {
    id: "evening",
    label: "Evening",
    time: "20:00",
    icon: Moon,
  },
  {
    id: "none",
    label: "No reminders",
    time: "",
    icon: Bell,
  },
];

const ratingTestimonials = [
  {
    id: "sarah",
    initial: "S",
    name: "Sarah M.",
    meta: "Verified user",
    quote:
      "Journal.IO completely changed my mornings. I was hesitant at first, but taking that first step made all the difference.",
  },
  {
    id: "maya",
    initial: "M",
    name: "Maya R.",
    meta: "Daily journaler",
    quote:
      "The prompts feel gentle and specific. It helped me build a reflection habit without making the app feel noisy.",
  },
  {
    id: "jordan",
    initial: "J",
    name: "Jordan P.",
    meta: "Verified user",
    quote:
      "I like seeing small patterns over time. It makes journaling feel useful without turning it into another task list.",
  },
];

const journalMoodOptions = [
  {
    id: "great",
    label: "Great",
    Icon: Laugh,
    tone: "energized and uplifted",
  },
  {
    id: "good",
    label: "Good",
    Icon: Smile,
    tone: "calm and steady",
  },
  {
    id: "okay",
    label: "Okay",
    Icon: Meh,
    tone: "neutral and reflective",
  },
  {
    id: "low",
    label: "Low",
    Icon: Frown,
    tone: "tender and introspective",
  },
  {
    id: "stressed",
    label: "Stressed",
    Icon: CloudRain,
    tone: "overwhelmed but searching",
  },
] satisfies Array<{
  id: OnboardingDemoMood;
  label: string;
  Icon: typeof Laugh;
  tone: string;
}>;

type OnboardingScreenProps = {
  isCompleting: boolean;
  onContinue: (data: OnboardingCompletionData) => void;
};

export function getOnboardingResponsiveMetrics(width: number) {
  const isCompact = width < 360;
  const isWide = width >= 430;
  const horizontalPadding = isCompact ? 16 : isWide ? 28 : 20;
  const layoutMaxWidth = isWide ? 460 : 420;
  const titleSize = isCompact ? 26 : isWide ? 34 : 30;
  const sectionTitleSize = isCompact ? 24 : isWide ? 30 : 28;
  const heroSize = isCompact ? 82 : isWide ? 108 : 94;
  const goalGridGap = isCompact ? 10 : 12;
  const availableSheetWidth = Math.min(Math.max(width - horizontalPadding * 2, 0), layoutMaxWidth);
  const goalColumns = width < 350 ? 1 : 2;
  const goalCardWidth =
    goalColumns === 1
      ? availableSheetWidth
      : (availableSheetWidth - goalGridGap * (goalColumns - 1)) / goalColumns;

  return {
    availableSheetWidth,
    goalCardWidth,
    goalColumns,
    goalGridGap,
    heroSize,
    horizontalPadding,
    isCompact,
    isWide,
    layoutMaxWidth,
    sectionTitleSize,
    titleSize,
  };
}

export function OnboardingScreen({
  isCompleting,
  onContinue,
}: OnboardingScreenProps) {
  const theme = useTheme();
  const { height, width } = useWindowDimensions();
  const responsiveMetrics = getOnboardingResponsiveMetrics(width);
  const [step, setStep] = useState(1);
  const [selectedAgeRange, setSelectedAgeRange] = useState("");
  const [selectedExperience, setSelectedExperience] = useState("");
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [selectedSupportAreas, setSelectedSupportAreas] = useState<string[]>([]);
  const [selectedReminder, setSelectedReminder] = useState("evening");
  const [aiComfort, setAiComfort] = useState(true);
  const [excitementRating, setExcitementRating] = useState(0);
  const [activeTestimonialIndex, setActiveTestimonialIndex] = useState(0);
  const [isRequestingAppRating, setIsRequestingAppRating] = useState(false);
  const [hasRequestedAppRating, setHasRequestedAppRating] = useState(false);
  const [appRatingMessage, setAppRatingMessage] = useState<string | null>(null);
  const [agreedToPrivacy, setAgreedToPrivacy] = useState(false);
  const [journalMood, setJournalMood] = useState<OnboardingDemoMood | "">("");
  const [journalFeeling, setJournalFeeling] = useState("");
  const [journalChallenge, setJournalChallenge] = useState("");
  const [journalThoughts, setJournalThoughts] = useState("");
  const [demoAnalysis, setDemoAnalysis] =
    useState<OnboardingDemoAnalysisResponse | null>(null);
  const [isGeneratingDemoAnalysis, setIsGeneratingDemoAnalysis] = useState(false);
  const [reflectionSecondsRemaining, setReflectionSecondsRemaining] = useState(
    REFLECTION_WAIT_SECONDS
  );
  const [breathingSecondsRemaining, setBreathingSecondsRemaining] = useState(
    BREATHING_WAIT_SECONDS
  );
  const [isApplyingReminderPreference, setIsApplyingReminderPreference] = useState(false);
  const [stepError, setStepError] = useState<string | null>(null);
  const testimonialScrollRef = useRef<ScrollView | null>(null);
  const onboardingScrollRef = useRef<ScrollView | null>(null);
  const stepOpacity = useRef(new Animated.Value(1)).current;
  const stepTranslateX = useRef(new Animated.Value(0)).current;
  const mascotFloatY = useRef(new Animated.Value(0)).current;
  const ratingEntrance = useRef(new Animated.Value(1)).current;
  const breathingPulse = useRef(new Animated.Value(0)).current;
  const breathingScreenEnter = useRef(new Animated.Value(0)).current;
  const starScales = useRef(
    Array.from({ length: 5 }, () => new Animated.Value(1))
  ).current;

  const {
    availableSheetWidth,
    goalCardWidth,
    goalGridGap,
    heroSize,
    horizontalPadding,
    isCompact,
    layoutMaxWidth,
    sectionTitleSize,
    titleSize,
  } = responsiveMetrics;
  const heroSpacingStyle = isCompact ? styles.heroSectionCompact : styles.heroSectionStandard;
  const aiComfortPrimaryBackground = aiComfort ? theme.colors.primary : "transparent";
  const aiComfortSecondaryBackground = !aiComfort ? theme.colors.primary : "transparent";
  const privacyConsentBackground = agreedToPrivacy ? theme.colors.primary : "transparent";
  const ratingStepMinHeight = Math.max(height - (isCompact ? 270 : 315), 420);
  const demoStepMinHeight = Math.max(height - (isCompact ? 265 : 310), 470);
  const selectedJournalMood = journalMoodOptions.find(mood => mood.id === journalMood);
  const aiReflectionKeywords = demoAnalysis?.keywords ?? [];
  const aiReflectionMoodTone =
    demoAnalysis?.moodTone || selectedJournalMood?.tone || "calm and reflective";
  const breathingFocus =
    demoAnalysis?.keywords.find(keyword => keyword.label !== selectedJournalMood?.label)?.label ||
    selectedJournalMood?.tone ||
    "what you noticed";
  const isAiReflectionReady = reflectionSecondsRemaining <= 0;
  const isBreathingReady = breathingSecondsRemaining <= 0;
  const primaryButtonText =
    step === JOURNAL_DEMO_STEP && isGeneratingDemoAnalysis
      ? "Preparing reflection"
      : step === AI_REFLECTION_STEP && !isAiReflectionReady
        ? `Reflecting ${reflectionSecondsRemaining}s`
        : step === TOTAL_STEPS
          ? "Get Started"
          : "Continue";
  const ratingStepDynamicStyle = { minHeight: ratingStepMinHeight };
  const demoStepDynamicStyle = { minHeight: demoStepMinHeight };
  const ratingEntranceStyle = {
    opacity: ratingEntrance,
    transform: [
      {
        translateY: ratingEntrance.interpolate({
          inputRange: [0, 1],
          outputRange: [18, 0],
        }),
      },
      {
        scale: ratingEntrance.interpolate({
          inputRange: [0, 1],
          outputRange: [0.97, 1],
        }),
      },
    ],
  };
  const testimonialSlideStyle = [
    styles.testimonialSlide,
    { width: availableSheetWidth },
  ];
  const ratingMessages = [
    "Tap to set your excitement level",
    "A bit hesitant? We'll guide you.",
    "Ready to take the first step",
    "Looking forward to it",
    "Highly motivated",
    "100% committed and ready",
  ];

  const handleOpenLegalDocument = (
    url: string,
    title: string,
    fallbackMessage: string
  ) => {
    setStepError(null);
    openExternalUrl(url, title).catch(error => {
      Alert.alert(title, error instanceof Error ? error.message : fallbackMessage);
    });
  };

  const canProceed = useMemo(() => {
    if (step === 2) {
      return selectedAgeRange.length > 0;
    }

    if (step === 3) {
      return selectedExperience.length > 0;
    }

    if (step === PRIVACY_STEP) {
      return agreedToPrivacy;
    }

    if (step === JOURNAL_DEMO_STEP) {
      return journalMood.length > 0 && journalThoughts.trim().length > 0;
    }

    if (step === AI_REFLECTION_STEP) {
      return isAiReflectionReady;
    }

    if (step === BREATHING_STEP) {
      return isBreathingReady;
    }

    return true;
  }, [
    agreedToPrivacy,
    isAiReflectionReady,
    isBreathingReady,
    journalMood,
    journalThoughts,
    selectedAgeRange,
    selectedExperience,
    step,
  ]);

  useEffect(() => {
    if (isTestEnvironment) {
      stepOpacity.setValue(1);
      stepTranslateX.setValue(0);
      mascotFloatY.setValue(0);
      return;
    }

    stepOpacity.setValue(0);
    stepTranslateX.setValue(16);

    Animated.parallel([
      Animated.timing(stepOpacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(stepTranslateX, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [step, stepOpacity, stepTranslateX, mascotFloatY]);

  useEffect(() => {
    if (isTestEnvironment || step !== 1) {
      mascotFloatY.stopAnimation();
      mascotFloatY.setValue(0);
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(mascotFloatY, {
          toValue: -6,
          duration: 1600,
          useNativeDriver: true,
        }),
        Animated.timing(mascotFloatY, {
          toValue: 0,
          duration: 1600,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();

    return () => {
      animation.stop();
    };
  }, [mascotFloatY, step]);

  useEffect(() => {
    if (step !== RATING_STEP) {
      ratingEntrance.setValue(1);
      return;
    }

    if (isTestEnvironment) {
      ratingEntrance.setValue(1);
      return;
    }

    ratingEntrance.setValue(0);
    Animated.spring(ratingEntrance, {
      toValue: 1,
      damping: 14,
      stiffness: 130,
      mass: 0.9,
      useNativeDriver: true,
    }).start();
  }, [ratingEntrance, step]);

  useEffect(() => {
    if (
      isTestEnvironment ||
      step !== RATING_STEP ||
      ratingTestimonials.length < 2 ||
      availableSheetWidth <= 0
    ) {
      return;
    }

    const interval = setInterval(() => {
      setActiveTestimonialIndex(previous => {
        const nextIndex = (previous + 1) % ratingTestimonials.length;
        testimonialScrollRef.current?.scrollTo({
          x: nextIndex * availableSheetWidth,
          animated: true,
        });
        return nextIndex;
      });
    }, 4600);

    return () => {
      clearInterval(interval);
    };
  }, [availableSheetWidth, step]);

  useEffect(() => {
    if (step !== AI_REFLECTION_STEP) {
      setReflectionSecondsRemaining(REFLECTION_WAIT_SECONDS);
      return;
    }

    if (isTestEnvironment) {
      setReflectionSecondsRemaining(0);
      return;
    }

    setReflectionSecondsRemaining(REFLECTION_WAIT_SECONDS);
    const interval = setInterval(() => {
      setReflectionSecondsRemaining(previous => {
        if (previous <= 1) {
          clearInterval(interval);
          return 0;
        }

        return previous - 1;
      });
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [step]);

  useEffect(() => {
    if (step !== BREATHING_STEP) {
      setBreathingSecondsRemaining(BREATHING_WAIT_SECONDS);
      breathingPulse.stopAnimation();
      breathingPulse.setValue(0);
      breathingScreenEnter.stopAnimation();
      breathingScreenEnter.setValue(0);
      return;
    }

    if (isTestEnvironment) {
      setBreathingSecondsRemaining(0);
      breathingPulse.setValue(1);
      breathingScreenEnter.setValue(1);
      return;
    }

    setBreathingSecondsRemaining(BREATHING_WAIT_SECONDS);
    breathingScreenEnter.setValue(0);
    const interval = setInterval(() => {
      setBreathingSecondsRemaining(previous => {
        if (previous <= 1) {
          clearInterval(interval);
          return 0;
        }

        return previous - 1;
      });
    }, 1000);

    breathingPulse.setValue(0);
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(breathingPulse, {
          toValue: 1,
          duration: 2500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(breathingPulse, {
          toValue: 0,
          duration: 2500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    Animated.parallel([
      Animated.timing(breathingScreenEnter, {
        toValue: 1,
        duration: 340,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
    animation.start();

    return () => {
      clearInterval(interval);
      animation.stop();
    };
  }, [breathingPulse, breathingScreenEnter, step]);

  const goBack = () => {
    if (step === 1) {
      return;
    }

    setStepError(null);
    setStep(previous => previous - 1);
  };

  const handleContinue = async () => {
    if (step === 2 && !selectedAgeRange) {
      setStepError("Please choose an age range to continue.");
      return;
    }

    if (step === 3 && !selectedExperience) {
      setStepError("Please choose your journaling experience to continue.");
      return;
    }

    if (step === PRIVACY_STEP && !agreedToPrivacy) {
      setStepError("Please agree to the privacy terms to continue.");
      return;
    }

    if (step === JOURNAL_DEMO_STEP && (!journalMood || !journalThoughts.trim())) {
      setStepError("Choose a mood and write one quick reflection to continue.");
      return;
    }

    if (step === AI_REFLECTION_STEP && !isAiReflectionReady) {
      return;
    }

    if (step === BREATHING_STEP && !isBreathingReady) {
      return;
    }

    setStepError(null);

    if (step === 6) {
      setIsApplyingReminderPreference(true);

      try {
        await requestAndSyncOnboardingReminderPreference(selectedReminder);
      } catch (error) {
        Alert.alert(
          "Reminder setup",
          error instanceof Error
            ? error.message
            : "Unable to apply reminder settings right now."
        );
      } finally {
        setIsApplyingReminderPreference(false);
      }
    }

    if (step === JOURNAL_DEMO_STEP) {
      const demoMood = journalMood;

      if (!demoMood) {
        setStepError("Choose a mood and write one quick reflection to continue.");
        return;
      }

      setIsGeneratingDemoAnalysis(true);

      try {
        const analysis = await generateOnboardingDemoAnalysis({
          mood: demoMood,
          feeling: journalFeeling.trim() || undefined,
          challenge: journalChallenge.trim() || undefined,
          thoughts: journalThoughts.trim(),
        });

        setDemoAnalysis(analysis);
        setStep(previous => previous + 1);
      } catch (error) {
        setStepError(
          error instanceof Error
            ? error.message
            : "Unable to prepare your demo reflection right now. Please try again."
        );
      } finally {
        setIsGeneratingDemoAnalysis(false);
      }

      return;
    }

    if (step < TOTAL_STEPS) {
      setStep(previous => previous + 1);
      return;
    }

    onContinue({
      ageRange: selectedAgeRange,
      journalingExperience: selectedExperience,
      goals: selectedGoals,
      supportFocusAreas: selectedSupportAreas,
      reminderPreference: selectedReminder,
      aiComfort,
      privacyConsent: agreedToPrivacy,
    });
  };

  const toggleGoal = (goalId: string) => {
    setStepError(null);
    setSelectedGoals(previous =>
      previous.includes(goalId)
        ? previous.filter(item => item !== goalId)
        : [...previous, goalId]
    );
  };

  const toggleSupportArea = (supportAreaId: string) => {
    setStepError(null);
    setSelectedSupportAreas(previous =>
      previous.includes(supportAreaId)
        ? previous.filter(item => item !== supportAreaId)
        : [...previous, supportAreaId]
    );
  };

  const animateStarSelection = (star: number) => {
    if (isTestEnvironment) {
      return;
    }

    const scale = starScales[star - 1];
    scale.setValue(0.82);

    Animated.spring(scale, {
      toValue: 1,
      damping: 7,
      stiffness: 280,
      mass: 0.6,
      useNativeDriver: true,
    }).start();
  };

  const requestNativeAppRating = () => {
    setHasRequestedAppRating(true);
    setIsRequestingAppRating(true);
    requestAppRating()
      .then(result => {
        if (result.status === "requested" || result.status === "opened") {
          setAppRatingMessage("Thanks for supporting Journal.IO.");
        } else if (result.status === "unavailable") {
          setAppRatingMessage(
            "App rating will be available once the native review prompt is configured."
          );
        } else {
          setAppRatingMessage("Unable to open app rating right now.");
        }
      })
      .catch(() => {
        setAppRatingMessage("Unable to open app rating right now.");
      })
      .finally(() => {
        setIsRequestingAppRating(false);
      });
  };

  const handleSelectExcitementRating = (star: number) => {
    setExcitementRating(star);
    setAppRatingMessage(null);
    setStepError(null);
    animateStarSelection(star);

    if (hasRequestedAppRating || isRequestingAppRating) {
      return;
    }

    Alert.alert(
      "Rate Journal.IO",
      "Your feedback helps us keep Journal.IO calm, useful, and focused on reflection.",
      [
        {
          text: "Not now",
          style: "cancel",
        },
        {
          text: "Rate now",
          onPress: requestNativeAppRating,
        },
      ]
    );
  };

  const handleTestimonialMomentumEnd = (
    event: NativeSyntheticEvent<NativeScrollEvent>
  ) => {
    const pageWidth = event.nativeEvent.layoutMeasurement.width;

    if (pageWidth <= 0) {
      return;
    }

    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
    setActiveTestimonialIndex(
      Math.min(Math.max(nextIndex, 0), ratingTestimonials.length - 1)
    );
  };

  const getStarScaleStyle = (star: number) => [
    styles.starScale,
    { transform: [{ scale: starScales[star - 1] }] },
  ];

  const revealJournalThoughts = () => {
    setTimeout(() => {
      onboardingScrollRef.current?.scrollToEnd({ animated: true });
    }, 120);
  };

  const renderStepContent = () => {
    if (step === 1) {
      return (
        <>
          <View style={[styles.heroSection, heroSpacingStyle]}>
            <View
              style={[
                styles.heroBadge,
                {
                  backgroundColor: theme.colors.accent,
                  width: heroSize,
                  height: heroSize,
                },
              ]}
            >
              <Animated.Image
                source={mascotImage}
                resizeMode="contain"
                style={[
                  styles.heroMascot,
                  {
                    width: heroSize * 0.82,
                    height: heroSize * 0.82,
                    transform: [{ translateY: mascotFloatY }],
                  },
                ]}
              />
            </View>

            <Text style={[styles.title, { fontSize: titleSize, color: theme.colors.foreground }]}>
              Welcome to Journal.IO
            </Text>
            <Text style={[styles.subtitle, { color: theme.colors.mutedForeground }]}>
              Your personal space for reflection, growth, and mindful daily check-ins.
            </Text>
          </View>

          <View style={styles.valueList}>
            {valueCards.map(card => (
              <OnboardingValueCard
                key={card.title}
                Icon={card.Icon}
                title={card.title}
                description={card.description}
              />
            ))}
          </View>
        </>
      );
    }

    if (step === 2) {
      return (
        <View style={styles.stepSection}>
          <Text style={[styles.sectionTitle, { fontSize: sectionTitleSize, color: theme.colors.foreground }]}>
            How old are you?
          </Text>
          <Text style={[styles.sectionSubtitle, { color: theme.colors.mutedForeground }]}>
            This helps us personalize your experience.
          </Text>

          <View style={styles.optionList}>
            {ageRanges.map(ageRange => {
              const selected = selectedAgeRange === ageRange;

              return (
                <Pressable
                  key={ageRange}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => {
                    setSelectedAgeRange(ageRange);
                    setStepError(null);
                  }}
                  style={({ pressed }) => [
                    styles.singleSelectCard,
                    {
                      backgroundColor: selected ? theme.colors.accent : theme.colors.card,
                      borderColor: selected ? theme.colors.primary : theme.colors.border,
                    },
                    pressed && styles.cardPressed,
                  ]}
                >
                  <Text style={[styles.singleSelectLabel, { color: theme.colors.foreground }]}>
                    {ageRange}
                  </Text>
                  <View
                    style={[
                      styles.radioOuter,
                      {
                        borderColor: selected ? theme.colors.primary : theme.colors.border,
                      },
                      selected && { backgroundColor: theme.colors.primary },
                    ]}
                  >
                    {selected ? <View style={styles.radioInner} /> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      );
    }

    if (step === 3) {
      return (
        <View style={styles.stepSection}>
          <Text style={[styles.sectionTitle, { fontSize: sectionTitleSize, color: theme.colors.foreground }]}>
            What&apos;s your journaling experience?
          </Text>
          <Text style={[styles.sectionSubtitle, { color: theme.colors.mutedForeground }]}>
            We&apos;ll tailor the app to your level.
          </Text>

          <View style={styles.optionList}>
            {journalingExperience.map(experience => {
              const selected = selectedExperience === experience.id;

              return (
                <Pressable
                  key={experience.id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => {
                    setSelectedExperience(experience.id);
                    setStepError(null);
                  }}
                  style={({ pressed }) => [
                    styles.singleSelectCard,
                    {
                      backgroundColor: selected ? theme.colors.accent : theme.colors.card,
                      borderColor: selected ? theme.colors.primary : theme.colors.border,
                    },
                    pressed && styles.cardPressed,
                  ]}
                >
                  <View style={styles.singleSelectTextWrap}>
                    <Text style={[styles.singleSelectLabel, { color: theme.colors.foreground }]}>
                      {experience.label}
                    </Text>
                    <Text style={[styles.singleSelectDescription, { color: theme.colors.mutedForeground }]}>
                      {experience.description}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.radioOuter,
                      {
                        borderColor: selected ? theme.colors.primary : theme.colors.border,
                      },
                      selected && { backgroundColor: theme.colors.primary },
                    ]}
                  >
                    {selected ? <View style={styles.radioInner} /> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      );
    }

    if (step === 4) {
      return (
        <View style={styles.stepSection}>
          <Text style={[styles.sectionTitle, { fontSize: sectionTitleSize, color: theme.colors.foreground }]}>
            What are your journaling goals?
          </Text>
          <Text style={[styles.sectionSubtitle, { color: theme.colors.mutedForeground }]}>
            Select all that apply. You can change these anytime.
          </Text>

          <View
            testID="goal-grid"
            style={[styles.goalGrid, { gap: goalGridGap }]}
          >
            {journalingGoals.map(goal => {
              const Icon = goal.icon;
              const selected = selectedGoals.includes(goal.id);

              return (
                <Pressable
                  key={goal.id}
                  testID={`goal-card-${goal.id}`}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                  onPress={() => toggleGoal(goal.id)}
                  style={({ pressed }) => [
                    styles.goalCard,
                    { width: goalCardWidth },
                    {
                      backgroundColor: selected ? theme.colors.accent : theme.colors.card,
                      borderColor: selected ? theme.colors.primary : theme.colors.border,
                    },
                    pressed && styles.cardPressed,
                  ]}
                >
                  <View
                    style={[
                      styles.goalIconWrap,
                      {
                        backgroundColor: selected ? theme.colors.primary : theme.colors.accent,
                      },
                    ]}
                  >
                    <Icon
                      color={selected ? theme.colors.primaryForeground : theme.colors.primary}
                      size={18}
                      strokeWidth={2}
                    />
                  </View>
                  <Text
                    style={[
                      styles.goalLabel,
                      { color: theme.colors.foreground },
                      selected && { color: theme.colors.primary },
                    ]}
                  >
                    {goal.label}
                  </Text>
                  <View
                    style={[
                      styles.selectionDot,
                      {
                        borderColor: selected ? theme.colors.primary : theme.colors.border,
                      },
                      selected && { backgroundColor: theme.colors.primary },
                    ]}
                  >
                    {selected ? <Check color={theme.colors.primaryForeground} size={12} /> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      );
    }

    if (step === 5) {
      return (
        <View style={styles.stepSection}>
          <Text style={[styles.sectionTitle, { fontSize: sectionTitleSize, color: theme.colors.foreground }]}>
            What would you like help with?
          </Text>
          <Text style={[styles.sectionSubtitle, { color: theme.colors.mutedForeground }]}>
            Choose the areas where journaling can support you.
          </Text>

          <ScrollView
            bounces={false}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.stepFiveScrollContent}
          >
            <View style={styles.optionList}>
              {supportFocusAreas.map(item => {
                const Icon = item.icon;
                const selected = selectedSupportAreas.includes(item.id);

                return (
                  <Pressable
                    key={item.id}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected }}
                    onPress={() => toggleSupportArea(item.id)}
                    style={({ pressed }) => [
                      styles.rowCard,
                      {
                        backgroundColor: selected ? theme.colors.accent : theme.colors.card,
                        borderColor: selected ? theme.colors.primary : theme.colors.border,
                      },
                      pressed && styles.cardPressed,
                    ]}
                  >
                    <View
                      style={[
                        styles.rowIconWrap,
                        {
                          backgroundColor: selected ? theme.colors.primary : theme.colors.accent,
                        },
                      ]}
                    >
                      <Icon
                        color={selected ? theme.colors.primaryForeground : theme.colors.primary}
                        size={18}
                        strokeWidth={2}
                      />
                    </View>
                    <Text style={[styles.rowLabel, { color: theme.colors.foreground }]}>
                      {item.label}
                    </Text>
                    <View
                      style={[
                        styles.selectionDot,
                        {
                          borderColor: selected ? theme.colors.primary : theme.colors.border,
                        },
                        selected && { backgroundColor: theme.colors.primary },
                      ]}
                    >
                      {selected ? <Check color={theme.colors.primaryForeground} size={12} /> : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        </View>
      );
    }

    if (step === 6) {
      return (
        <View style={styles.stepSection}>
          <Text style={[styles.sectionTitle, { fontSize: sectionTitleSize, color: theme.colors.foreground }]}>
            Set up daily reminders
          </Text>
          <Text style={[styles.sectionSubtitle, { color: theme.colors.mutedForeground }]}>
            When would you like to be reminded to journal?
          </Text>

          <View style={styles.optionList}>
            {reminderPreferences.map(reminder => {
              const Icon = reminder.icon;
              const selected = selectedReminder === reminder.id;

              return (
                <Pressable
                  key={reminder.id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => {
                    setSelectedReminder(reminder.id);
                    setStepError(null);
                  }}
                  style={({ pressed }) => [
                    styles.rowCard,
                    {
                      backgroundColor: selected ? theme.colors.accent : theme.colors.card,
                      borderColor: selected ? theme.colors.primary : theme.colors.border,
                    },
                    pressed && styles.cardPressed,
                  ]}
                >
                  <View
                    style={[
                      styles.rowIconWrap,
                      {
                        backgroundColor: selected ? theme.colors.primary : theme.colors.accent,
                      },
                    ]}
                  >
                    <Icon
                      color={selected ? theme.colors.primaryForeground : theme.colors.primary}
                      size={18}
                      strokeWidth={2}
                    />
                  </View>
                  <View style={styles.rowCopyWrap}>
                    <Text style={[styles.rowLabel, { color: theme.colors.foreground }]}>
                      {reminder.label}
                    </Text>
                    {reminder.time ? (
                      <Text style={[styles.singleSelectDescription, { color: theme.colors.mutedForeground }]}>
                        {reminder.time}
                      </Text>
                    ) : null}
                  </View>
                  <View
                    style={[
                      styles.selectionDot,
                      {
                        borderColor: selected ? theme.colors.primary : theme.colors.border,
                      },
                      selected && { backgroundColor: theme.colors.primary },
                    ]}
                  >
                    {selected ? <Check color={theme.colors.primaryForeground} size={12} /> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      );
    }

    if (step === 7) {
      return (
        <View style={styles.stepSection}>
          <Text style={[styles.sectionTitle, { fontSize: sectionTitleSize, color: theme.colors.foreground }]}>
            AI comfort and explanation
          </Text>
          <Text style={[styles.sectionSubtitle, { color: theme.colors.mutedForeground }]}>
            Choose whether AI guidance should be ready if you unlock Premium later.
          </Text>

          <View
            style={[
              styles.infoCard,
              styles.infoCardSpaced,
              {
                backgroundColor: theme.colors.accent,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <View style={styles.infoHeaderRow}>
              <Sparkles color={theme.colors.primary} size={18} strokeWidth={2} />
              <Text style={[styles.infoCardTitle, { color: theme.colors.foreground }]}>
                What Premium AI can do for you
              </Text>
            </View>
            <View style={styles.bulletList}>
              <Text style={[styles.bulletText, { color: theme.colors.mutedForeground }]}>
                • Generate personalized journaling prompts
              </Text>
              <Text style={[styles.bulletText, { color: theme.colors.mutedForeground }]}>
                • Notice patterns and summarize weekly reflections
              </Text>
              <Text style={[styles.bulletText, { color: theme.colors.mutedForeground }]}>
                • Surface supportive, non-clinical insights and AI tag suggestions
              </Text>
            </View>
          </View>

          <View style={styles.optionList}>
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ selected: aiComfort }}
              onPress={() => {
                setAiComfort(true);
                setStepError(null);
              }}
              style={({ pressed }) => [
                styles.singleSelectCard,
                {
                  backgroundColor: aiComfort ? theme.colors.accent : theme.colors.card,
                  borderColor: aiComfort ? theme.colors.primary : theme.colors.border,
                },
                pressed && styles.cardPressed,
              ]}
            >
              <View style={styles.singleSelectTextWrap}>
                <Text style={[styles.singleSelectLabel, { color: theme.colors.foreground }]}>
                  Yes, I&apos;d love AI assistance
                </Text>
                <Text style={[styles.singleSelectDescription, { color: theme.colors.mutedForeground }]}>
                  If you upgrade, Journal.IO can unlock personalized prompts and weekly AI reflections.
                </Text>
              </View>
                <View
                  style={[
                    styles.radioOuter,
                    {
                      borderColor: aiComfort ? theme.colors.primary : theme.colors.border,
                      backgroundColor: aiComfortPrimaryBackground,
                    },
                  ]}
                >
                {aiComfort ? <View style={styles.radioInner} /> : null}
              </View>
            </Pressable>

            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ selected: !aiComfort }}
              onPress={() => {
                setAiComfort(false);
                setStepError(null);
              }}
              style={({ pressed }) => [
                styles.singleSelectCard,
                {
                  backgroundColor: !aiComfort ? theme.colors.accent : theme.colors.card,
                  borderColor: !aiComfort ? theme.colors.primary : theme.colors.border,
                },
                pressed && styles.cardPressed,
              ]}
            >
              <View style={styles.singleSelectTextWrap}>
                <Text style={[styles.singleSelectLabel, { color: theme.colors.foreground }]}>
                  No thanks, keep it simple
                </Text>
                <Text style={[styles.singleSelectDescription, { color: theme.colors.mutedForeground }]}>
                  Keep AI features off, even if you upgrade later. You can change this anytime.
                </Text>
              </View>
                <View
                  style={[
                    styles.radioOuter,
                    {
                      borderColor: !aiComfort ? theme.colors.primary : theme.colors.border,
                      backgroundColor: aiComfortSecondaryBackground,
                    },
                  ]}
                >
                {!aiComfort ? <View style={styles.radioInner} /> : null}
              </View>
            </Pressable>
          </View>

          <View
            style={[
              styles.supportNote,
              {
                backgroundColor: theme.colors.muted,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <Text style={[styles.supportNoteText, { color: theme.colors.mutedForeground }]}>
              Premium unlocks AI features and Privacy Mode controls. Core journaling, export, and deletion remain available to every account.
            </Text>
          </View>
        </View>
      );
    }

    if (step === RATING_STEP) {
      return (
        <View style={[styles.stepSection, styles.ratingStepSection, ratingStepDynamicStyle]}>
          <Animated.View
            style={[
              styles.ratingAnimatedContent,
              ratingEntranceStyle,
            ]}
          >
            <View style={styles.ratingHeaderBlock}>
              <Text
                style={[
                  styles.sectionTitle,
                  styles.ratingSectionTitle,
                  { fontSize: sectionTitleSize, color: theme.colors.foreground },
                ]}
              >
                How excited are you to begin?
              </Text>
              <Text
                style={[
                  styles.sectionSubtitle,
                  styles.ratingSectionSubtitle,
                  { color: theme.colors.mutedForeground },
                ]}
              >
                Your personalized mindfulness plan is ready. How are you feeling about the journey ahead?
              </Text>
            </View>

            <View
              style={[
                styles.ratingCard,
                theme.mode === "dark" ? styles.ratingCardDark : styles.ratingCardLight,
              ]}
            >
              <View style={styles.starRow}>
                {[1, 2, 3, 4, 5].map(star => {
                  const filled = excitementRating >= star;

                  return (
                    <Pressable
                      key={star}
                      accessibilityLabel={`Rate excitement ${star} out of 5`}
                      accessibilityRole="button"
                      accessibilityState={{ selected: filled }}
                      onPress={() => handleSelectExcitementRating(star)}
                      style={({ pressed }) => [
                        styles.starButton,
                        pressed && styles.starButtonPressed,
                      ]}
                    >
                      <Animated.View style={getStarScaleStyle(star)}>
                        <Star
                          color={filled ? theme.colors.primary : theme.colors.mutedForeground}
                          fill={filled ? theme.colors.primary : "transparent"}
                          opacity={filled ? 1 : 0.34}
                          size={42}
                          strokeWidth={1.5}
                        />
                      </Animated.View>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.ratingMessageWrap}>
                <Text style={[styles.ratingMessage, { color: theme.colors.foreground }]}>
                  {ratingMessages[excitementRating]}
                </Text>
                {excitementRating >= 4 ? (
                  <Text style={[styles.ratingHint, { color: theme.colors.mutedForeground }]}>
                    Channel that energy. Your rating helps us inspire others.
                  </Text>
                ) : null}
                {isRequestingAppRating ? (
                  <ActivityIndicator color={theme.colors.primary} size="small" />
                ) : null}
                {appRatingMessage ? (
                  <Text style={[styles.ratingStatusText, { color: theme.colors.mutedForeground }]}>
                    {appRatingMessage}
                  </Text>
                ) : null}
              </View>
            </View>

            <ScrollView
              ref={testimonialScrollRef}
              horizontal
              pagingEnabled
              bounces={false}
              decelerationRate="fast"
              onMomentumScrollEnd={handleTestimonialMomentumEnd}
              scrollEventThrottle={16}
              showsHorizontalScrollIndicator={false}
              style={styles.testimonialScroller}
            >
              {ratingTestimonials.map(testimonial => (
                <View key={testimonial.id} style={testimonialSlideStyle}>
                  <View
                    style={[
                      styles.testimonialCard,
                      {
                        backgroundColor: theme.colors.card,
                        borderColor: theme.colors.border,
                      },
                    ]}
                  >
                    <View style={styles.testimonialHeader}>
                      <View style={styles.testimonialUserRow}>
                        <View style={[styles.testimonialAvatar, { backgroundColor: theme.colors.accent }]}>
                          <Text style={[styles.testimonialInitial, { color: theme.colors.primary }]}>
                            {testimonial.initial}
                          </Text>
                        </View>
                        <View style={styles.testimonialUserCopy}>
                          <Text style={[styles.testimonialName, { color: theme.colors.foreground }]}>
                            {testimonial.name}
                          </Text>
                          <Text style={[styles.testimonialMeta, { color: theme.colors.mutedForeground }]}>
                            {testimonial.meta}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.testimonialStars}>
                        {[1, 2, 3, 4, 5].map(star => (
                          <Star
                            key={`${testimonial.id}-star-${star}`}
                            color={theme.colors.primary}
                            fill={theme.colors.primary}
                            size={12}
                            strokeWidth={0}
                          />
                        ))}
                      </View>
                    </View>

                    <Text style={[styles.testimonialQuote, { color: theme.colors.foreground }]}>
                      &quot;{testimonial.quote}&quot;
                    </Text>
                  </View>
                </View>
              ))}
            </ScrollView>

            <View style={styles.testimonialDots}>
              {ratingTestimonials.map((testimonial, index) => (
                <View
                  key={`${testimonial.id}-dot`}
                  style={[
                    styles.testimonialDot,
                    {
                      backgroundColor:
                        activeTestimonialIndex === index
                          ? theme.colors.primary
                          : theme.colors.border,
                    },
                  ]}
                />
              ))}
            </View>
          </Animated.View>
        </View>
      );
    }

    if (step === PRIVACY_STEP) {
      return (
        <View style={styles.stepSection}>
        <Text style={[styles.sectionTitle, { fontSize: sectionTitleSize, color: theme.colors.foreground }]}>
          Privacy & security
        </Text>
        <Text style={[styles.sectionSubtitle, { color: theme.colors.mutedForeground }]}>
          You control your data. Core privacy protections apply to every account.
        </Text>

        <View style={styles.privacyList}>
          <View
            style={[
              styles.infoCard,
              {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <View style={styles.infoHeaderRow}>
              <Shield color={theme.colors.primary} size={18} strokeWidth={2} />
              <Text style={[styles.infoCardTitle, { color: theme.colors.foreground }]}>
                Your data, your control
              </Text>
            </View>
            <Text style={[styles.infoCardBody, { color: theme.colors.mutedForeground }]}>
              Export or delete your journal data from settings whenever you want.
            </Text>
          </View>

          <View
            style={[
              styles.infoCard,
              {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <View style={styles.infoHeaderRow}>
              <ShieldOff color={theme.colors.primary} size={18} strokeWidth={2} />
              <Text style={[styles.infoCardTitle, { color: theme.colors.foreground }]}>
                No data selling
              </Text>
            </View>
            <Text style={[styles.infoCardBody, { color: theme.colors.mutedForeground }]}>
              Your journal content and personal data are never sold to third parties.
            </Text>
          </View>

          <View
            style={[
              styles.infoCard,
              {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <View style={styles.infoHeaderRow}>
              <Download color={theme.colors.primary} size={18} strokeWidth={2} />
              <Text style={[styles.infoCardTitle, { color: theme.colors.foreground }]}>
                Export anytime
              </Text>
            </View>
            <Text style={[styles.infoCardBody, { color: theme.colors.mutedForeground }]}>
              Download your data whenever you need a personal backup.
            </Text>
          </View>
        </View>

        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: agreedToPrivacy }}
          onPress={() => {
            setStepError(null);
            setAgreedToPrivacy(previous => !previous);
          }}
            style={({ pressed }) => [
              styles.consentRow,
              {
                backgroundColor: theme.colors.card,
                borderColor: agreedToPrivacy ? theme.colors.primary : theme.colors.border,
            },
            pressed && styles.cardPressed,
          ]}
        >
          <View
            style={[
              styles.consentBox,
              {
                borderColor: agreedToPrivacy ? theme.colors.primary : theme.colors.border,
                backgroundColor: privacyConsentBackground,
              },
            ]}
          >
            {agreedToPrivacy ? <Check color={theme.colors.primaryForeground} size={12} /> : null}
          </View>
          <Text style={[styles.consentText, { color: theme.colors.foreground }]}>
            I understand and agree to the{" "}
            <Text
              accessibilityRole="link"
              onPress={() => {
                handleOpenLegalDocument(
                  LEGAL_URLS.privacyPolicy,
                  "Privacy Policy",
                  "Unable to open the privacy policy right now."
                );
              }}
              style={[styles.consentLink, { color: theme.colors.primary }]}
            >
              privacy policy
            </Text>{" "}
            and{" "}
            <Text
              accessibilityRole="link"
              onPress={() => {
                handleOpenLegalDocument(
                  LEGAL_URLS.termsOfService,
                  "Terms of Service",
                  "Unable to open the terms of service right now."
                );
              }}
              style={[styles.consentLink, { color: theme.colors.primary }]}
            >
              terms of service
            </Text>
            .
          </Text>
        </Pressable>
      </View>
      );
    }

    if (step === JOURNAL_DEMO_STEP) {
      return (
        <View style={[styles.stepSection, styles.journalDemoSection, demoStepDynamicStyle]}>
          <Text style={[styles.sectionTitle, { fontSize: sectionTitleSize, color: theme.colors.foreground }]}>
            Your first entry
          </Text>
          <Text style={[styles.sectionSubtitle, { color: theme.colors.mutedForeground }]}>
            Take a deep breath. Let&apos;s do a quick check-in.
          </Text>

          <View style={styles.journalDemoContent}>
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: theme.colors.mutedForeground }]}>
                How are you feeling?
              </Text>
              <View style={styles.moodSelectorRow}>
                {journalMoodOptions.map(mood => {
                  const Icon = mood.Icon;
                  const selected = journalMood === mood.id;

                  return (
                    <Pressable
                      key={mood.id}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      accessibilityLabel={`Mood ${mood.label}`}
                      onPress={() => {
                        setJournalMood(mood.id);
                        setDemoAnalysis(null);
                        setStepError(null);
                      }}
                      style={({ pressed }) => [
                        styles.demoMoodButton,
                        {
                          backgroundColor: selected ? theme.colors.accent : theme.colors.card,
                          borderColor: selected ? theme.colors.primary : theme.colors.border,
                        },
                        pressed && styles.cardPressed,
                      ]}
                    >
                      <Icon
                        color={selected ? theme.colors.primary : theme.colors.mutedForeground}
                        size={18}
                        strokeWidth={2}
                      />
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.demoMoodLabel,
                          {
                            color: selected
                              ? theme.colors.primary
                              : theme.colors.mutedForeground,
                          },
                        ]}
                      >
                        {mood.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.demoInputRow}>
              <View style={[styles.fieldGroup, styles.demoHalfField]}>
                <Text style={[styles.fieldLabel, { color: theme.colors.mutedForeground }]}>
                  In one word
                </Text>
                <TextInput
                  accessibilityLabel="One word feeling"
                  autoCapitalize="none"
                  maxLength={24}
                  inputAccessoryViewID={ONBOARDING_KEYBOARD_ACCESSORY_ID}
                  onChangeText={value => {
                    setJournalFeeling(value);
                    setDemoAnalysis(null);
                    setStepError(null);
                  }}
                  placeholder="e.g. scattered"
                  placeholderTextColor={theme.colors.mutedForeground}
                  style={[
                    styles.demoTextInput,
                    {
                      backgroundColor: theme.colors.card,
                      borderColor: theme.colors.border,
                      color: theme.colors.foreground,
                    },
                  ]}
                  value={journalFeeling}
                />
              </View>

              <View style={[styles.fieldGroup, styles.demoHalfField]}>
                <Text style={[styles.fieldLabel, { color: theme.colors.mutedForeground }]}>
                  A gentle hurdle
                </Text>
                <TextInput
                  accessibilityLabel="Gentle hurdle"
                  maxLength={40}
                  inputAccessoryViewID={ONBOARDING_KEYBOARD_ACCESSORY_ID}
                  onChangeText={value => {
                    setJournalChallenge(value);
                    setDemoAnalysis(null);
                    setStepError(null);
                  }}
                  placeholder="What felt heavy?"
                  placeholderTextColor={theme.colors.mutedForeground}
                  style={[
                    styles.demoTextInput,
                    {
                      backgroundColor: theme.colors.card,
                      borderColor: theme.colors.border,
                      color: theme.colors.foreground,
                    },
                  ]}
                  value={journalChallenge}
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <View style={styles.fieldHeaderRow}>
                <Text style={[styles.fieldLabel, { color: theme.colors.mutedForeground }]}>
                  What&apos;s on your mind?
                </Text>
                <Text style={[styles.characterCount, { color: theme.colors.mutedForeground }]}>
                  {journalThoughts.length}/240
                </Text>
              </View>
              <TextInput
                accessibilityLabel="Journal thoughts"
                maxLength={240}
                multiline
                inputAccessoryViewID={ONBOARDING_KEYBOARD_ACCESSORY_ID}
                onFocus={revealJournalThoughts}
                onChangeText={value => {
                  setJournalThoughts(value);
                  setDemoAnalysis(null);
                  setStepError(null);
                }}
                placeholder="Pour your thoughts here. Even a single sentence is enough..."
                placeholderTextColor={theme.colors.mutedForeground}
                style={[
                  styles.demoTextarea,
                  {
                    backgroundColor: theme.colors.card,
                    borderColor: theme.colors.border,
                    color: theme.colors.foreground,
                  },
                ]}
                textAlignVertical="top"
                value={journalThoughts}
              />
            </View>
          </View>
        </View>
      );
    }

    if (step === AI_REFLECTION_STEP) {
      return (
        <View style={[styles.stepSection, styles.aiReflectionSection, demoStepDynamicStyle]}>
          <Text style={[styles.sectionTitle, { fontSize: sectionTitleSize, color: theme.colors.foreground }]}>
            AI reflection
          </Text>
          <Text style={[styles.sectionSubtitle, { color: theme.colors.mutedForeground }]}>
            A gentle perspective on your thoughts.
          </Text>

          <View style={styles.aiReflectionOuter}>
            <View
              style={[
                styles.aiReflectionCard,
                {
                  backgroundColor: theme.colors.card,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <View style={styles.aiReflectionHeader}>
                <View style={[styles.aiIconWrap, { backgroundColor: theme.colors.accent }]}>
                  <Wand2 color={theme.colors.primary} size={18} strokeWidth={2} />
                </View>
                <View style={styles.aiHeaderCopy}>
                  <Text style={[styles.aiKicker, { color: theme.colors.primary }]}>
                    Detected aura
                  </Text>
                  <Text style={[styles.aiAuraText, { color: theme.colors.foreground }]}>
                    {aiReflectionMoodTone}
                  </Text>
                </View>
              </View>

              <View style={styles.aiReflectionBodyRow}>
                <Sparkles color={theme.colors.primary} opacity={0.68} size={16} strokeWidth={2} />
                <Text style={[styles.aiReflectionBody, { color: theme.colors.foreground }]}>
                  {demoAnalysis?.summary ||
                    "Your words suggest self-awareness. Naming what is present may help you move through the day with a little more gentleness."}
                </Text>
              </View>

              {aiReflectionKeywords.length > 0 ? (
                <View style={styles.keywordSection}>
                  <Text style={[styles.keywordLabel, { color: theme.colors.mutedForeground }]}>
                    Keywords noticed
                  </Text>
                  <View style={styles.keywordList}>
                    {aiReflectionKeywords.map(keyword => (
                      <View
                        key={keyword.label}
                        style={[
                          styles.keywordDescriptionCard,
                          {
                            backgroundColor: theme.colors.accent,
                            borderColor: theme.colors.border,
                          },
                        ]}
                      >
                        <Text style={[styles.keywordDescriptionLabel, { color: theme.colors.primary }]}>
                          {keyword.label}
                        </Text>
                        <Text style={[styles.keywordDescriptionText, { color: theme.colors.mutedForeground }]}>
                          {keyword.description}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

              <View
                style={[
                  styles.tomorrowPromptCard,
                  {
                    backgroundColor: theme.colors.accent,
                    borderColor: theme.colors.border,
                  },
                ]}
              >
                <View style={styles.tomorrowPromptHeader}>
                  <Quote color={theme.colors.primary} size={14} strokeWidth={2} />
                  <Text style={[styles.tomorrowPromptLabel, { color: theme.colors.primary }]}>
                    Prompt for tomorrow
                  </Text>
                </View>
                <Text style={[styles.tomorrowPromptText, { color: theme.colors.foreground }]}>
                  &quot;{demoAnalysis?.prompt || "What is one small, gentle thing that softened your day today?"}&quot;
                </Text>
              </View>
            </View>
          </View>

          <Text style={[styles.aiDisclaimer, { color: theme.colors.mutedForeground }]}>
            Your full reflections will grow richer over time.
          </Text>
        </View>
      );
    }

    return null;
  };

  if (step === BREATHING_STEP) {
    return (
      <SafeAreaView
        edges={["top", "left", "right", "bottom"]}
        style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
      >
        <Animated.View
          style={[
            styles.breathingFullScreen,
            { paddingHorizontal: horizontalPadding },
            {
              opacity: breathingScreenEnter,
              transform: [
                {
                  translateY: breathingScreenEnter.interpolate({
                    inputRange: [0, 1],
                    outputRange: [24, 0],
                  }),
                },
                {
                  scale: breathingScreenEnter.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.985, 1],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={[styles.breathingFullInner, { maxWidth: layoutMaxWidth }]}>
            <View style={styles.breathingCopyBlock}>
              <Text
                style={[
                  styles.sectionTitle,
                  styles.breathingTitle,
                  { fontSize: sectionTitleSize, color: theme.colors.foreground },
                ]}
              >
                Let that insight land
              </Text>
              <Text
                style={[
                  styles.sectionSubtitle,
                  styles.breathingSubtitle,
                  { color: theme.colors.mutedForeground },
                ]}
              >
                The reflection noticed &quot;{breathingFocus}&quot;. Let it be present, then take one slow breath.
              </Text>
            </View>

            <View style={styles.breathingOrbWrap}>
              <Animated.View
                style={[
                  styles.breathingOrb,
                  {
                    backgroundColor: theme.colors.accent,
                    borderColor: theme.colors.primary,
                    opacity: breathingPulse.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.5, 0.95],
                    }),
                    transform: [
                      {
                        scale: breathingPulse.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.84, 1.22],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <Text style={[styles.breathingOrbText, { color: theme.colors.primary }]}>
                  {isBreathingReady ? "Ready" : "Breathe"}
                </Text>
              </Animated.View>
            </View>

            <View style={styles.fullScreenCalmPrompt}>
              <Text style={[styles.calmCheckTitle, { color: theme.colors.foreground }]}>
                Are you feeling a little calmer?
              </Text>
              <Text style={[styles.calmCheckBody, { color: theme.colors.mutedForeground }]}>
                {isBreathingReady
                  ? "Take another breath if you need it. Continue only when you feel ready."
                  : `Take another breath if you need it. The button unlocks in ${breathingSecondsRemaining}s.`}
              </Text>
            </View>

            <Pressable
              accessibilityRole="button"
              disabled={!isBreathingReady}
              onPress={handleContinue}
              style={({ pressed }) => [
                styles.primaryButton,
                styles.breathingFullButton,
                {
                  backgroundColor: isBreathingReady
                    ? theme.colors.primary
                    : theme.colors.border,
                },
                pressed && isBreathingReady && styles.primaryButtonPressed,
                !isBreathingReady && styles.primaryButtonDisabled,
              ]}
            >
              <Text
                style={[
                  styles.primaryButtonText,
                  {
                    color: isBreathingReady
                      ? theme.colors.primaryForeground
                      : theme.colors.mutedForeground,
                  },
                ]}
              >
                I feel calmer
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      </SafeAreaView>
    );
  }

  return (
    <>
      <SafeAreaView
        edges={["top", "left", "right", "bottom"]}
        style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
      >
        <KeyboardAvoidingView
          style={styles.screenContent}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            ref={onboardingScrollRef}
            bounces={false}
            contentContainerStyle={[
              styles.contentContainer,
              { paddingHorizontal: horizontalPadding },
            ]}
            keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={[styles.sheet, { maxWidth: layoutMaxWidth }]}>
              <OnboardingProgressIndicator currentStep={step} totalSteps={TOTAL_STEPS} />
              <Animated.View
                style={{
                  opacity: stepOpacity,
                  transform: [{ translateX: stepTranslateX }],
                }}
              >
                {renderStepContent()}
              </Animated.View>
            </View>
          </ScrollView>

          <View
            style={[
              styles.actionsContainer,
              {
                maxWidth: layoutMaxWidth,
                paddingHorizontal: horizontalPadding,
              },
            ]}
          >
            {stepError ? (
              <Text style={[styles.errorText, { color: theme.colors.destructive }]}>
                {stepError}
              </Text>
            ) : null}

            <View style={styles.actionsRow}>
              {step > 1 ? (
                <View style={styles.actionSlot}>
                  <Pressable
                    accessibilityRole="button"
                    disabled={
                      isCompleting ||
                      isApplyingReminderPreference ||
                      isGeneratingDemoAnalysis
                    }
                    onPress={goBack}
                    style={({ pressed }) => [
                      styles.secondaryButton,
                      {
                        backgroundColor: theme.colors.card,
                        borderColor: theme.colors.border,
                      },
                      pressed && styles.cardPressed,
                      (isCompleting ||
                        isApplyingReminderPreference ||
                        isGeneratingDemoAnalysis) &&
                        styles.primaryButtonDisabled,
                    ]}
                  >
                    <Text style={[styles.secondaryButtonText, { color: theme.colors.foreground }]}>
                      Back
                    </Text>
                  </Pressable>
                </View>
              ) : null}

              <View style={styles.actionSlot}>
                <Pressable
                  accessibilityRole="button"
                  disabled={
                    isCompleting ||
                    isApplyingReminderPreference ||
                    isGeneratingDemoAnalysis ||
                    !canProceed
                  }
                  onPress={handleContinue}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    {
                      backgroundColor: canProceed ? theme.colors.primary : theme.colors.border,
                    },
                    pressed && canProceed && styles.primaryButtonPressed,
                    (isCompleting ||
                      isApplyingReminderPreference ||
                      isGeneratingDemoAnalysis ||
                      !canProceed) &&
                      styles.primaryButtonDisabled,
                  ]}
                >
                  {isCompleting || isApplyingReminderPreference || isGeneratingDemoAnalysis ? (
                    <ActivityIndicator color={theme.colors.primaryForeground} size="small" />
                  ) : (
                    <Text
                      style={[
                        styles.primaryButtonText,
                        {
                          color: canProceed
                            ? theme.colors.primaryForeground
                            : theme.colors.mutedForeground,
                        },
                      ]}
                    >
                      {primaryButtonText}
                    </Text>
                  )}
                </Pressable>
              </View>
            </View>

            <Text style={[styles.stepCounter, { color: theme.colors.mutedForeground }]}>
              Step {step} of {TOTAL_STEPS}
            </Text>
          </View>
        </KeyboardAvoidingView>
        <KeyboardDismissAccessory
          nativeID={ONBOARDING_KEYBOARD_ACCESSORY_ID}
          backgroundColor={theme.colors.card}
          borderColor={theme.colors.border}
          actionColor={theme.colors.primary}
        />
      </SafeAreaView>

    </>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  screenContent: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
    paddingBottom: 18,
    paddingTop: 16,
  },
  sheet: {
    width: "100%",
    alignSelf: "center",
  },
  stepCounter: {
    fontSize: 12,
    marginTop: 16,
    marginBottom: 16,
    textAlign: "center",
  },
  heroSection: {
    alignItems: "center",
  },
  heroSectionCompact: {
    marginBottom: 20,
  },
  heroSectionStandard: {
    marginBottom: 24,
  },
  heroBadge: {
    alignItems: "center",
    borderRadius: 999,
    justifyContent: "center",
    marginBottom: 22,
  },
  heroMascot: {
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontWeight: "600",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    marginTop: 10,
    maxWidth: 320,
    textAlign: "center",
  },
  valueList: {
    gap: 12,
  },
  stepSection: {
    flex: 1,
  },
  sectionTitle: {
    fontWeight: "600",
  },
  sectionSubtitle: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 16,
    marginTop: 8,
  },
  optionList: {
    gap: 12,
  },
  stepFiveScrollContent: {
    paddingBottom: 4,
  },
  singleSelectCard: {
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  singleSelectTextWrap: {
    flex: 1,
    gap: 4,
  },
  singleSelectLabel: {
    fontSize: 15,
    fontWeight: "600",
  },
  singleSelectDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  radioOuter: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1.5,
    height: 20,
    justifyContent: "center",
    width: 20,
  },
  radioInner: {
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
    height: 8,
    width: 8,
  },
  goalGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  goalCard: {
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
    minHeight: 126,
    padding: 16,
  },
  goalIconWrap: {
    alignItems: "center",
    borderRadius: 999,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  goalLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 18,
    textAlign: "center",
  },
  selectionDot: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1.5,
    height: 20,
    justifyContent: "center",
    width: 20,
  },
  rowCard: {
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  rowIconWrap: {
    alignItems: "center",
    borderRadius: 999,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  rowLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 21,
  },
  rowCopyWrap: {
    flex: 1,
    gap: 4,
  },
  infoCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  infoCardSpaced: {
    marginBottom: 14,
  },
  infoHeaderRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  infoCardTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  infoCardBody: {
    fontSize: 13,
    lineHeight: 19,
  },
  bulletList: {
    gap: 6,
  },
  bulletText: {
    fontSize: 13,
    lineHeight: 19,
  },
  supportNote: {
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 12,
    padding: 14,
  },
  supportNoteText: {
    fontSize: 12,
    lineHeight: 18,
  },
  ratingStepSection: {
    justifyContent: "center",
  },
  ratingAnimatedContent: {
    alignItems: "center",
    gap: 18,
    width: "100%",
  },
  ratingHeaderBlock: {
    alignItems: "center",
    width: "100%",
  },
  ratingSectionTitle: {
    textAlign: "center",
  },
  ratingSectionSubtitle: {
    marginBottom: 0,
    maxWidth: 340,
    textAlign: "center",
  },
  ratingCard: {
    alignItems: "center",
    borderRadius: 24,
    borderWidth: 1,
    gap: 18,
    overflow: "hidden",
    paddingHorizontal: 18,
    paddingVertical: 24,
    width: "100%",
  },
  ratingCardLight: {
    backgroundColor: "rgba(232, 116, 97, 0.07)",
    borderColor: "rgba(232, 116, 97, 0.16)",
  },
  ratingCardDark: {
    backgroundColor: "rgba(255, 138, 117, 0.07)",
    borderColor: "rgba(255, 138, 117, 0.16)",
  },
  starRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
  },
  starButton: {
    alignItems: "center",
    justifyContent: "center",
    padding: 4,
  },
  starScale: {
    alignItems: "center",
    justifyContent: "center",
  },
  starButtonPressed: {
    transform: [{ scale: 0.88 }],
  },
  ratingMessageWrap: {
    alignItems: "center",
    gap: 8,
  },
  ratingMessage: {
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
    textAlign: "center",
  },
  ratingHint: {
    fontSize: 12,
    lineHeight: 18,
    maxWidth: 280,
    textAlign: "center",
  },
  ratingStatusText: {
    fontSize: 12,
    lineHeight: 18,
    maxWidth: 280,
    textAlign: "center",
  },
  testimonialScroller: {
    width: "100%",
  },
  testimonialSlide: {
    paddingHorizontal: 1,
  },
  testimonialCard: {
    borderRadius: 24,
    borderWidth: 1,
    gap: 12,
    padding: 20,
  },
  testimonialHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  testimonialUserRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  testimonialAvatar: {
    alignItems: "center",
    borderRadius: 999,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  testimonialInitial: {
    fontSize: 14,
    fontWeight: "600",
  },
  testimonialUserCopy: {
    gap: 2,
  },
  testimonialName: {
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 18,
  },
  testimonialMeta: {
    fontSize: 12,
    lineHeight: 16,
  },
  testimonialStars: {
    alignItems: "center",
    flexDirection: "row",
    gap: 2,
  },
  testimonialQuote: {
    fontSize: 14,
    fontStyle: "italic",
    lineHeight: 21,
    opacity: 0.9,
  },
  testimonialDots: {
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
  },
  testimonialDot: {
    borderRadius: 999,
    height: 6,
    width: 6,
  },
  privacyList: {
    gap: 10,
    marginBottom: 14,
  },
  consentRow: {
    alignItems: "flex-start",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 14,
  },
  consentBox: {
    alignItems: "center",
    borderRadius: 6,
    borderWidth: 1,
    height: 20,
    justifyContent: "center",
    width: 20,
  },
  consentText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
  consentLink: {
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  journalDemoSection: {
    justifyContent: "center",
  },
  journalDemoContent: {
    gap: 14,
  },
  fieldGroup: {
    gap: 7,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  fieldHeaderRow: {
    alignItems: "flex-end",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  characterCount: {
    fontSize: 10,
    opacity: 0.7,
  },
  moodSelectorRow: {
    flexDirection: "row",
    gap: 8,
  },
  demoMoodButton: {
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    gap: 5,
    justifyContent: "center",
    minHeight: 66,
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  demoMoodLabel: {
    fontSize: 10,
    fontWeight: "700",
  },
  demoInputRow: {
    flexDirection: "row",
    gap: 12,
  },
  demoHalfField: {
    flex: 1,
  },
  demoTextInput: {
    borderRadius: 14,
    borderWidth: 1,
    fontSize: 14,
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  demoTextarea: {
    borderRadius: 18,
    borderWidth: 1,
    fontSize: 14,
    lineHeight: 20,
    minHeight: 112,
    paddingHorizontal: 14,
    paddingTop: 12,
  },
  aiReflectionSection: {
    justifyContent: "center",
  },
  aiReflectionOuter: {
    marginTop: 4,
    position: "relative",
  },
  aiReflectionCard: {
    borderRadius: 28,
    borderWidth: 1,
    gap: 18,
    overflow: "hidden",
    padding: 20,
  },
  aiReflectionHeader: {
    alignItems: "center",
    borderBottomColor: "rgba(120, 95, 78, 0.16)",
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 12,
    paddingBottom: 16,
  },
  aiIconWrap: {
    alignItems: "center",
    borderRadius: 999,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  aiHeaderCopy: {
    flex: 1,
    gap: 3,
  },
  aiKicker: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  aiAuraText: {
    fontSize: 14,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  aiReflectionBodyRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 9,
  },
  aiReflectionBody: {
    flex: 1,
    fontSize: 14,
    lineHeight: 22,
    opacity: 0.86,
  },
  keywordSection: {
    gap: 9,
  },
  keywordLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  keywordList: {
    gap: 8,
  },
  keywordDescriptionCard: {
    borderRadius: 16,
    borderWidth: 1,
    gap: 3,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  keywordDescriptionLabel: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  keywordDescriptionText: {
    fontSize: 12,
    lineHeight: 17,
  },
  tomorrowPromptCard: {
    borderRadius: 20,
    borderWidth: 1,
    gap: 8,
    padding: 16,
  },
  tomorrowPromptHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  tomorrowPromptLabel: {
    fontSize: 12,
    fontWeight: "700",
  },
  tomorrowPromptText: {
    fontSize: 14,
    fontStyle: "italic",
    lineHeight: 22,
  },
  aiDisclaimer: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 14,
    textAlign: "center",
  },
  breathingFullScreen: {
    flex: 1,
    justifyContent: "center",
  },
  breathingFullInner: {
    alignItems: "center",
    alignSelf: "center",
    justifyContent: "center",
    width: "100%",
  },
  breathingCopyBlock: {
    alignItems: "center",
    width: "100%",
  },
  breathingTitle: {
    textAlign: "center",
  },
  breathingSubtitle: {
    marginBottom: 0,
    maxWidth: 330,
    textAlign: "center",
  },
  breathingOrbWrap: {
    alignItems: "center",
    height: 220,
    justifyContent: "center",
    width: "100%",
  },
  breathingOrb: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    height: 150,
    justifyContent: "center",
    shadowColor: "#E87461",
    shadowOffset: { width: 0, height: 22 },
    shadowOpacity: 0.22,
    shadowRadius: 34,
    width: 150,
  },
  breathingOrbText: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  fullScreenCalmPrompt: {
    gap: 7,
    marginBottom: 28,
    width: "100%",
  },
  calmCheckTitle: {
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },
  calmCheckBody: {
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
  },
  breathingFullButton: {
    width: "100%",
  },
  actionsContainer: {
    alignSelf: "center",
    paddingBottom: 8,
    paddingTop: 8,
    width: "100%",
  },
  errorText: {
    fontSize: 13,
    marginBottom: 12,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 10,
  },
  actionSlot: {
    flex: 1,
  },
  secondaryButton: {
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  primaryButton: {
    alignItems: "center",
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  primaryButtonPressed: {
    opacity: 0.9,
  },
  primaryButtonDisabled: {
    opacity: 0.72,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  cardPressed: {
    transform: [{ scale: 0.985 }],
  },
});
