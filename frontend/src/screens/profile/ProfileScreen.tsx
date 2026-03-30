import { useMemo, type ComponentType, type ReactNode } from "react";
import {
  Alert,
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import {
  Award,
  Calendar,
  ChevronRight,
  Crown,
  Phone,
  Shield,
  Settings,
  BookOpen,
} from "lucide-react-native";
import TabScreenLayout from "../../components/TabScreenLayout";
import { useTheme } from "../../theme/provider";

type ProfileScreenProps = {
  userName?: string;
  userEmail?: string | null;
  fallbackEmail?: string | null;
  userGoals?: string[];
  onboardingGoals?: string[];
  userAvatarColor?: string | null;
  userProfilePic?: string | null;
  onOpenStreaks?: () => void;
};

type MenuItem = {
  icon: ComponentType<any>;
  label: string;
  description: string;
  badge?: string | null;
};

type ContactItem = {
  label: string;
  description: string;
  phoneNumber: string;
};

const achievements = [
  { emoji: "🏆", label: "First Entry" },
  { emoji: "🔥", label: "7-Day Streak" },
  { emoji: "📝", label: "50 Entries" },
];

const menuItems: MenuItem[] = [
  {
    icon: Settings,
    label: "Settings",
    description: "Preferences and account",
  },
  {
    icon: Crown,
    label: "Subscription",
    description: "Manage your plan",
    badge: null,
  },
  {
    icon: Shield,
    label: "Privacy & Data",
    description: "Your data and privacy controls",
  },
];

const emergencyContacts: ContactItem[] = [
  {
    label: "988 Suicide & Crisis Lifeline",
    description: "Call or text 988 - available 24/7",
    phoneNumber: "988",
  },
  {
    label: "Crisis Text Line",
    description: "Text HOME to 741741",
    phoneNumber: "741741",
  },
  {
    label: "Emergency Services",
    description: "Call 911 for immediate help",
    phoneNumber: "911",
  },
];

const DUMMY_EMAIL = "hello@journal.io";

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

function getInitials(fullName: string) {
  const initials = fullName
    .trim()
    .split(/\s+/)
    .map(part => part[0])
    .join("")
    .toUpperCase();

  return initials.slice(0, 2) || "U";
}

function handleExternalPhoneAction(phoneNumber: string, label: string) {
  const telUrl = `tel:${phoneNumber}`;

  Linking.canOpenURL(telUrl)
    .then(canOpen => {
      if (canOpen) {
        return Linking.openURL(telUrl);
      }

      Alert.alert(label, `Call ${phoneNumber} from your phone dialer.`);
      return null;
    })
    .catch(() => {
      Alert.alert(label, `Call ${phoneNumber} from your phone dialer.`);
    });
}

function SectionCard({
  children,
  theme,
  elevated = false,
  borderColor,
}: {
  children: ReactNode;
  theme: ReturnType<typeof useTheme>;
  elevated?: boolean;
  borderColor?: string;
}) {
  return (
    <View
      style={[
        styles.sectionCard,
        {
          backgroundColor: theme.colors.card,
          borderColor: borderColor || theme.colors.border,
          shadowColor: theme.colors.foreground,
        },
        elevated ? styles.elevatedCard : null,
      ]}
    >
      {children}
    </View>
  );
}

function StatCard({
  icon,
  label,
  value,
  theme,
}: {
  icon: ComponentType<any>;
  label: string;
  value: string | number;
  theme: ReturnType<typeof useTheme>;
}) {
  const Icon = icon;

  return (
    <View
      style={[
        styles.statCard,
        {
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
        },
      ]}
    >
      <Icon size={20} color={theme.colors.primary} style={styles.statIcon} />
      <Text style={[styles.statValue, { color: theme.colors.foreground }]}>
        {value}
      </Text>
      <Text style={[styles.statLabel, { color: theme.colors.mutedForeground }]}>
        {label}
      </Text>
    </View>
  );
}

function MenuRow({
  icon,
  label,
  description,
  badge,
  theme,
  onPress,
}: MenuItem & {
  theme: ReturnType<typeof useTheme>;
  onPress: () => void;
}) {
  const Icon = icon;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }: { pressed: boolean }) => [
        styles.menuRow,
        {
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.card,
        },
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.menuIcon, { backgroundColor: theme.colors.accent }]}>
        <Icon size={20} color={theme.colors.foreground} />
      </View>
      <View style={styles.menuCopy}>
        <View style={styles.menuTitleRow}>
          <Text style={[styles.menuLabel, { color: theme.colors.foreground }]}>
            {label}
          </Text>
          {badge ? (
            <Text
              style={[
                styles.menuBadge,
                {
                  color: theme.colors.primary,
                  backgroundColor: hexToRgba(theme.colors.primary, 0.12),
                },
              ]}
            >
              {badge}
            </Text>
          ) : null}
        </View>
        <Text style={[styles.menuDescription, { color: theme.colors.mutedForeground }]}>
          {description}
        </Text>
      </View>
      <ChevronRight size={20} color={theme.colors.mutedForeground} />
    </Pressable>
  );
}

function ContactRow({
  label,
  description,
  phoneNumber,
  theme,
}: ContactItem & {
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => handleExternalPhoneAction(phoneNumber, label)}
      style={({ pressed }: { pressed: boolean }) => [
        styles.contactRow,
        {
          backgroundColor: theme.colors.accent,
        },
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.contactCopy}>
        <Text style={[styles.contactLabel, { color: theme.colors.foreground }]}>
          {label}
        </Text>
        <Text style={[styles.contactDescription, { color: theme.colors.mutedForeground }]}>
          {description}
        </Text>
      </View>
      <Phone size={18} color={theme.colors.mutedForeground} />
    </Pressable>
  );
}

export default function ProfileScreen({
  userName = "Journal User",
  userEmail,
  fallbackEmail,
  userGoals = [],
  onboardingGoals = [],
  userAvatarColor,
  userProfilePic,
  onOpenStreaks,
}: ProfileScreenProps) {
  const theme = useTheme();
  const { width } = useWindowDimensions();

  const isCompact = width < 360;
  const isWide = width >= 430;
  const horizontalPadding = isCompact ? 16 : isWide ? 28 : 24;
  const layoutMaxWidth = isWide ? 460 : 420;
  const avatarSize = isCompact ? 88 : isWide ? 104 : 96;
  const displayMonth = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        month: "short",
        year: "numeric",
      }).format(new Date()),
    []
  );

  const initials = useMemo(() => getInitials(userName), [userName]);
  const displayedEmail = userEmail || fallbackEmail || DUMMY_EMAIL;
  const displayedGoals = userGoals.length > 0 ? userGoals : onboardingGoals;
  const hasGoals = displayedGoals.length > 0;
  const showPremiumBanner = false;
  const accentColor = userAvatarColor || theme.colors.primary;
  const statCards = [
    { label: "Total Entries", value: 0, icon: BookOpen },
    { label: "Current Streak", value: "0 days", icon: Award },
    { label: "Member Since", value: displayMonth, icon: Calendar },
  ];

  return (
    <TabScreenLayout
      backgroundColor={theme.colors.background}
      horizontalPadding={horizontalPadding}
      layoutMaxWidth={layoutMaxWidth}
      shellStyle={styles.shell}
    >
      <View style={styles.heroSection}>
        <View style={styles.avatarWrap}>
          <View
            style={[
              styles.avatarShell,
              {
                width: avatarSize,
                height: avatarSize,
                backgroundColor: accentColor,
              },
            ]}
          >
            {userProfilePic ? (
              <Image
                source={{ uri: userProfilePic }}
                style={styles.avatarImage}
                resizeMode="cover"
              />
            ) : (
              <Text
                style={[
                  styles.avatarInitials,
                  isCompact
                    ? styles.avatarInitialsCompact
                    : isWide
                      ? styles.avatarInitialsWide
                      : styles.avatarInitialsDefault,
                ]}
              >
                {initials}
              </Text>
            )}
          </View>
        </View>

        <Text style={[styles.name, { color: theme.colors.foreground }]}>
          {userName}
        </Text>
        <Text style={[styles.email, { color: theme.colors.mutedForeground }]}>
          {displayedEmail}
        </Text>

        {showPremiumBanner ? (
          <View
            style={[
              styles.premiumBadge,
              {
                backgroundColor: theme.colors.primary,
              },
            ]}
          >
            <Crown size={14} color={theme.colors.primaryForeground} />
            <Text
              style={[styles.premiumBadgeText, { color: theme.colors.primaryForeground }]}
            >
              Premium Member
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.statsGrid}>
        {statCards.map(stat => (
          <StatCard
            key={stat.label}
            icon={stat.icon}
            label={stat.label}
            value={stat.value}
            theme={theme}
          />
        ))}
      </View>

      <SectionCard theme={theme}>
        <Text style={[styles.sectionTitle, { color: theme.colors.foreground }]}>
          Your Goals
        </Text>
        <Text style={[styles.sectionSubtitle, { color: theme.colors.mutedForeground }]}>
          What you&apos;re working towards
        </Text>
        <View style={styles.goalWrap}>
          {hasGoals ? (
            displayedGoals.map(goal => (
              <View
                key={goal}
                style={[
                  styles.goalPill,
                  {
                    backgroundColor: hexToRgba(theme.colors.primary, 0.1),
                  },
                ]}
              >
                <Text style={[styles.goalText, { color: theme.colors.primary }]}>
                  {goal}
                </Text>
              </View>
            ))
          ) : (
            <View
              style={[
                styles.goalEmptyState,
                { backgroundColor: theme.colors.accent },
              ]}
            >
              <Text
                style={[
                  styles.goalEmptyText,
                  { color: theme.colors.mutedForeground },
                ]}
              >
                Your onboarding goals will appear here once they&apos;re selected.
              </Text>
            </View>
          )}
        </View>
      </SectionCard>

      {!showPremiumBanner ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            Alert.alert(
              "Unlock Premium",
              "This surface is not connected yet in the mobile app."
            );
          }}
          style={({ pressed }: { pressed: boolean }) => [
            styles.upgradeBanner,
            { backgroundColor: theme.colors.primary },
            pressed && styles.pressed,
          ]}
        >
          <View style={styles.upgradeGlow} />
          <View style={styles.upgradeCopy}>
            <View style={styles.upgradeHeadingRow}>
              <Crown size={20} color={theme.colors.primaryForeground} />
              <Text style={[styles.upgradeTitle, { color: theme.colors.primaryForeground }]}>
                Unlock Premium
              </Text>
            </View>
            <Text style={[styles.upgradeText, { color: theme.colors.primaryForeground }]}>
              Get unlimited AI insights, advanced analytics, and more
            </Text>
            <View style={styles.upgradeCtaRow}>
              <Text style={[styles.upgradeCta, { color: theme.colors.primaryForeground }]}>
                Start your free trial
              </Text>
              <ChevronRight size={16} color={theme.colors.primaryForeground} />
            </View>
          </View>
        </Pressable>
      ) : null}

      <View style={styles.menuList}>
        {menuItems.map(item => (
          <MenuRow
            key={item.label}
            {...item}
            theme={theme}
            onPress={() => {
              Alert.alert(item.label, "This area is not connected yet.");
            }}
          />
        ))}
      </View>

      <SectionCard theme={theme}>
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: theme.colors.foreground }]}>
            Recent Achievements
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              if (onOpenStreaks) {
                onOpenStreaks();
                return;
              }

              Alert.alert("Streaks", "This area is not connected yet.");
            }}
            style={({ pressed }: { pressed: boolean }) => [
              styles.viewAllButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.viewAllText, { color: theme.colors.info }]}>
              View All
            </Text>
          </Pressable>
        </View>

        <View style={styles.achievementRow}>
          {achievements.map(achievement => (
            <View
              key={achievement.label}
              style={[
                styles.achievementCard,
                { backgroundColor: theme.colors.accent },
              ]}
            >
              <Text style={styles.achievementEmoji}>{achievement.emoji}</Text>
              <Text
                style={[
                  styles.achievementLabel,
                  { color: theme.colors.mutedForeground },
                ]}
              >
                {achievement.label}
              </Text>
            </View>
          ))}
        </View>
      </SectionCard>

      <SectionCard
        theme={theme}
        borderColor={hexToRgba(theme.colors.destructive, 0.3)}
      >
        <View style={styles.emergencyHeader}>
          <View
            style={[
              styles.emergencyIcon,
              { backgroundColor: hexToRgba(theme.colors.destructive, 0.12) },
            ]}
          >
            <Phone size={16} color={theme.colors.destructive} />
          </View>
          <View style={styles.emergencyHeaderCopy}>
            <Text style={[styles.sectionTitle, { color: theme.colors.foreground }]}>
              Emergency Contact
            </Text>
            <Text style={[styles.sectionSubtitle, { color: theme.colors.mutedForeground }]}>
              Reach out when you need support
            </Text>
          </View>
        </View>

        <View style={styles.contactList}>
          {emergencyContacts.map(contact => (
            <ContactRow key={contact.label} {...contact} theme={theme} />
          ))}
        </View>

        <Text style={[styles.emergencyFootnote, { color: theme.colors.mutedForeground }]}>
          You are not alone. Help is always available.
        </Text>
      </SectionCard>
    </TabScreenLayout>
  );
}

const styles = StyleSheet.create({
  shell: {
    gap: 18,
  },
  heroSection: {
    alignItems: "center",
    paddingTop: 8,
  },
  avatarWrap: {
    marginBottom: 14,
  },
  avatarShell: {
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
    fontWeight: "600",
    letterSpacing: 0.4,
  },
  avatarInitialsCompact: {
    fontSize: 28,
  },
  avatarInitialsDefault: {
    fontSize: 30,
  },
  avatarInitialsWide: {
    fontSize: 32,
  },
  name: {
    fontSize: 25,
    fontWeight: "600",
    marginBottom: 4,
    textAlign: "center",
  },
  email: {
    fontSize: 14,
    marginBottom: 12,
    textAlign: "center",
  },
  premiumBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    overflow: "hidden",
  },
  premiumBadgeText: {
    fontSize: 13,
    fontWeight: "600",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  statCard: {
    flexBasis: "31%",
    flexGrow: 1,
    minWidth: 92,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  statIcon: {
    marginBottom: 10,
  },
  statValue: {
    fontSize: 17,
    fontWeight: "600",
    marginBottom: 4,
    textAlign: "center",
  },
  statLabel: {
    fontSize: 11,
    lineHeight: 14,
    textAlign: "center",
  },
  sectionCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
  },
  elevatedCard: {
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  sectionSubtitle: {
    fontSize: 12,
    marginTop: 4,
  },
  goalWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
  },
  goalPill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  goalEmptyState: {
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    width: "100%",
  },
  goalEmptyText: {
    fontSize: 12,
    lineHeight: 17,
  },
  goalText: {
    fontSize: 13,
    fontWeight: "500",
  },
  upgradeBanner: {
    borderRadius: 20,
    padding: 18,
    overflow: "hidden",
    position: "relative",
  },
  upgradeGlow: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 20,
    opacity: 0.35,
  },
  upgradeCopy: {
    gap: 10,
  },
  upgradeHeadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  upgradeTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  upgradeText: {
    fontSize: 13,
    lineHeight: 19,
    opacity: 0.95,
  },
  upgradeCtaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  upgradeCta: {
    fontSize: 13,
    fontWeight: "600",
  },
  menuList: {
    gap: 12,
  },
  menuRow: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  menuCopy: {
    flex: 1,
    minWidth: 0,
  },
  menuTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  menuLabel: {
    fontSize: 15,
    fontWeight: "600",
  },
  menuBadge: {
    fontSize: 11,
    fontWeight: "600",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: "hidden",
  },
  menuDescription: {
    fontSize: 12,
    lineHeight: 17,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  viewAllButton: {
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: "600",
  },
  achievementRow: {
    flexDirection: "row",
    gap: 10,
  },
  achievementCard: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  achievementEmoji: {
    fontSize: 24,
    marginBottom: 8,
  },
  achievementLabel: {
    fontSize: 11,
    textAlign: "center",
    lineHeight: 14,
  },
  emergencyHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  emergencyIcon: {
    width: 32,
    height: 32,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  emergencyHeaderCopy: {
    flex: 1,
  },
  contactList: {
    gap: 10,
  },
  contactRow: {
    borderRadius: 14,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  contactCopy: {
    flex: 1,
    paddingRight: 12,
  },
  contactLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
  contactDescription: {
    fontSize: 12,
    lineHeight: 17,
  },
  emergencyFootnote: {
    fontSize: 10,
    lineHeight: 14,
    textAlign: "center",
    marginTop: 12,
  },
  pressed: {
    opacity: 0.86,
    transform: [{ scale: 0.99 }],
  },
});
