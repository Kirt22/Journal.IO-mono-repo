import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  BookHeart,
  Download,
  HandHeart,
  Shield,
  ShieldOff,
  Sparkles,
  TrendingUp,
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { OnboardingProgressIndicator } from '../components/OnboardingProgressIndicator';
import { OnboardingValueCard } from '../components/OnboardingValueCard';

type OnboardingScreenProps = {
  isCompleting: boolean;
  onComplete: () => void;
};

const totalSteps = 3;

const valueCards = [
  {
    Icon: Sparkles,
    title: 'AI-Powered Insights',
    description: 'Get personalized prompts and weekly reflections from your journal trends.',
  },
  {
    Icon: TrendingUp,
    title: 'Track Your Journey',
    description: 'Spot recurring behavior patterns and growth over time.',
  },
  {
    Icon: Shield,
    title: 'Private and Secure',
    description: 'Your entries stay protected and visible only to your account.',
  },
];

const goalChoices = [
  { label: 'Daily Reflection', Icon: BookHeart },
  { label: 'Mindfulness Practice', Icon: Sparkles },
  { label: 'Personal Growth', Icon: TrendingUp },
  { label: 'Gratitude Journaling', Icon: HandHeart },
];

export function OnboardingScreen({
  isCompleting,
  onComplete,
}: OnboardingScreenProps) {
  const [step, setStep] = useState(1);
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [agreedToPrivacy, setAgreedToPrivacy] = useState(false);
  const [stepError, setStepError] = useState<string | null>(null);
  const stepOpacity = useRef(new Animated.Value(1)).current;
  const stepTranslateX = useRef(new Animated.Value(0)).current;
  const revealAnims = useRef(Array.from({ length: 5 }, () => new Animated.Value(0))).current;
  const continueActive = useRef(new Animated.Value(1)).current;

  const isLastStep = step === totalSteps;
  const canProceed = step === 3 ? agreedToPrivacy : true;
  const primaryButtonBackgroundColor = continueActive.interpolate({
    inputRange: [0, 1],
    outputRange: ['#D7B7AB', '#E88B73'],
  });

  useEffect(() => {
    stepOpacity.setValue(0);
    stepTranslateX.setValue(18);
    revealAnims.forEach(value => value.setValue(0));

    Animated.parallel([
      Animated.timing(stepOpacity, {
        duration: 220,
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.timing(stepTranslateX, {
        duration: 220,
        toValue: 0,
        useNativeDriver: true,
      }),
    ]).start();

    Animated.stagger(
      60,
      revealAnims.map(value =>
        Animated.timing(value, {
          duration: 220,
          toValue: 1,
          useNativeDriver: true,
        })
      )
    ).start();
  }, [step, revealAnims, stepOpacity, stepTranslateX]);

  useEffect(() => {
    Animated.timing(continueActive, {
      duration: 180,
      toValue: canProceed ? 1 : 0,
      useNativeDriver: false,
    }).start();
  }, [canProceed, continueActive]);

  const animatedRevealStyle = (index: number) => ({
    opacity: revealAnims[index] ?? 1,
    transform: [
      {
        translateY: (revealAnims[index] ?? 1).interpolate({
          inputRange: [0, 1],
          outputRange: [10, 0],
        }),
      },
    ],
  });

  const handleGoalToggle = (goal: string) => {
    setStepError(null);
    setSelectedGoals(previous =>
      previous.includes(goal)
        ? previous.filter(currentGoal => currentGoal !== goal)
        : [...previous, goal]
    );
  };

  const goBack = () => {
    if (step === 1) {
      return;
    }

    setStepError(null);
    setStep(previous => previous - 1);
  };

  const handleContinue = () => {
    if (step === 3 && !agreedToPrivacy) {
      setStepError('Please agree to the privacy terms to continue.');
      return;
    }

    setStepError(null);

    if (step < totalSteps) {
      setStep(previous => previous + 1);
      return;
    }

    onComplete();
  };

  const renderStepContent = () => {
    if (step === 1) {
      return (
        <>
          <Animated.View style={[styles.headerSection, animatedRevealStyle(0)]}>
            <Text style={styles.title}>Welcome to Journal.IO</Text>
            <Text style={styles.subtitle}>
              Your personal space for reflection, growth, and mindful daily check-ins.
            </Text>
            <View style={styles.heroCircle}>
              <BookHeart color="#8E4636" size={40} strokeWidth={2} />
            </View>
          </Animated.View>

          <View style={styles.valuesSection}>
            {valueCards.map((value, index) => (
              <Animated.View key={value.title} style={animatedRevealStyle(index + 1)}>
                <OnboardingValueCard
                  Icon={value.Icon}
                  description={value.description}
                  title={value.title}
                />
              </Animated.View>
            ))}
          </View>
        </>
      );
    }

    if (step === 2) {
      return (
        <View style={styles.stepSection}>
          <Text style={styles.titleLeft}>What brings you here?</Text>
          <Text style={styles.subtitleLeft}>
            Select your journaling goals. You can change these anytime.
          </Text>

          <View style={styles.goalList}>
            {goalChoices.map(goal => {
              const selected = selectedGoals.includes(goal.label);
              return (
                <Pressable
                  key={goal.label}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                  onPress={() => handleGoalToggle(goal.label)}
                  style={({ pressed }) => [
                    styles.goalOption,
                    selected && styles.goalOptionSelected,
                    pressed && styles.goalOptionPressed,
                    pressed && styles.goalOptionScaled,
                  ]}
                >
                  <View style={[styles.goalIconWrap, selected && styles.goalIconWrapSelected]}>
                    <goal.Icon
                      color={selected ? '#8E4636' : '#70786D'}
                      size={18}
                      strokeWidth={2}
                    />
                  </View>
                  <Text style={[styles.goalText, selected && styles.goalTextSelected]}>{goal.label}</Text>
                  <View
                    style={[
                      styles.goalCheck,
                      selected && styles.goalCheckSelected,
                    ]}
                  >
                    {selected ? <View style={styles.goalCheckInner} /> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      );
    }

    return (
      <View style={styles.stepSection}>
        <Text style={styles.titleLeft}>Privacy and Security</Text>
        <Text style={styles.subtitleLeft}>
          You control your data. We keep Journal.IO supportive and privacy-first.
        </Text>

        <View style={styles.privacyInfoList}>
          <Animated.View style={animatedRevealStyle(1)}>
            <View style={styles.privacyInfoCard}>
              <View style={styles.privacyHeaderRow}>
                <Shield color="#8E4636" size={16} strokeWidth={2} />
                <Text style={styles.privacyInfoTitle}>Your Data, Your Control</Text>
              </View>
              <Text style={styles.privacyInfoDescription}>
                Export or delete your journal data from settings whenever you want.
              </Text>
            </View>
          </Animated.View>
          <Animated.View style={animatedRevealStyle(2)}>
            <View style={styles.privacyInfoCard}>
              <View style={styles.privacyHeaderRow}>
                <ShieldOff color="#8E4636" size={16} strokeWidth={2} />
                <Text style={styles.privacyInfoTitle}>No Data Selling</Text>
              </View>
              <Text style={styles.privacyInfoDescription}>
                Your journal content and personal data are never sold to third parties.
              </Text>
            </View>
          </Animated.View>
          <Animated.View style={animatedRevealStyle(3)}>
            <View style={styles.privacyInfoCard}>
              <View style={styles.privacyHeaderRow}>
                <Download color="#8E4636" size={16} strokeWidth={2} />
                <Text style={styles.privacyInfoTitle}>Export Anytime</Text>
              </View>
              <Text style={styles.privacyInfoDescription}>
                Download your data whenever you need a personal backup.
              </Text>
            </View>
          </Animated.View>
        </View>

        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: agreedToPrivacy }}
          onPress={() => {
            setStepError(null);
            setAgreedToPrivacy(previous => !previous);
          }}
          style={styles.checkboxRow}
        >
          <View
            style={[styles.checkbox, agreedToPrivacy && styles.checkboxChecked]}
          >
            {agreedToPrivacy ? <Text style={styles.checkboxMark}>✓</Text> : null}
          </View>
          <Text style={styles.checkboxLabel}>
            I understand and agree to the privacy policy and terms of service.
          </Text>
        </Pressable>
      </View>
    );
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.safeArea}>
      <View style={styles.screenContent}>
        <ScrollView
          bounces={false}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          <OnboardingProgressIndicator currentStep={step} totalSteps={totalSteps} />

          <Animated.View
            style={{
              opacity: stepOpacity,
              transform: [{ translateX: stepTranslateX }],
            }}
          >
            {renderStepContent()}
          </Animated.View>
        </ScrollView>

        <View style={styles.actionsContainer}>
          {stepError ? <Text style={styles.errorText}>{stepError}</Text> : null}

          <View style={styles.actionsRow}>
            {step > 1 ? (
              <View style={styles.actionSlot}>
                <Pressable
                  accessibilityRole="button"
                  onPress={goBack}
                  style={({ pressed }) => [
                    styles.secondaryButton,
                    pressed && styles.secondaryButtonPressed,
                  ]}
                >
                  <Text style={styles.secondaryButtonText}>Back</Text>
                </Pressable>
              </View>
            ) : null}

            <Animated.View
              style={[
                styles.actionSlot,
                styles.primaryButton,
                { backgroundColor: primaryButtonBackgroundColor },
              ]}
            >
              <Pressable
                accessibilityRole="button"
                disabled={isCompleting || !canProceed}
                onPress={handleContinue}
                style={({ pressed }) => [
                  styles.primaryButtonInner,
                  (pressed || isCompleting) && canProceed && styles.primaryButtonPressed,
                ]}
              >
                {isCompleting ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={[styles.primaryButtonText, !canProceed && styles.primaryButtonTextDisabled]}>
                    {isLastStep ? 'Get Started' : 'Continue'}
                  </Text>
                )}
              </Pressable>
            </Animated.View>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#F6F7F2',
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
    paddingBottom: 18,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  screenContent: {
    flex: 1,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  heroCircle: {
    alignItems: 'center',
    backgroundColor: '#F3D8D0',
    borderRadius: 999,
    height: 94,
    justifyContent: 'center',
    marginTop: 20,
    width: 94,
  },
  title: {
    color: '#1C221B',
    fontSize: 30,
    fontWeight: '600',
    textAlign: 'center',
  },
  subtitle: {
    color: '#556055',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 10,
    maxWidth: 320,
    textAlign: 'center',
  },
  valuesSection: {
    gap: 12,
    marginBottom: 28,
  },
  stepSection: {
    flex: 1,
    marginBottom: 24,
  },
  titleLeft: {
    color: '#1C221B',
    fontSize: 28,
    fontWeight: '600',
  },
  subtitleLeft: {
    color: '#556055',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
    marginBottom: 16,
  },
  goalList: {
    gap: 12,
  },
  goalOption: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E8DF',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  goalOptionSelected: {
    backgroundColor: '#F9ECE8',
    borderColor: '#E88B73',
  },
  goalOptionPressed: {
    borderColor: '#E88B73',
  },
  goalOptionScaled: {
    transform: [{ scale: 0.985 }],
  },
  goalText: {
    color: '#1C221B',
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
  },
  goalTextSelected: {
    color: '#8E4636',
    fontWeight: '600',
  },
  goalIconWrap: {
    alignItems: 'center',
    backgroundColor: '#EEF0EA',
    borderRadius: 10,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  goalIconWrapSelected: {
    backgroundColor: '#F3D8D0',
  },
  goalCheck: {
    alignItems: 'center',
    borderColor: '#C6CCC0',
    borderRadius: 999,
    borderWidth: 1.5,
    height: 20,
    justifyContent: 'center',
    width: 20,
  },
  goalCheckSelected: {
    backgroundColor: '#E88B73',
    borderColor: '#E88B73',
  },
  goalCheckInner: {
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    height: 8,
    width: 8,
  },
  privacyInfoList: {
    gap: 10,
    marginBottom: 16,
  },
  privacyInfoCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E8DF',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  privacyInfoTitle: {
    color: '#1C221B',
    fontSize: 15,
    fontWeight: '600',
  },
  privacyHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  privacyInfoDescription: {
    color: '#556055',
    fontSize: 13,
    lineHeight: 19,
  },
  checkboxRow: {
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E8DF',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 14,
  },
  checkbox: {
    alignItems: 'center',
    borderColor: '#B6BDAF',
    borderRadius: 6,
    borderWidth: 1,
    height: 20,
    justifyContent: 'center',
    width: 20,
  },
  checkboxChecked: {
    backgroundColor: '#E88B73',
    borderColor: '#E88B73',
  },
  checkboxMark: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  checkboxLabel: {
    color: '#2E332D',
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
  errorText: {
    color: '#C05A4A',
    fontSize: 13,
    marginBottom: 12,
  },
  actionsContainer: {
    paddingBottom: 8,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionSlot: {
    flex: 1,
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#D3D9CB',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  secondaryButtonPressed: {
    backgroundColor: '#F0F3EA',
  },
  secondaryButtonText: {
    color: '#2E332D',
    fontSize: 16,
    fontWeight: '600',
  },
  primaryButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  primaryButtonInner: {
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  primaryButtonPressed: {
    opacity: 0.85,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  primaryButtonTextDisabled: {
    color: '#F6ECE8',
  },
});
