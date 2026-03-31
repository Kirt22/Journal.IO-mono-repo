import { useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "../../infrastructure/reactNative";
import {
  ArrowLeft,
  BookHeart,
  Camera,
  Check,
  Mail,
  User,
} from "lucide-react-native";
import { useWindowDimensions } from "react-native";
import { Alert, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Path, Svg } from "react-native-svg";
import PrimaryButton from "../../components/PrimaryButton";
import type { OnboardingCompletionData } from "../onboarding/OnboardingScreen";
import { useTheme } from "../../theme/provider";

type SetupProfilePayload = {
  name: string;
  avatarColor: string;
};

type SetupProfileScreenProps = {
  authEmail: string;
  authSource: "email" | "google";
  onboardingContext: OnboardingCompletionData | null;
  initialName?: string;
  onComplete: (payload: SetupProfilePayload) => Promise<void>;
  onBack: () => void;
  onSkip: () => Promise<void>;
};

const avatarColors = [
  "#E07A5F",
  "#F2A65A",
  "#E9C46A",
  "#2F7A5D",
  "#2A9D8F",
  "#4C8BBF",
  "#6C63FF",
  "#B56576",
  "#D66BA0",
  "#8E4636",
  "#3A7CA5",
  "#5E8C61",
];

export default function SetupProfileScreen({
  authEmail,
  authSource,
  initialName = "",
  onComplete,
  onBack,
  onSkip,
}: SetupProfileScreenProps) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const [name, setName] = useState(initialName);
  const [selectedColor, setSelectedColor] = useState(avatarColors[8]);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isCompact = width < 360;
  const isWide = width >= 430;
  const horizontalPadding = isCompact ? 16 : isWide ? 28 : 24;
  const sheetMaxWidth = isWide ? 460 : 420;
  const titleSize = isCompact ? 24 : isWide ? 30 : 28;
  const avatarSize = isCompact ? 84 : isWide ? 108 : 96;
  const avatarInitialSize = isCompact ? 24 : isWide ? 30 : 28;
  const colorSwatchSize = isCompact ? 30 : isWide ? 38 : 34;
  const titleBottomSpacing = isCompact ? 6 : 8;

  const initials = useMemo(() => {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    return parts.length
      ? parts
          .map(part => part[0])
          .join("")
          .slice(0, 2)
          .toUpperCase()
      : "?";
  }, [name]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    if (name.trim().length < 2) {
      setError("Name must be at least 2 characters.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onComplete({
        name: name.trim(),
        avatarColor: selectedColor,
      });
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Unable to save your profile."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      await onSkip();
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Unable to continue without a name."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePickAvatar = async () => {
    const imagePickerModule = require("react-native-image-picker") as
      | { launchImageLibrary?: typeof import("react-native-image-picker").launchImageLibrary }
      | null;
    const launchImageLibrary = imagePickerModule?.launchImageLibrary;

    if (!launchImageLibrary) {
      Alert.alert("Photo selection", "Photo picking is not available on this device.");
      return;
    }

    const result = await launchImageLibrary({
      mediaType: "photo",
      selectionLimit: 1,
      quality: 1,
      includeBase64: false,
    });

    if (result.didCancel) {
      return;
    }

    const selectedAsset = result.assets?.[0];
    if (!selectedAsset?.uri) {
      Alert.alert("Photo selection", "Unable to select this photo.");
      return;
    }

    setAvatarUri(selectedAsset.uri);
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingHorizontal: horizontalPadding },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.sheet, { maxWidth: sheetMaxWidth }]}>
            <Pressable onPress={onBack} style={styles.backLink}>
              <ArrowLeft color={theme.colors.mutedForeground} size={18} />
              <Text style={[styles.backText, { color: theme.colors.mutedForeground }]}>Back</Text>
            </Pressable>

            <View style={styles.hero}>
              <Text style={[styles.title, { fontSize: titleSize, color: theme.colors.foreground }]}>
                Set up your profile
              </Text>
              <Text
                style={[
                  styles.subtitle,
                  { marginTop: titleBottomSpacing, color: theme.colors.mutedForeground },
                ]}
              >
                {authSource === "google"
                  ? "Almost there. Confirm your details."
                  : "Let's get to know you a little."}
              </Text>
            </View>

            <View style={styles.avatarShell}>
              <Pressable
                accessibilityRole="button"
                onPress={handlePickAvatar}
                style={[styles.avatarWrap, { width: avatarSize, height: avatarSize }]}
              >
                <View
                  style={[
                    styles.avatar,
                    {
                      backgroundColor: selectedColor,
                      width: avatarSize,
                      height: avatarSize,
                    },
                  ]}
                >
                  {avatarUri ? (
                    <Image
                      source={{ uri: avatarUri }}
                      style={styles.avatarImage}
                      resizeMode="cover"
                    />
                  ) : name.trim() ? (
                    <Text style={[styles.avatarInitials, { fontSize: avatarInitialSize }]}>
                      {initials}
                    </Text>
                  ) : (
                    <User color="#FFFFFF" size={30} />
                  )}
                </View>
                <Pressable
                  accessibilityRole="button"
                  onPress={handlePickAvatar}
                  style={[
                    styles.cameraButton,
                    {
                      backgroundColor: theme.colors.card,
                      borderColor: theme.colors.background,
                    },
                  ]}
                >
                  <Camera color={theme.colors.mutedForeground} size={14} />
                </Pressable>
              </Pressable>
            </View>

            <View style={styles.colorSection}>
              <Text style={[styles.sectionLabel, { color: theme.colors.mutedForeground }]}>
                Avatar color
              </Text>
              <View style={styles.colorGrid}>
                {avatarColors.map(color => {
                  const selected = color === selectedColor;

                  return (
                    <Pressable
                      key={color}
                      accessibilityRole="button"
                      onPress={() => {
                        setSelectedColor(color);
                        if (error) {
                          setError(null);
                        }
                      }}
                      style={({ pressed }: { pressed: boolean }) => [
                        styles.colorSwatch,
                        {
                          backgroundColor: color,
                          width: colorSwatchSize,
                          height: colorSwatchSize,
                        },
                        selected && styles.colorSwatchSelected,
                        pressed && styles.pressed,
                      ]}
                    >
                      {selected ? <Check color="#FFFFFF" size={14} /> : null}
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.formSection}>
              <Text style={[styles.inputLabel, { color: theme.colors.foreground }]}>
                Display name
              </Text>
              <TextInput
                value={name}
                onChangeText={(value: string) => {
                  setName(value.slice(0, 30));
                  if (error) {
                    setError(null);
                  }
                }}
                placeholder="How should we call you?"
                placeholderTextColor={theme.colors.mutedForeground}
                autoCapitalize="words"
                textContentType="name"
                autoFocus={!initialName}
                editable={!isSubmitting}
                style={[
                  styles.input,
                  {
                    borderColor: error ? theme.colors.destructive : theme.colors.border,
                    backgroundColor: theme.colors.inputBackground,
                    color: theme.colors.foreground,
                  },
                ]}
              />
              <View style={styles.inputMetaRow}>
                {error ? (
                  <Text style={[styles.inputErrorText, { color: theme.colors.destructive }]}>
                    {error}
                  </Text>
                ) : (
                  <Text />
                )}
                <Text style={[styles.characterCount, { color: theme.colors.mutedForeground }]}>
                  {name.length}/30
                </Text>
              </View>

              <View style={[styles.connectionCard, { backgroundColor: theme.colors.accent }]}>
                <View style={styles.connectionIconWrap}>
                  {authSource === "google" ? (
                    <GoogleMark />
                  ) : (
                    <Mail color={theme.colors.primary} size={16} />
                  )}
                </View>
                <View style={styles.connectionCopyWrap}>
                  <Text style={[styles.connectionLabel, { color: theme.colors.mutedForeground }]}>
                    {authSource === "google" ? "Google connected" : "Email verified"}
                  </Text>
                  <Text style={[styles.connectionValue, { color: theme.colors.foreground }]}>
                    {authEmail}
                  </Text>
                </View>
                <Check color={theme.colors.success} size={16} />
              </View>

              <PrimaryButton
                label={isSubmitting ? "Creating account..." : "Start Journaling"}
                onPress={handleSubmit}
                loading={isSubmitting}
                disabled={isSubmitting}
                icon={<BookHeart color="#FFFFFF" size={16} strokeWidth={2} />}
                tone="accent"
              />
            </View>

            <View style={styles.skipWrap}>
              <Pressable
                onPress={handleSkip}
                style={({ pressed }: { pressed: boolean }) => [
                  styles.skipButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.skipText, { color: theme.colors.mutedForeground }]}>
                  Skip for now
                </Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  content: {
    paddingTop: 16,
    paddingBottom: 32,
    flexGrow: 1,
  },
  sheet: {
    width: "100%",
    alignSelf: "center",
  },
  backLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    marginBottom: 10,
    paddingVertical: 8,
  },
  backText: {
    fontSize: 14,
    fontWeight: "600",
  },
  hero: {
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: "600",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  avatarShell: {
    alignItems: "center",
    marginBottom: 26,
  },
  avatarWrap: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  avatar: {
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarInitials: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "700",
  },
  cameraButton: {
    width: 32,
    height: 32,
    borderRadius: 999,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    position: "absolute",
    right: -2,
    bottom: -2,
    zIndex: 2,
  },
  colorSection: {
    marginBottom: 28,
  },
  formSection: {
    width: "100%",
  },
  sectionLabel: {
    fontSize: 12,
    textAlign: "center",
    marginBottom: 12,
    fontWeight: "600",
  },
  inputLabel: {
    fontSize: 14,
    marginBottom: 8,
    fontWeight: "600",
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  inputMetaRow: {
    marginTop: 6,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 16,
  },
  inputErrorText: {
    fontSize: 12,
  },
  characterCount: {
    fontSize: 12,
  },
  colorGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
  },
  colorSwatch: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  colorSwatchSelected: {
    borderWidth: 2,
    borderColor: "#1C221B",
    transform: [{ scale: 1.08 }],
  },
  connectionCard: {
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  connectionIconWrap: {
    width: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  connectionCopyWrap: {
    flex: 1,
  },
  connectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 4,
  },
  connectionValue: {
    fontSize: 15,
    fontWeight: "600",
  },
  skipWrap: {
    alignItems: "center",
    marginTop: 12,
  },
  skipButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  skipText: {
    fontSize: 14,
    fontWeight: "500",
  },
  pressed: {
    opacity: 0.8,
  },
});

function GoogleMark() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z"
        fill="#4285F4"
      />
      <Path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23Z"
        fill="#34A853"
      />
      <Path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.78.43 3.45 1.18 4.93l2.85-2.22.81-.62Z"
        fill="#FBBC05"
      />
      <Path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53Z"
        fill="#EA4335"
      />
    </Svg>
  );
}
