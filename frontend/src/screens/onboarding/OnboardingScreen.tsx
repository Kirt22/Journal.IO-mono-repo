import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import {
  Bell,
  BookHeart,
  Brain,
  Check,
  Coffee,
  Download,
  Heart,
  Moon,
  Sparkles,
  Shield,
  ShieldOff,
  Sun,
  Target,
  TrendingUp,
} from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { OnboardingProgressIndicator } from "../../components/OnboardingProgressIndicator";
import { OnboardingValueCard } from "../../components/OnboardingValueCard";
import { useTheme } from "../../theme/provider";

const mascotImage = require("../../assets/png/Masscott.png");
const TOTAL_STEPS = 8;
const isTestEnvironment = typeof jest !== "undefined";

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

export type OnboardingCompletionData = {
  ageRange: string;
  journalingExperience: string;
  goals: string[];
  supportFocusAreas: string[];
  reminderPreference: string;
  aiComfort: boolean;
  privacyConsent: boolean;
};

type OnboardingScreenProps = {
  isCompleting: boolean;
  onContinue: (data: OnboardingCompletionData) => void;
};

export function OnboardingScreen({
  isCompleting,
  onContinue,
}: OnboardingScreenProps) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const [step, setStep] = useState(1);
  const [selectedAgeRange, setSelectedAgeRange] = useState("");
  const [selectedExperience, setSelectedExperience] = useState("");
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [selectedSupportAreas, setSelectedSupportAreas] = useState<string[]>([]);
  const [selectedReminder, setSelectedReminder] = useState("evening");
  const [aiComfort, setAiComfort] = useState(true);
  const [agreedToPrivacy, setAgreedToPrivacy] = useState(false);
  const [stepError, setStepError] = useState<string | null>(null);
  const stepOpacity = useRef(new Animated.Value(1)).current;
  const stepTranslateX = useRef(new Animated.Value(0)).current;
  const mascotFloatY = useRef(new Animated.Value(0)).current;

  const isCompact = width < 360;
  const isWide = width >= 430;
  const horizontalPadding = isCompact ? 16 : isWide ? 28 : 20;
  const layoutMaxWidth = isWide ? 460 : 420;
  const titleSize = isCompact ? 26 : isWide ? 34 : 30;
  const sectionTitleSize = isCompact ? 24 : isWide ? 30 : 28;
  const heroSize = isCompact ? 82 : isWide ? 108 : 94;
  const heroSpacingStyle = isCompact ? styles.heroSectionCompact : styles.heroSectionStandard;
  const goalColumns = isWide ? 3 : 2;
  const primaryButtonText = step === TOTAL_STEPS ? "Get Started" : "Continue";
  const aiComfortPrimaryBackground = aiComfort ? theme.colors.primary : "transparent";
  const aiComfortSecondaryBackground = !aiComfort ? theme.colors.primary : "transparent";
  const privacyConsentBackground = agreedToPrivacy ? theme.colors.primary : "transparent";

  const canProceed = useMemo(() => {
    if (step === 2) {
      return selectedAgeRange.length > 0;
    }

    if (step === 3) {
      return selectedExperience.length > 0;
    }

    if (step === TOTAL_STEPS) {
      return agreedToPrivacy;
    }

    return true;
  }, [agreedToPrivacy, selectedAgeRange, selectedExperience, step]);

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

  const goBack = () => {
    if (step === 1) {
      return;
    }

    setStepError(null);
    setStep(previous => previous - 1);
  };

  const handleContinue = () => {
    if (step === 2 && !selectedAgeRange) {
      setStepError("Please choose an age range to continue.");
      return;
    }

    if (step === 3 && !selectedExperience) {
      setStepError("Please choose your journaling experience to continue.");
      return;
    }

    if (step === TOTAL_STEPS && !agreedToPrivacy) {
      setStepError("Please agree to the privacy terms to continue.");
      return;
    }

    setStepError(null);

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

          <View style={styles.goalGrid}>
            {journalingGoals.map(goal => {
              const Icon = goal.icon;
              const selected = selectedGoals.includes(goal.id);

              return (
                <Pressable
                  key={goal.id}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                  onPress={() => toggleGoal(goal.id)}
                  style={({ pressed }) => [
                    styles.goalCard,
                    {
                      backgroundColor: selected ? theme.colors.accent : theme.colors.card,
                      borderColor: selected ? theme.colors.primary : theme.colors.border,
                    },
                    goalColumns === 3 && styles.goalCardWide,
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
            Here&apos;s how Journal.IO can support your journaling practice.
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
                What AI can do for you
              </Text>
            </View>
            <View style={styles.bulletList}>
              <Text style={[styles.bulletText, { color: theme.colors.mutedForeground }]}>
                • Suggest personalized journaling prompts
              </Text>
              <Text style={[styles.bulletText, { color: theme.colors.mutedForeground }]}>
                • Notice patterns and summarize weekly reflections
              </Text>
              <Text style={[styles.bulletText, { color: theme.colors.mutedForeground }]}>
                • Help surface supportive, non-clinical insights
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
                  Get personalized insights and prompts to deepen your practice.
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
                  Focus on writing without AI suggestions. You can change this later.
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
              Your journal entries stay private. AI features process your data securely and never share it with third parties.
            </Text>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.stepSection}>
        <Text style={[styles.sectionTitle, { fontSize: sectionTitleSize, color: theme.colors.foreground }]}>
          Privacy & security
        </Text>
        <Text style={[styles.sectionSubtitle, { color: theme.colors.mutedForeground }]}>
          You control your data. Journal.IO stays supportive and privacy-first.
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
            I understand and agree to the privacy policy and terms of service.
          </Text>
        </Pressable>
      </View>
    );
  };

  return (
    <SafeAreaView
      edges={["top", "left", "right", "bottom"]}
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
    >
      <View style={styles.screenContent}>
        <ScrollView
          bounces={false}
          contentContainerStyle={[
            styles.contentContainer,
            { paddingHorizontal: horizontalPadding },
          ]}
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
                  onPress={goBack}
                  style={({ pressed }) => [
                    styles.secondaryButton,
                    {
                      backgroundColor: theme.colors.card,
                      borderColor: theme.colors.border,
                    },
                    pressed && styles.cardPressed,
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
                disabled={isCompleting || !canProceed}
                onPress={handleContinue}
                style={({ pressed }) => [
                  styles.primaryButton,
                  {
                    backgroundColor: canProceed ? theme.colors.primary : theme.colors.border,
                  },
                  pressed && canProceed && styles.primaryButtonPressed,
                  (isCompleting || !canProceed) && styles.primaryButtonDisabled,
                ]}
              >
                {isCompleting ? (
                  <ActivityIndicator color={theme.colors.primaryForeground} size="small" />
                ) : (
                  <Text
                    style={[
                      styles.primaryButtonText,
                      { color: canProceed ? theme.colors.primaryForeground : theme.colors.mutedForeground },
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
      </View>
    </SafeAreaView>
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
    gap: 12,
  },
  goalCard: {
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    flexBasis: "48%",
    gap: 12,
    minHeight: 126,
    padding: 16,
  },
  goalCardWide: {
    flexBasis: "31%",
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
