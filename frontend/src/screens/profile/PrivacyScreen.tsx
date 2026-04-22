import { useState } from "react";
import {
  Alert,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  Download,
  FileText,
  Lock,
  Shield,
  Trash2,
} from "lucide-react-native";
import PrimaryButton from "../../components/PrimaryButton";
import { trackPaywallEvent } from "../../services/paywallService";
import { deleteAccount, exportAllEntries } from "../../services/privacyService";
import { useAppStore } from "../../store/appStore";
import { useTheme } from "../../theme/provider";
import { LEGAL_URLS, SUPPORT_EMAIL, openExternalUrl } from "../../utils/legalLinks";
import { ProfileSectionLayout, SectionCard } from "./ProfileSectionLayout";

type PrivacyScreenProps = {
  onBack: () => void;
  onOpenExportPaywall: () => void;
  onSignOut: () => Promise<void> | void;
};

type PolicyItemProps = {
  title: string;
  body: string;
};

function PolicyItem({ title, body }: PolicyItemProps) {
  const theme = useTheme();

  return (
    <View style={styles.policyItem}>
      <Text style={[styles.policyItemTitle, { color: theme.colors.foreground }]}>
        {title}
      </Text>
      <Text style={[styles.policyItemBody, { color: theme.colors.mutedForeground }]}>
        {body}
      </Text>
    </View>
  );
}

export default function PrivacyScreen({
  onBack,
  onOpenExportPaywall,
  onSignOut,
}: PrivacyScreenProps) {
  const theme = useTheme();
  const isPremiumUser = useAppStore(state => Boolean(state.session?.user.isPremium));
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleOpenLink = async (
    url: string,
    title: string,
    fallbackMessage: string
  ) => {
    try {
      await openExternalUrl(url);
    } catch (error) {
      Alert.alert(title, error instanceof Error ? error.message : fallbackMessage);
    }
  };

  const handleOpenExportPaywall = () => {
    trackPaywallEvent({
      placementKey: "privacy_export_locked",
      screenKey: "privacy",
      eventType: "locked_feature_tap",
      wasInterruptive: false,
    }).catch(() => undefined);
    onOpenExportPaywall();
  };

  const handleExport = async () => {
    if (!isPremiumUser) {
      handleOpenExportPaywall();
      return;
    }

    setIsExporting(true);

    try {
      const exportData = await exportAllEntries();

      await Share.share({
        title: "Journal.IO export",
        message: JSON.stringify(exportData, null, 2),
      });
    } catch (error) {
      Alert.alert(
        "Export data",
        error instanceof Error ? error.message : "Unable to export your data right now."
      );
    } finally {
      setIsExporting(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);

    try {
      const result = await deleteAccount();

      if (!result.deletedAccount) {
        throw new Error("Unable to delete your account right now.");
      }

      await onSignOut();
    } catch (error) {
      Alert.alert(
        "Delete account",
        error instanceof Error ? error.message : "Unable to delete your account right now."
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <ProfileSectionLayout title="Privacy & Data" onBack={onBack}>
      <View style={styles.commitmentCard}>
        <View style={styles.commitmentIconWrap}>
          <Shield size={22} color={theme.colors.primary} />
        </View>
        <View style={styles.commitmentCopy}>
          <Text style={[styles.commitmentTitle, { color: theme.colors.foreground }]}>
            Your Privacy Matters
          </Text>
          <Text style={[styles.commitmentText, { color: theme.colors.mutedForeground }]}>
            Your journal entries are yours alone. We store your data securely and never share your
            personal thoughts with anyone.
          </Text>
        </View>
      </View>

      <SectionCard>
        <View style={styles.sectionHeader}>
          <Download size={18} color={theme.colors.primary} />
          <Text style={[styles.sectionTitle, { color: theme.colors.foreground }]}>
            Export Your Data
          </Text>
        </View>
        <Text style={[styles.sectionLead, { color: theme.colors.mutedForeground }]}>
          Download all your journal entries and data
        </Text>
        <Text style={[styles.sectionText, { color: theme.colors.mutedForeground }]}>
          {isPremiumUser
            ? "Get a complete copy of all your journal entries, mood data, and settings in JSON format."
            : "Premium unlocks full journal-data export in JSON format whenever you want a copy of your writing and settings."}
        </Text>
        {isPremiumUser ? (
          <PrimaryButton
            label={isExporting ? "Exporting..." : "Export All Data"}
            onPress={handleExport}
            disabled={isExporting}
            variant="outline"
            icon={<Download size={15} color={theme.colors.primary} />}
            size="sm"
          />
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Unlock export data"
            onPress={handleOpenExportPaywall}
            style={({ pressed }) => [
              styles.lockedExportButton,
              {
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.secondary,
              },
              pressed && styles.pressed,
            ]}
          >
            <View
              style={[
                styles.lockedExportBadge,
                { backgroundColor: `${theme.colors.primary}14` },
              ]}
            >
              <Lock size={13} color={theme.colors.primary} />
              <Text style={[styles.lockedExportBadgeText, { color: theme.colors.primary }]}>
                Premium
              </Text>
            </View>
            <Text style={[styles.lockedExportButtonText, { color: theme.colors.foreground }]}>
              Unlock Export Data
            </Text>
          </Pressable>
        )}
      </SectionCard>

      <SectionCard>
        <View style={styles.sectionHeader}>
          <FileText size={18} color={theme.colors.primary} />
          <Text style={[styles.sectionTitle, { color: theme.colors.foreground }]}>
            Privacy & Terms
          </Text>
        </View>
        <Text style={[styles.sectionLead, { color: theme.colors.mutedForeground }]}>
          Review the public legal pages linked from the app store listing and onboarding consent.
        </Text>

        <View style={styles.policyStack}>
          <PolicyItem
            title="Data Collection"
            body="We collect the account, journal, mood, reminder, and subscription information needed to run Journal.IO and protect the service."
          />
          <PolicyItem
            title="Data Usage"
            body="Your data is used solely to provide and improve the Journal.IO experience. We never sell your personal information or journal content to third parties."
          />
          <PolicyItem
            title="AI Processing"
            body="When eligible AI features are enabled, only the entry content and recent context needed for that feature are sent to the AI provider."
          />
          <PolicyItem
            title="Data Security"
            body="We use encrypted transport, account-level access checks, and secure storage controls designed to keep your writing isolated to your account."
          />
        </View>

        <View style={styles.legalActions}>
          <PrimaryButton
            label="Read Full Privacy Policy"
            onPress={() =>
              handleOpenLink(
                LEGAL_URLS.privacyPolicy,
                "Privacy Policy",
                "Unable to open the privacy policy right now."
              )
            }
            variant="outline"
            size="sm"
          />
          <PrimaryButton
            label="Read Terms of Service"
            onPress={() =>
              handleOpenLink(
                LEGAL_URLS.termsOfService,
                "Terms of Service",
                "Unable to open the terms of service right now."
              )
            }
            variant="outline"
            size="sm"
          />
          <PrimaryButton
            label="Privacy Choices & Deletion"
            onPress={() =>
              handleOpenLink(
                LEGAL_URLS.privacyChoices,
                "Privacy Choices",
                "Unable to open the privacy choices page right now."
              )
            }
            variant="outline"
            size="sm"
          />
        </View>
      </SectionCard>

      <SectionCard borderColor={theme.colors.destructive}>
        <View style={styles.sectionHeader}>
          <Trash2 size={18} color={theme.colors.destructive} />
          <Text style={[styles.sectionTitle, { color: theme.colors.destructive }]}>
            Delete Account
          </Text>
        </View>
        <Text style={[styles.sectionLead, { color: theme.colors.foreground }]}>
          Permanently delete your account and all data
        </Text>
        <Text style={[styles.sectionText, { color: theme.colors.mutedForeground }]}>
          This action cannot be undone. All your journal entries, mood data, and account information
          will be permanently deleted.
        </Text>

        <Pressable
          accessibilityRole="button"
          onPress={() => {
            Alert.alert(
              "Delete account?",
              "This will permanently remove your account and sign you out.",
              [
                { text: "Cancel", style: "cancel" },
                { text: "Delete", style: "destructive", onPress: handleDelete },
              ]
            );
          }}
          style={({ pressed }) => [
            styles.destructiveButton,
            {
              backgroundColor: theme.colors.destructive,
            },
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.destructiveButtonText, { color: theme.colors.destructiveForeground }]}>
            {isDeleting ? "Deleting..." : "Delete My Account"}
          </Text>
        </Pressable>
      </SectionCard>

      <View
        style={[
          styles.supportCard,
          {
            backgroundColor: theme.colors.secondary,
            borderColor: theme.colors.border,
          },
        ]}
      >
        <Text style={[styles.supportTitle, { color: theme.colors.foreground }]}>
          Have questions about your data?
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            void handleOpenLink(
              LEGAL_URLS.supportEmail,
              "Support",
              `Unable to open your email app right now. Contact ${SUPPORT_EMAIL}.`
            )
          }
          style={({ pressed }) => [
            styles.supportButton,
            {
              backgroundColor: theme.colors.secondary,
              borderColor: theme.colors.border,
            },
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.supportButtonText, { color: theme.colors.foreground }]}>
            Contact Support
          </Text>
        </Pressable>
      </View>
    </ProfileSectionLayout>
  );
}

const styles = StyleSheet.create({
  commitmentCard: {
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(232, 116, 97, 0.18)",
    backgroundColor: "rgba(232, 116, 97, 0.08)",
    flexDirection: "row",
    gap: 14,
  },
  commitmentIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(232, 116, 97, 0.12)",
  },
  commitmentCopy: {
    flex: 1,
    gap: 6,
  },
  commitmentTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  commitmentText: {
    fontSize: 13,
    lineHeight: 19,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "600",
  },
  sectionLead: {
    fontSize: 15,
    lineHeight: 21,
    marginBottom: 8,
  },
  sectionText: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 14,
  },
  policyStack: {
    gap: 14,
    marginBottom: 14,
  },
  legalActions: {
    gap: 10,
  },
  policyItem: {
    gap: 4,
  },
  policyItemTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  policyItemBody: {
    fontSize: 12,
    lineHeight: 17,
  },
  destructiveButton: {
    borderRadius: 14,
    paddingVertical: 11,
    alignItems: "center",
  },
  destructiveButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  lockedExportButton: {
    minHeight: 42,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  lockedExportBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  lockedExportBadgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  lockedExportButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  supportCard: {
    borderRadius: 22,
    padding: 16,
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
  },
  supportTitle: {
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
  },
  supportButton: {
    minWidth: 120,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
  },
  supportButtonText: {
    fontSize: 13,
    fontWeight: "500",
  },
  pressed: {
    opacity: 0.88,
  },
});
