import { useMemo, useState } from "react";
import {
  Alert,
  Image,
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
  User,
} from "lucide-react-native";
import { useWindowDimensions } from "react-native";
import { launchImageLibrary } from "react-native-image-picker";
import { SafeAreaView } from "react-native-safe-area-context";
import { Path, Svg } from "react-native-svg";
import PrimaryButton from "../../components/PrimaryButton";
import { useTheme } from "../../theme/provider";

type SetupProfilePayload = {
  name: string;
  avatarColor: string;
};

type SetupProfileScreenProps = {
  phoneNumber: string;
  selectedGoals: string[];
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
  phoneNumber,
  selectedGoals: _selectedGoals,
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
    const result = await launchImageLibrary({
      mediaType: "photo",
      selectionLimit: 1,
      quality: 0.85,
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
                Let&apos;s get to know you a little.
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
                      style={[
                        styles.colorSwatch,
                        {
                          backgroundColor: color,
                          width: colorSwatchSize,
                          height: colorSwatchSize,
                        },
                        selected && styles.colorSwatchSelected,
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
                onChangeText={value => {
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

              <View style={[styles.phoneCard, { backgroundColor: theme.colors.accent }]}>
                <View style={styles.phoneIconWrap}>
                  <PhoneVerifiedIcon color={theme.colors.mutedForeground} />
                </View>
                <View style={styles.phoneCopyWrap}>
                  <Text style={[styles.phoneCardLabel, { color: theme.colors.mutedForeground }]}>
                    Phone verified
                  </Text>
                  <Text style={[styles.phoneCardValue, { color: theme.colors.foreground }]}>
                    {phoneNumber}
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
                style={({ pressed }) => [
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
  phoneCard: {
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  phoneIconWrap: {
    width: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  phoneCopyWrap: {
    flex: 1,
  },
  phoneCardLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 4,
  },
  phoneCardValue: {
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

function PhoneVerifiedIcon({ color }: { color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9 3.8h6c1.22 0 2.2.98 2.2 2.2v12c0 1.22-.98 2.2-2.2 2.2H9c-1.22 0-2.2-.98-2.2-2.2V6c0-1.22.98-2.2 2.2-2.2Z"
        stroke={color}
        strokeWidth={1.8}
      />
      <Path d="M10.6 6.8h2.8" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Path d="M11.2 17.2h1.6" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Path
        d="m16.9 9.8 1.1 1.1 2.1-2.1"
        stroke="#6BAA75"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
