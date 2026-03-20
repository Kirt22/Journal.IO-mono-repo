import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "../../infrastructure/reactNative";
import { BookHeart, ChevronDown, Phone } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Path, Svg } from "react-native-svg";
import { useWindowDimensions } from "react-native";
import PrimaryButton from "../../components/PrimaryButton";
import { useTheme } from "../../theme/provider";

type EnterPhoneScreenProps = {
  onSendCode: (phoneNumber: string) => Promise<void>;
  onGooglePress: () => void;
};

type CountryCode = {
  code: string;
  country: string;
  flag: string;
};

const countryCodes: CountryCode[] = [
  { code: "+1", country: "US", flag: "🇺🇸" },
  { code: "+44", country: "UK", flag: "🇬🇧" },
  { code: "+91", country: "IN", flag: "🇮🇳" },
  { code: "+61", country: "AU", flag: "🇦🇺" },
  { code: "+81", country: "JP", flag: "🇯🇵" },
  { code: "+49", country: "DE", flag: "🇩🇪" },
  { code: "+33", country: "FR", flag: "🇫🇷" },
  { code: "+55", country: "BR", flag: "🇧🇷" },
];

export function EnterPhoneScreen({
  onSendCode,
  onGooglePress,
}: EnterPhoneScreenProps) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [selectedCountry, setSelectedCountry] = useState(countryCodes[0]);
  const [showPicker, setShowPicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isCompact = width < 360;
  const isWide = width >= 430;
  const horizontalPadding = isCompact ? 16 : isWide ? 28 : 24;
  const sheetMaxWidth = isWide ? 460 : 420;
  const sheetOffset = isCompact ? -16 : -40;
  const heroTitleSize = isCompact ? 24 : isWide ? 30 : 27;
  const heroIconSize = isCompact ? 64 : 72;
  const heroIconRadius = isCompact ? 20 : 24;
  const countryPickerWidth = isCompact ? 92 : isWide ? 112 : 104;
  const phoneRowGap = isCompact ? 8 : 10;

  const handleTermsPress = () => {
    Alert.alert(
      "Terms and Conditions",
      "The Terms screen will be wired in a later slice."
    );
  };

  const handlePrivacyPress = () => {
    Alert.alert(
      "Privacy Policy",
      "The Privacy Policy screen will be wired in a later slice."
    );
  };

  const handleSubmit = async () => {
    const digits = phoneNumber.replace(/\D/g, "");

    if (!digits.length) {
      setError("Phone number is needed.");
      return;
    }

    if (digits.length < 7) {
      setError("Please enter a valid phone number.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onSendCode(`${selectedCountry.code}${digits}`);
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Unable to send the verification code."
      );
    } finally {
      setIsSubmitting(false);
    }
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
          <View
            style={[
              styles.sheet,
              { maxWidth: sheetMaxWidth, marginTop: sheetOffset },
            ]}
          >
            <View style={styles.hero}>
              <View
                style={[
                  styles.heroIcon,
                  { backgroundColor: theme.colors.accent },
                  {
                    width: heroIconSize,
                    height: heroIconSize,
                    borderRadius: heroIconRadius,
                  },
                ]}
              >
                <BookHeart color={theme.colors.primary} size={34} strokeWidth={2} />
              </View>
              <Text style={[styles.title, { fontSize: heroTitleSize, color: theme.colors.foreground }]}>
                Journal.IO
              </Text>
              <Text style={[styles.subtitle, { color: theme.colors.mutedForeground }]}>
                Your personal journaling companion.
              </Text>
            </View>

            <View style={styles.form}>
              <Text style={[styles.sectionLabel, { color: theme.colors.mutedForeground }]}>
                Phone number
              </Text>

              <View style={[styles.phoneRow, { gap: phoneRowGap }]}>
                <View style={[styles.countryPickerWrap, { width: countryPickerWidth }]}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setShowPicker(previous => !previous)}
                    style={({ pressed }) => [
                      styles.countryPicker,
                      {
                        borderColor: theme.colors.border,
                        backgroundColor: theme.colors.inputBackground,
                      },
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.countryFlag}>
                      {selectedCountry.flag}
                    </Text>
                    <Text style={[styles.countryCode, { color: theme.colors.foreground }]}>
                      {selectedCountry.code}
                    </Text>
                    <ChevronDown color={theme.colors.mutedForeground} size={14} />
                  </Pressable>

                  {showPicker ? (
                    <ScrollView
                      style={[
                        styles.countryPickerMenu,
                        {
                          backgroundColor: theme.colors.card,
                          borderColor: theme.colors.border,
                        },
                      ]}
                      contentContainerStyle={styles.countryPickerMenuContent}
                      nestedScrollEnabled
                      keyboardShouldPersistTaps="handled"
                      showsVerticalScrollIndicator={false}
                    >
                      {countryCodes.map(country => (
                        <Pressable
                          key={`${country.code}-${country.country}`}
                          onPress={() => {
                            setSelectedCountry(country);
                            setShowPicker(false);
                          }}
                          style={({ pressed }) => [
                            styles.countryPickerItem,
                            pressed && styles.pressed,
                          ]}
                        >
                          <Text style={styles.countryPickerItemFlag}>
                            {country.flag}
                          </Text>
                          <Text style={[styles.countryPickerItemLabel, { color: theme.colors.foreground }]}>
                            {country.country}
                          </Text>
                          <Text style={[styles.countryPickerItemCode, { color: theme.colors.mutedForeground }]}>
                            {country.code}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  ) : null}
                </View>

                <View style={styles.phoneInputWrap}>
                  <TextInput
                    value={phoneNumber}
                    onChangeText={value => {
                      setPhoneNumber(value.replace(/\D/g, "").slice(0, 10));
                      if (error) {
                        setError(null);
                      }
                    }}
                    placeholder="(555) 123-4567"
                    placeholderTextColor={theme.colors.mutedForeground}
                    keyboardType="phone-pad"
                    textContentType="telephoneNumber"
                    autoFocus
                    style={[
                      styles.phoneInput,
                      {
                        borderColor: theme.colors.border,
                        backgroundColor: theme.colors.card,
                        color: theme.colors.foreground,
                      },
                    ]}
                  />
                </View>
              </View>

              {error ? (
                <Text style={[styles.error, { color: theme.colors.destructive }]}>{error}</Text>
              ) : null}

              <PrimaryButton
                label={isSubmitting ? "Sending code..." : "Continue with Phone"}
                onPress={handleSubmit}
                loading={isSubmitting}
                disabled={isSubmitting}
                icon={<Phone color="#FFFFFF" size={16} strokeWidth={2.1} />}
                tone="accent"
              />

              <View style={styles.divider}>
                <View style={[styles.rule, { backgroundColor: theme.colors.border }]} />
                <Text style={[styles.dividerText, { color: theme.colors.mutedForeground }]}>or</Text>
                <View style={[styles.rule, { backgroundColor: theme.colors.border }]} />
              </View>

              <PrimaryButton
                label="Continue with Google"
                onPress={onGooglePress}
                variant="outline"
                icon={<GoogleMark />}
              />

              <View style={styles.terms}>
                <Text style={[styles.termsText, { color: theme.colors.mutedForeground }]}>
                  By continuing, you agree to Journal.IO&apos;s{" "}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={handleTermsPress}
                  style={({ pressed }) => [
                    styles.termsButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.termsLink, { color: theme.colors.primary }]}>
                    Terms and Conditions
                  </Text>
                </Pressable>
                <Text style={[styles.termsText, { color: theme.colors.mutedForeground }]}>
                  {" "}
                  and{" "}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={handlePrivacyPress}
                  style={({ pressed }) => [
                    styles.termsButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.termsLink, { color: theme.colors.primary }]}>
                    Privacy Policy
                  </Text>
                </Pressable>
              </View>
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
    paddingVertical: 24,
    flexGrow: 1,
    justifyContent: "center",
  },
  sheet: {
    width: "100%",
    alignSelf: "center",
  },
  hero: {
    alignItems: "center",
    marginBottom: 28,
  },
  heroIcon: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: "#F3D8D0",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 27,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
  form: {
    width: "100%",
  },
  sectionLabel: {
    fontSize: 13,
    color: "#556055",
    marginBottom: 10,
    fontWeight: "600",
  },
  phoneRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    marginBottom: 12,
  },
  countryPickerWrap: {
    width: 104,
    position: "relative",
  },
  countryPicker: {
    height: 50,
    borderWidth: 1,
    borderColor: "#D7DCD2",
    borderRadius: 12,
    backgroundColor: "#F8F9F5",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 10,
  },
  countryFlag: {
    fontSize: 16,
  },
  countryCode: {
    fontSize: 14,
    fontWeight: "600",
  },
  countryPickerMenu: {
    position: "absolute",
    top: 56,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E8DF",
    borderRadius: 16,
    maxHeight: 280,
    zIndex: 20,
    overflow: "hidden",
    elevation: 6,
    shadowColor: "#000000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: {
      width: 0,
      height: 4,
    },
  },
  countryPickerMenuContent: {
    paddingVertical: 6,
  },
  countryPickerItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  countryPickerItemFlag: {
    width: 28,
  },
  countryPickerItemLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
  },
  countryPickerItemCode: {
    fontSize: 13,
  },
  phoneInputWrap: {
    flex: 1,
  },
  phoneInput: {
    height: 50,
    borderWidth: 1,
    borderColor: "#D7DCD2",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginVertical: 14,
  },
  rule: {
    flex: 1,
    height: 1,
    backgroundColor: "#E5E8DF",
  },
  dividerText: {
    fontSize: 12,
    fontWeight: "600",
  },
  terms: {
    marginTop: 14,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
    gap: 4,
  },
  termsText: {
    fontSize: 12,
    lineHeight: 18,
  },
  termsButton: {
    paddingVertical: 2,
  },
  termsLink: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  error: {
    marginBottom: 12,
    fontSize: 13,
  },
  pressed: {
    opacity: 0.85,
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

export default EnterPhoneScreen;
