import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import PrimaryButton from '../../components/PrimaryButton';
import { triggerHaptic } from '../../services/hapticsService';
import { updateProfile } from '../../services/userService';
import { useAppStore } from '../../store/appStore';
import { useTheme } from '../../theme/provider';
import { ProfileSectionLayout, SectionCard } from './ProfileSectionLayout';

type AboutYouScreenProps = {
  onBack: () => void;
};

const MAX_PROFILE_NAME_LENGTH = 60;

export default function AboutYouScreen({ onBack }: AboutYouScreenProps) {
  const theme = useTheme();
  const user = useAppStore(state => state.session?.user ?? null);
  const setSessionUserProfile = useAppStore(
    state => state.setSessionUserProfile,
  );
  const [name, setName] = useState(user?.name || '');
  const [isSaving, setIsSaving] = useState(false);
  const saveReveal = useRef(new Animated.Value(0)).current;
  const wasNameEdited = useRef(false);

  useEffect(() => {
    setName(user?.name || '');
  }, [user?.name]);

  const onboardingItems = useMemo(() => {
    const preferences = user?.onboardingPreferences;
    const values = [
      ['Age range', preferences?.ageRange],
      ['What brought you here', preferences?.whatBringsYouHere?.join(', ')],
      ['Support focus', preferences?.supportFocusAreas?.join(', ')],
      ['Reflection tone', preferences?.reflectionTone?.join(', ')],
      ['Journaling experience', preferences?.journalingExperience],
      ['Reminder preference', preferences?.reminderPreference],
    ];

    return values.filter(([, value]) => Boolean(value));
  }, [user?.onboardingPreferences]);

  const hasNameChanged = name.trim() !== (user?.name || '').trim();

  useEffect(() => {
    if (!hasNameChanged) {
      wasNameEdited.current = false;
      saveReveal.setValue(0);
      return;
    }

    if (wasNameEdited.current) {
      return;
    }

    wasNameEdited.current = true;
    saveReveal.setValue(0);
    triggerHaptic('optionSelected').catch(() => undefined);

    const animation = Animated.spring(saveReveal, {
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
  }, [hasNameChanged, saveReveal]);

  const handleSave = async () => {
    const trimmedName = name.trim();

    if (!trimmedName) {
      Alert.alert('Name required', 'Add a name before saving your profile.');
      return;
    }

    if (!user || trimmedName === user.name) {
      onBack();
      return;
    }

    setIsSaving(true);

    try {
      const updatedProfile = await updateProfile({
        name: trimmedName,
        avatarColor: user.avatarColor,
        goals: user.journalingGoals,
      });
      setSessionUserProfile(updatedProfile);
      onBack();
    } catch (error) {
      Alert.alert(
        'Update profile',
        error instanceof Error
          ? error.message
          : 'Unable to update your name right now.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ProfileSectionLayout title="About me" onBack={onBack}>
      <SectionCard>
        <Text style={[styles.fieldLabel, { color: theme.colors.foreground }]}>
          Name
        </Text>
        <TextInput
          accessibilityLabel="Your name"
          autoCapitalize="words"
          maxLength={MAX_PROFILE_NAME_LENGTH}
          onChangeText={setName}
          placeholder="Your name"
          placeholderTextColor={theme.colors.mutedForeground}
          style={[
            styles.nameInput,
            {
              backgroundColor: theme.colors.inputBackground,
              borderColor: theme.colors.border,
              color: theme.colors.foreground,
            },
          ]}
          value={name}
        />
        <Text
          accessibilityLabel={`${name.length} of ${MAX_PROFILE_NAME_LENGTH} characters used`}
          style={[
            styles.characterCount,
            { color: theme.colors.mutedForeground },
          ]}
        >
          {name.length}/{MAX_PROFILE_NAME_LENGTH}
        </Text>
        {hasNameChanged ? (
          <Animated.View
            style={{
              opacity: saveReveal,
              transform: [
                {
                  translateY: saveReveal.interpolate({
                    inputRange: [0, 1],
                    outputRange: [10, 0],
                  }),
                },
                {
                  scale: saveReveal.interpolate({
                    inputRange: [0, 0.72, 1],
                    outputRange: [0.94, 1.035, 1],
                  }),
                },
              ],
            }}
          >
            <PrimaryButton
              disabled={isSaving}
              label="Save name"
              loading={isSaving}
              onPress={handleSave}
              size="sm"
              tone="accent"
            />
          </Animated.View>
        ) : null}
      </SectionCard>

      <View style={styles.sectionHeading}>
        <Text style={[styles.heading, { color: theme.colors.foreground }]}>
          Your onboarding choices
        </Text>
        <Text style={[styles.caption, { color: theme.colors.mutedForeground }]}>
          These help Journal.IO keep your experience relevant.
        </Text>
      </View>

      {onboardingItems.length ? (
        <SectionCard style={styles.choicesCard}>
          {onboardingItems.map(([label, value], index) => (
            <View
              key={label}
              style={[
                styles.choiceRow,
                index > 0 && { borderTopColor: theme.colors.border },
              ]}
            >
              <Text
                style={[
                  styles.choiceLabel,
                  { color: theme.colors.mutedForeground },
                ]}
              >
                {label}
              </Text>
              <Text
                style={[styles.choiceValue, { color: theme.colors.foreground }]}
              >
                {value}
              </Text>
            </View>
          ))}
        </SectionCard>
      ) : (
        <SectionCard>
          <View style={styles.emptyState}>
            <Text
              style={[styles.emptyTitle, { color: theme.colors.foreground }]}
            >
              No onboarding choices saved yet
            </Text>
            <Text
              style={[
                styles.emptyText,
                { color: theme.colors.mutedForeground },
              ]}
            >
              When you choose personalisation options during onboarding, they
              will appear here.
            </Text>
          </View>
        </SectionCard>
      )}
    </ProfileSectionLayout>
  );
}

const styles = StyleSheet.create({
  fieldLabel: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 10,
  },
  nameInput: {
    borderRadius: 14,
    borderWidth: 1,
    fontSize: 17,
    marginBottom: 4,
    minHeight: 52,
    paddingHorizontal: 14,
  },
  characterCount: {
    alignSelf: 'flex-end',
    fontSize: 12,
    marginBottom: 14,
  },
  sectionHeading: {
    gap: 4,
    marginTop: 4,
  },
  heading: {
    fontSize: 17,
    fontWeight: '600',
  },
  caption: {
    fontSize: 14,
    lineHeight: 20,
  },
  choicesCard: {
    paddingVertical: 0,
  },
  choiceRow: {
    gap: 5,
    paddingVertical: 15,
  },
  choiceLabel: {
    fontSize: 13,
  },
  choiceValue: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 21,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
  },
  emptyState: {
    gap: 4,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
});
