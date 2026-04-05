import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import {
  Check,
  ChevronDown,
  Download,
  LogOut,
  Moon,
  Shield,
  Trash2,
} from "lucide-react-native";
import PrimaryButton from "../../components/PrimaryButton";
import { updateAiOptOutPreference } from "../../services/privacyService";
import { useAppStore } from "../../store/appStore";
import { useTheme } from "../../theme/provider";
import { ProfileSectionLayout, SectionCard } from "./ProfileSectionLayout";
import type { ThemeMode } from "../../theme/theme";

type SettingsScreenProps = {
  onBack: () => void;
  onOpenPrivacy: () => void;
  onSignOut: () => Promise<void> | void;
  currentThemePreference: ThemeMode | "system";
  onToggleTheme: (nextMode: ThemeMode | null) => void;
};

const themeOptions: Array<{
  label: string;
  value: ThemeMode | "system";
}> = [
  { label: "Light", value: "light" },
  { label: "Dark", value: "dark" },
  { label: "System", value: "system" },
];

function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace("#", "");

  if (normalized.length !== 6) {
    return hex;
  }

  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function SettingRow({
  label,
  description,
  value,
  onValueChange,
  disabled = false,
}: {
  label: string;
  description: string;
  value: boolean;
  onValueChange: (nextValue: boolean) => void;
  disabled?: boolean;
}) {
  const theme = useTheme();

  return (
    <View style={styles.settingRow}>
      <View style={styles.settingCopy}>
        <Text style={[styles.settingLabel, { color: theme.colors.foreground }]}>
          {label}
        </Text>
        <Text style={[styles.settingDescription, { color: theme.colors.mutedForeground }]}>
          {description}
        </Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
        thumbColor={theme.colors.card}
      />
    </View>
  );
}

export default function SettingsScreen({
  onBack,
  onOpenPrivacy,
  onSignOut,
  currentThemePreference,
  onToggleTheme,
}: SettingsScreenProps) {
  const theme = useTheme();
  const isPrivacyModeEnabled = useAppStore(
    state => state.session?.user.aiOptIn === false
  );
  const hideJournalPreviews = useAppStore(state => state.hideJournalPreviews);
  const setHideJournalPreviews = useAppStore(
    state => state.setHideJournalPreviews
  );
  const setSessionAiOptIn = useAppStore(state => state.setSessionAiOptIn);
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const [isThemeMenuRendered, setIsThemeMenuRendered] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isUpdatingPrivacyMode, setIsUpdatingPrivacyMode] = useState(false);
  const [isUpdatingPreviewPrivacy, setIsUpdatingPreviewPrivacy] = useState(false);
  const themeMenuAnimation = useRef(new Animated.Value(0)).current;
  const privacyDescriptionAnimation = useRef(new Animated.Value(1)).current;
  const privacyModeDescription = isPrivacyModeEnabled
    ? "AI reflections are off. Home and Insights AI surfaces stay hidden for this account."
    : "Turn off AI reflections and weekly analysis for this account.";

  const themeLabel = useMemo(
    () =>
      themeOptions.find(option => option.value === currentThemePreference)?.label ||
      "System",
    [currentThemePreference]
  );

  const handleSelectTheme = (nextMode: ThemeMode | "system") => {
    if (nextMode === "system") {
      onToggleTheme(null);
    } else {
      onToggleTheme(nextMode);
    }

    setIsThemeMenuOpen(false);
  };

  useEffect(() => {
    if (isThemeMenuOpen) {
      setIsThemeMenuRendered(true);
      Animated.timing(themeMenuAnimation, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      return;
    }

    Animated.timing(themeMenuAnimation, {
      toValue: 0,
      duration: 150,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setIsThemeMenuRendered(false);
      }
    });
  }, [isThemeMenuOpen, themeMenuAnimation]);

  useEffect(() => {
    privacyDescriptionAnimation.stopAnimation();
    privacyDescriptionAnimation.setValue(0);

    Animated.timing(privacyDescriptionAnimation, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [isPrivacyModeEnabled, privacyDescriptionAnimation]);

  const handleLogout = async () => {
    setIsSigningOut(true);

    try {
      await onSignOut();
    } catch (error) {
      Alert.alert(
        "Sign out",
        error instanceof Error ? error.message : "Unable to sign out right now."
      );
    } finally {
      setIsSigningOut(false);
    }
  };

  const handleExport = () => {
    onOpenPrivacy();
  };

  const handlePrivacyModeChange = async (nextValue: boolean) => {
    if (isUpdatingPrivacyMode) {
      return;
    }

    setIsUpdatingPrivacyMode(true);

    try {
      const result = await updateAiOptOutPreference(nextValue);
      setSessionAiOptIn(result.aiOptIn);
    } catch (error) {
      Alert.alert(
        "Privacy mode",
        error instanceof Error
          ? error.message
          : "Unable to update your AI privacy preference right now."
      );
    } finally {
      setIsUpdatingPrivacyMode(false);
    }
  };

  const handlePreviewPrivacyChange = async (nextValue: boolean) => {
    if (isUpdatingPreviewPrivacy) {
      return;
    }

    setIsUpdatingPreviewPrivacy(true);

    try {
      await setHideJournalPreviews(nextValue);
    } catch (error) {
      Alert.alert(
        "Hide journal previews",
        error instanceof Error
          ? error.message
          : "Unable to update this device privacy setting right now."
      );
    } finally {
      setIsUpdatingPreviewPrivacy(false);
    }
  };

  return (
    <ProfileSectionLayout
      title="Settings"
      onBack={onBack}
      backgroundTintColor={hexToRgba(theme.colors.primary, 0.022)}
    >
      <SectionCard style={styles.dropdownCard}>
        <View style={styles.sectionHeader}>
          <Moon size={20} color={theme.colors.primary} />
          <Text style={[styles.sectionTitle, { color: theme.colors.foreground }]}>
            Appearance
          </Text>
        </View>
        <Text style={[styles.sectionSubtitle, { color: theme.colors.mutedForeground }]}>
          Customize how Journal.IO looks
        </Text>

        <View style={styles.selectGroup}>
          <Text style={[styles.selectLabel, { color: theme.colors.foreground }]}>
            Theme
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => setIsThemeMenuOpen(next => !next)}
            style={({ pressed }) => [
              styles.selectTrigger,
              {
                backgroundColor: theme.colors.accent,
                borderColor: theme.colors.border,
              },
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.selectTriggerText, { color: theme.colors.foreground }]}>
              {themeLabel}
            </Text>
            <ChevronDown
              size={16}
              color={theme.colors.mutedForeground}
              style={[
                styles.chevron,
                isThemeMenuOpen ? styles.chevronOpen : null,
              ]}
            />
          </Pressable>

          {isThemeMenuRendered ? (
            <Animated.View
              pointerEvents={isThemeMenuOpen ? "auto" : "none"}
              style={[
                styles.selectMenu,
                {
                  backgroundColor: theme.colors.card,
                  borderColor: theme.colors.border,
                  opacity: themeMenuAnimation,
                  transform: [
                    {
                      translateY: themeMenuAnimation.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-6, 0],
                      }),
                    },
                    {
                      scale: themeMenuAnimation.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.98, 1],
                      }),
                    },
                  ],
                },
              ]}
            >
              {themeOptions.map(option => {
                const isSelected = option.value === currentThemePreference;

                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="button"
                    onPress={() => handleSelectTheme(option.value)}
                    style={({ pressed }) => [
                      styles.selectOption,
                      {
                        backgroundColor: isSelected
                          ? hexToRgba(theme.colors.primary, 0.08)
                          : "transparent",
                        borderColor: isSelected
                          ? theme.colors.primary
                          : "transparent",
                      },
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.selectOptionText,
                        {
                          color: isSelected
                            ? theme.colors.primary
                            : theme.colors.foreground,
                        },
                      ]}
                    >
                      {option.label}
                    </Text>
                    {isSelected ? (
                      <Check size={16} color={theme.colors.primary} />
                    ) : null}
                  </Pressable>
                );
              })}
            </Animated.View>
          ) : null}
        </View>
      </SectionCard>

      <SectionCard>
        <View style={styles.sectionHeader}>
          <Shield size={20} color={theme.colors.primary} />
          <Text style={[styles.sectionTitle, { color: theme.colors.foreground }]}>
            Privacy & Security
          </Text>
        </View>
        <Text style={[styles.sectionSubtitle, { color: theme.colors.mutedForeground }]}>
          Protect your journal
        </Text>

        <View style={styles.rowStack}>
          <View style={styles.settingRow}>
            <View style={styles.settingCopy}>
              <Text style={[styles.settingLabel, { color: theme.colors.foreground }]}>
                Privacy Mode
              </Text>
              <Animated.Text
                style={[
                  styles.settingDescription,
                  {
                    color: theme.colors.mutedForeground,
                    opacity: privacyDescriptionAnimation,
                    transform: [
                      {
                        translateY: privacyDescriptionAnimation.interpolate({
                          inputRange: [0, 1],
                          outputRange: [6, 0],
                        }),
                      },
                    ],
                  },
                ]}
              >
                {privacyModeDescription}
              </Animated.Text>
            </View>
            <Switch
              value={isPrivacyModeEnabled}
              onValueChange={handlePrivacyModeChange}
              disabled={isUpdatingPrivacyMode}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
              thumbColor={theme.colors.card}
            />
          </View>
          <SettingRow
            label="Hide Journal Previews"
            description="Mask journal titles, text, and tags in entry lists on this device."
            value={hideJournalPreviews}
            onValueChange={handlePreviewPrivacyChange}
            disabled={isUpdatingPreviewPrivacy}
          />
        </View>

        <PrimaryButton
          label="View Privacy Policy"
          onPress={onOpenPrivacy}
          variant="outline"
          size="sm"
        />
      </SectionCard>

      <SectionCard>
        <View style={styles.sectionHeader}>
          <Download size={20} color={theme.colors.primary} />
          <Text style={[styles.sectionTitle, { color: theme.colors.foreground }]}>
            Data Management
          </Text>
        </View>
        <Text style={[styles.sectionSubtitle, { color: theme.colors.mutedForeground }]}>
          Export or delete your data
        </Text>

        <View style={styles.buttonStack}>
          <PrimaryButton
            label="Export All Entries"
            onPress={handleExport}
            variant="outline"
            icon={<Download size={15} color={theme.colors.primary} />}
            size="sm"
          />

          <PrimaryButton
            label="Delete Account"
            onPress={onOpenPrivacy}
            variant="outline"
            icon={<Trash2 size={15} color={theme.colors.destructive} />}
            size="sm"
          />
        </View>
      </SectionCard>

      <SectionCard>
        <Text style={[styles.sectionTitle, { color: theme.colors.foreground }]}>
          Account
        </Text>

        <Pressable
          accessibilityRole="button"
          onPress={() => {
            Alert.alert("Sign out of Journal.IO?", "You can always sign back in at any time.", [
              { text: "Cancel", style: "cancel" },
              {
                text: "Sign Out",
                style: "destructive",
                onPress: handleLogout,
              },
            ]);
          }}
          style={({ pressed }) => [
            styles.signOutButton,
            {
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.card,
            },
            pressed && styles.pressed,
          ]}
        >
          <LogOut size={16} color={theme.colors.destructive} />
          <Text style={[styles.signOutText, { color: theme.colors.destructive }]}>
            {isSigningOut ? "Signing Out..." : "Sign Out"}
          </Text>
        </Pressable>
      </SectionCard>

      <View style={styles.appInfo}>
        <Text style={[styles.appName, { color: theme.colors.foreground }]}>
          Journal.IO
        </Text>
        <Text style={[styles.appVersion, { color: theme.colors.mutedForeground }]}>
          Version 1.0.0
        </Text>
      </View>
    </ProfileSectionLayout>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "600",
  },
  sectionSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  selectGroup: {
    gap: 10,
    position: "relative",
  },
  selectLabel: {
    fontSize: 14,
    fontWeight: "500",
  },
  selectTrigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderRadius: 14,
    minHeight: 48,
    paddingHorizontal: 14,
  },
  selectTriggerText: {
    fontSize: 15,
    fontWeight: "500",
  },
  chevron: {
    transform: [{ rotate: "0deg" }],
  },
  chevronOpen: {
    transform: [{ rotate: "180deg" }],
  },
  selectMenu: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 72,
    borderWidth: 1,
    borderRadius: 16,
    padding: 8,
    gap: 8,
    zIndex: 20,
    elevation: 6,
    shadowColor: "#000000",
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  selectOption: {
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectOptionText: {
    fontSize: 14,
    fontWeight: "500",
  },
  rowStack: {
    gap: 14,
    marginBottom: 14,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  settingCopy: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: "500",
  },
  settingDescription: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
  },
  buttonStack: {
    gap: 8,
  },
  signOutButton: {
    width: "100%",
    borderRadius: 14,
    borderWidth: 1,
    minHeight: 48,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 10,
    marginTop: 16,
  },
  signOutText: {
    fontSize: 14,
    fontWeight: "600",
  },
  appInfo: {
    alignItems: "center",
    paddingVertical: 8,
  },
  appName: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 4,
  },
  appVersion: {
    fontSize: 12,
  },
  pressed: {
    opacity: 0.85,
  },
  dropdownCard: {
    zIndex: 20,
    elevation: 6,
  },
});
