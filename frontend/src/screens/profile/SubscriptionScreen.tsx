import { useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Check, Crown, Sparkles } from "lucide-react-native";
import { ProfileSectionLayout, SectionCard } from "./ProfileSectionLayout";
import { useTheme } from "../../theme/provider";

type SubscriptionScreenProps = {
  onBack: () => void;
  onOpenPaywall?: () => void;
};

type Plan = {
  name: string;
  price: string;
  period: string;
  features: string[];
  cta: string;
  current?: boolean;
  popular?: boolean;
  badge?: string;
};

const plans: Plan[] = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    features: [
      "Unlimited journal entries",
      "Basic mood tracking",
      "3 AI prompts per week",
      "Search and tags",
      "Mobile app access",
    ],
    cta: "Current Plan",
    current: true,
  },
  {
    name: "Premium",
    price: "$4.99",
    period: "per month",
    features: [
      "Everything in Free",
      "Unlimited AI prompts",
      "Advanced insights and analytics",
      "Weekly AI summaries",
      "Voice notes",
      "Export all data",
      "Priority support",
      "No ads",
    ],
    cta: "Upgrade to Premium",
    popular: true,
  },
  {
    name: "Lifetime",
    price: "$49.99",
    period: "one-time",
    features: [
      "All Premium features",
      "Lifetime access",
      "Early access to new features",
      "Priority support",
    ],
    cta: "Get Lifetime Access",
    badge: "Best Value",
  },
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

function PlanCard({
  plan,
  selected,
  onSelect,
}: {
  plan: Plan;
  selected: boolean;
  onSelect: () => void;
}) {
  const theme = useTheme();

  const selectedCardStyle = selected
    ? {
        backgroundColor: hexToRgba(theme.colors.primary, 0.06),
        borderColor: theme.colors.primary,
      }
      : {
        backgroundColor: theme.colors.card,
        borderColor: theme.colors.border,
      };
  const radioStyle = {
    borderColor: selected ? theme.colors.primary : theme.colors.border,
    backgroundColor: selected ? theme.colors.primary : "transparent",
  };

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onSelect}
      style={({ pressed }) => [
        styles.planCard,
        selectedCardStyle,
        pressed && styles.pressed,
      ]}
    >
      {plan.popular ? (
        <View style={[styles.ribbon, { backgroundColor: theme.colors.primary }]}>
          <Text style={[styles.ribbonText, { color: theme.colors.primaryForeground }]}>
            Most Popular
          </Text>
        </View>
      ) : null}
      {plan.badge ? (
        <View style={[styles.ribbon, { backgroundColor: theme.colors.success }]}>
          <Text style={[styles.ribbonText, { color: theme.colors.successForeground }]}>
            {plan.badge}
          </Text>
        </View>
      ) : null}

      <View style={styles.planHeader}>
        <View style={styles.planTitleBlock}>
          <Text style={[styles.planName, { color: theme.colors.foreground }]}>
            {plan.name}
          </Text>
          <Text style={[styles.planPeriod, { color: theme.colors.mutedForeground }]}>
            <Text style={[styles.planPrice, { color: theme.colors.foreground }]}>
              {plan.price}
            </Text>{" "}
            {plan.period}
          </Text>
        </View>

        <View
          style={[styles.planRadio, radioStyle]}
        >
          {selected ? <View style={styles.planRadioDot} /> : null}
        </View>
      </View>

      <View style={styles.featureList}>
        {plan.features.map(feature => (
          <View key={feature} style={styles.featureRow}>
            <Check size={15} color={theme.colors.primary} />
            <Text style={[styles.featureText, { color: theme.colors.foreground }]}>
              {feature}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.ctaRow}>
        <Text style={[styles.ctaLabel, { color: theme.colors.primary }]}>
          {plan.cta}
        </Text>
        <Sparkles size={14} color={theme.colors.primary} />
      </View>
    </Pressable>
  );
}

export default function SubscriptionScreen({
  onBack,
  onOpenPaywall,
}: SubscriptionScreenProps) {
  const theme = useTheme();
  const [selectedPlan, setSelectedPlan] = useState<Plan["name"]>("Premium");

  const handlePlanAction = (plan: Plan) => {
    if (plan.current) {
      Alert.alert("Subscription", "You are already on the Free plan in this build.");
      return;
    }

    Alert.alert(
      "Subscription",
      `${plan.name} billing is not connected yet. This screen is ready for the purchase flow.`
    );
  };

  return (
    <ProfileSectionLayout
      title="Subscription"
      onBack={onBack}
      backgroundTintColor={hexToRgba(theme.colors.primary, 0.025)}
    >
      <View style={styles.hero}>
        <View style={[styles.heroIcon, { backgroundColor: theme.colors.primary }]}>
          <Crown size={24} color={theme.colors.primaryForeground} />
        </View>
        <Text style={[styles.heroTitle, { color: theme.colors.foreground }]}>
          Unlock Your Full Potential
        </Text>
        <Text style={[styles.heroText, { color: theme.colors.mutedForeground }]}>
          Pick the plan that fits your journaling rhythm and unlock richer insights.
        </Text>
      </View>

      <View style={styles.planStack}>
        {plans.map(plan => (
          <PlanCard
            key={plan.name}
            plan={plan}
            selected={selectedPlan === plan.name}
            onSelect={() => {
              setSelectedPlan(plan.name);
              handlePlanAction(plan);
            }}
          />
        ))}
      </View>

      <SectionCard>
        <Text style={[styles.faqTitle, { color: theme.colors.foreground }]}>
          Frequently Asked Questions
        </Text>

        <View style={styles.faqStack}>
          <View>
            <Text style={[styles.faqQuestion, { color: theme.colors.foreground }]}>
              Can I cancel anytime?
            </Text>
            <Text style={[styles.faqAnswer, { color: theme.colors.mutedForeground }]}>
              Yes. Manage billing from settings when payment support is connected.
            </Text>
          </View>
          <View>
            <Text style={[styles.faqQuestion, { color: theme.colors.foreground }]}>
              Is there a free trial?
            </Text>
            <Text style={[styles.faqAnswer, { color: theme.colors.mutedForeground }]}>
              The premium trial flow is shown here for design parity.
            </Text>
          </View>
          <View>
            <Text style={[styles.faqQuestion, { color: theme.colors.foreground }]}>
              What happens after upgrade?
            </Text>
            <Text style={[styles.faqAnswer, { color: theme.colors.mutedForeground }]}>
              Premium unlocks the richer AI surfaces across the app.
            </Text>
          </View>
        </View>
      </SectionCard>

      <View style={[styles.trustCard, { backgroundColor: theme.colors.secondary }]}>
        <Text style={[styles.trustText, { color: theme.colors.mutedForeground }]}>
          Selected: {selectedPlan}. Secure billing and restore-purchase support are planned for a
          later pass.
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() => {
          if (onOpenPaywall) {
            onOpenPaywall();
            return;
          }

          Alert.alert("Paywall", "This preview route is not connected yet.");
        }}
        style={({ pressed }) => [
          styles.paywallPreviewButton,
          {
            backgroundColor: theme.colors.accent,
            borderColor: theme.colors.border,
          },
          pressed && styles.pressed,
        ]}
      >
        <Text style={[styles.paywallPreviewLabel, { color: theme.colors.foreground }]}>
          Open Paywall Preview
        </Text>
      </Pressable>
    </ProfileSectionLayout>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: "center",
    paddingVertical: 6,
    gap: 10,
  },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: "600",
    textAlign: "center",
    letterSpacing: -0.3,
  },
  heroText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    maxWidth: 320,
  },
  planStack: {
    gap: 12,
  },
  planCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
    overflow: "hidden",
  },
  ribbon: {
    position: "absolute",
    top: 0,
    right: 0,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomLeftRadius: 14,
  },
  ribbonText: {
    fontSize: 11,
    fontWeight: "600",
  },
  planHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 14,
  },
  planTitleBlock: {
    flex: 1,
  },
  planName: {
    fontSize: 20,
    fontWeight: "600",
  },
  planPeriod: {
    fontSize: 13,
    marginTop: 2,
  },
  planPrice: {
    fontSize: 28,
    fontWeight: "700",
  },
  planRadio: {
    width: 22,
    height: 22,
    borderRadius: 999,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  planRadioDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
  },
  featureList: {
    gap: 10,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  featureText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
  ctaRow: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  ctaLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  faqTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 14,
  },
  faqStack: {
    gap: 14,
  },
  faqQuestion: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 3,
  },
  faqAnswer: {
    fontSize: 12,
    lineHeight: 17,
  },
  trustCard: {
    borderRadius: 18,
    padding: 14,
    alignItems: "center",
  },
  trustText: {
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
  },
  paywallPreviewButton: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
  },
  paywallPreviewLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  pressed: {
    opacity: 0.9,
  },
});
