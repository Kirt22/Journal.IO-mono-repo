import { buildUserProfilePayload } from "../user/user.service";
import {
  paywallConfigModel,
  type IPaywallConfig,
  type IPaywallPlacementConfig,
  type PaywallTriggerMode,
} from "../../schema/paywallConfig.schema";
import {
  paywallEventModel,
  type PaywallEventType,
} from "../../schema/paywallEvent.schema";
import {
  paywallOfferingModel,
  type IPaywallOffering,
  type PaywallOfferingKey,
} from "../../schema/paywallOffering.schema";
import {
  paywallTemplateModel,
  type PaywallFeatureCard,
  type IPaywallTemplate,
  type PaywallTemplateKey,
} from "../../schema/paywallTemplate.schema";
import { userModel } from "../../schema/user.schema";

type PaywallConfigInput = {
  placementKey: string;
  screenKey?: string;
  currentStage?: string;
  triggerMode?: PaywallTriggerMode;
};

type TrackPaywallEventInput = {
  placementKey: string;
  screenKey?: string;
  eventType: PaywallEventType;
  templateKey?: string;
  offeringKey?: PaywallOfferingKey;
  wasInterruptive?: boolean;
  metadata?: Record<string, unknown>;
};

type SyncPaywallPurchaseInput = {
  offeringKey: PaywallOfferingKey;
  revenueCatOfferingId: string;
  revenueCatPackageId: string;
  store: string;
  entitlementId: string;
  wasRestore?: boolean;
};

type ResolvedOffering = {
  key: PaywallOfferingKey;
  title: string;
  price: string;
  priceSuffix: string | null;
  subtitle: string | null;
  badge: string | null;
  highlight: string | null;
  sortOrder: number;
  revenueCatOfferingId: string | null;
  revenueCatPackageId: string | null;
  purchasedUsersCount: number;
  purchaseLimit: number | null;
};

type ResolvedTemplate = {
  key: PaywallTemplateKey;
  title: string;
  headline: string;
  subheadline: string | null;
  heroBadgeLabel: string | null;
  purchaseChipTitle: string | null;
  purchaseChipBody: string | null;
  featureCarouselTitle: string | null;
  socialProofLine: string | null;
  footerLegal: string | null;
  featureList: PaywallFeatureCard[];
  primaryOfferingKey: PaywallOfferingKey;
  secondaryOfferingKeys: PaywallOfferingKey[];
  visibleOfferingKeys: PaywallOfferingKey[];
};

type PaywallDecision = {
  shouldShow: boolean;
  placementKey: string;
  screenKey: string | null;
  triggerMode: PaywallTriggerMode;
  wasInterruptive: boolean;
  reason: string;
  template: ResolvedTemplate | null;
  offerings: ResolvedOffering[];
};

const DEFAULT_OFFERINGS: Array<
  Pick<
    IPaywallOffering,
    | "key"
    | "title"
    | "price"
    | "priceSuffix"
    | "subtitle"
    | "badge"
    | "highlight"
    | "enabled"
    | "sortOrder"
    | "revenueCatOfferingId"
    | "revenueCatPackageId"
    | "purchaseLimit"
  >
> = [
  {
    key: "weekly",
    title: "WEEKLY",
    price: "$4.99",
    priceSuffix: "/week",
    subtitle: "Flexible access",
    badge: null,
    highlight: null,
    enabled: true,
    sortOrder: 1,
    revenueCatOfferingId: "journalio_offering_dev",
    revenueCatPackageId: "$rc_weekly",
    purchaseLimit: null,
  },
  {
    key: "monthly",
    title: "MONTHLY",
    price: "$9.99",
    priceSuffix: "/month",
    subtitle: "Simple monthly billing",
    badge: null,
    highlight: null,
    enabled: true,
    sortOrder: 2,
    revenueCatOfferingId: "journalio_offering_dev",
    revenueCatPackageId: "$rc_monthly",
    purchaseLimit: null,
  },
  {
    key: "yearly",
    title: "YEARLY",
    price: "$59.99",
    priceSuffix: "/year",
    subtitle: "Best for steady journaling",
    badge: "Most Value",
    highlight: "$5.00/month",
    enabled: true,
    sortOrder: 3,
    revenueCatOfferingId: "journalio_offering_dev",
    revenueCatPackageId: "$rc_annual",
    purchaseLimit: null,
  },
  {
    key: "yearly_exit_offer",
    title: "YEARLY",
    price: "$29.99",
    priceSuffix: "/year",
    subtitle: "Discounted yearly access",
    badge: "Limited Time",
    highlight: "$2.50/month",
    enabled: true,
    sortOrder: 4,
    revenueCatOfferingId: null,
    revenueCatPackageId: "$rc_annual",
    purchaseLimit: null,
  },
  {
    key: "lifetime",
    title: "LIFETIME",
    price: "$149.99",
    priceSuffix: " one-time",
    subtitle: "One-time unlock",
    badge: "One time offer",
    highlight: "First 100 users",
    enabled: true,
    sortOrder: 5,
    revenueCatOfferingId: "journalio_offering_dev",
    revenueCatPackageId: "$rc_lifetime",
    purchaseLimit: 100,
  },
];

const DEFAULT_TEMPLATES: Array<
  Pick<
    IPaywallTemplate,
    | "key"
    | "title"
    | "headline"
    | "subheadline"
    | "heroBadgeLabel"
    | "purchaseChipTitle"
    | "purchaseChipBody"
    | "featureCarouselTitle"
    | "socialProofLine"
    | "footerLegal"
    | "featureList"
    | "primaryOfferingKey"
    | "secondaryOfferingKeys"
    | "visibleOfferingKeys"
    | "enabled"
    | "fallbackTemplateKey"
    | "showIfOfferingKeysAvailable"
    | "placementKeys"
  >
> = [
  {
    key: "weekly-standard",
    title: "Weekly Or Yearly Premium",
    headline: "Start flexibly now, or choose the longer premium path up front.",
    subheadline: "A two-card template with weekly access and the longer-term yearly option.",
    heroBadgeLabel: null,
    purchaseChipTitle: null,
    purchaseChipBody: null,
    featureCarouselTitle: null,
    socialProofLine: null,
    footerLegal: null,
    featureList: [
      {
        title: "Choose your pace",
        body: "Start with weekly premium if you want a lighter commitment, or go yearly if you already know you will stay.",
        footer: "Two options, one calmer premium flow.",
      },
      {
        title: "Weekly analysis stays unlocked",
        body: "Both options open AI tagging, saved-entry quick analysis, and the weekly behavior read across the app.",
        footer: "The feature set stays the same across the two plans.",
      },
      {
        title: "Yearly is still the value option",
        body: "Keep the stronger long-term pricing card visible whenever you want to steer users toward the longer premium path.",
        footer: "Weekly for flexibility, yearly for commitment.",
      },
      {
        title: "Backend controls the exact pair",
        body: "This template always renders only the weekly and yearly pricing cards from Mongo-backed offering metadata.",
        footer: "RevenueCat still executes the selected purchase package.",
      },
    ],
    primaryOfferingKey: "weekly",
    secondaryOfferingKeys: ["yearly"],
    visibleOfferingKeys: ["weekly", "yearly"],
    enabled: true,
    fallbackTemplateKey: null,
    showIfOfferingKeysAvailable: ["weekly", "yearly"],
    placementKeys: [
      "post_auth",
      "subscription_screen",
      "home_ai_card_locked",
      "home_interruptive",
      "insights_interruptive",
      "insights_ai_tab_locked",
      "new_entry_auto_tag_locked",
      "entry_quick_analysis_locked",
      "settings_privacy_mode_locked",
      "settings_hide_previews_locked",
      "privacy_export_locked",
    ],
  },
  {
    key: "monthly-standard",
    title: "Monthly Premium",
    headline: "Unlock a calmer weekly read of your own patterns.",
    subheadline: "Monthly access keeps AI insights and reflective guidance available across the app.",
    heroBadgeLabel: null,
    purchaseChipTitle: null,
    purchaseChipBody: null,
    featureCarouselTitle: null,
    socialProofLine: null,
    footerLegal: null,
    featureList: [
      {
        title: "Weekly summaries that stay readable",
        body: "Turn recent entries into a cleaner monthly rhythm of patterns, themes, and signals.",
        footer: "A steady pace for reflective journaling.",
      },
      {
        title: "Premium AI support",
        body: "Keep premium prompts, tag suggestions, and quick analysis available across your writing flow.",
        footer: "Helpful support at the moments you actually use it.",
      },
      {
        title: "Home insight card unlocked",
        body: "Open the rotating Home AI card and move into deeper analysis when something stands out.",
        footer: "Short reads on Home, fuller context in Insights.",
      },
      {
        title: "Private reflection tools",
        body: "Use the premium privacy controls that make the app feel calmer in shared or busy environments.",
        footer: "Small controls that make journaling easier to protect.",
      },
    ],
    primaryOfferingKey: "monthly",
    secondaryOfferingKeys: ["yearly"],
    visibleOfferingKeys: ["monthly", "yearly"],
    enabled: false,
    fallbackTemplateKey: "yearly-commitment",
    showIfOfferingKeysAvailable: ["monthly", "yearly"],
    placementKeys: ["home_ai_card_locked", "home_interruptive", "insights_interruptive"],
  },
  {
    key: "yearly-commitment",
    title: "Yearly Premium",
    headline: "Stay consistent long enough to see clearer weekly patterns.",
    subheadline: "Yearly access is the best fit for reflective habits that deepen over time.",
    heroBadgeLabel: null,
    purchaseChipTitle: null,
    purchaseChipBody: null,
    featureCarouselTitle: null,
    socialProofLine: null,
    footerLegal: null,
    featureList: [
      {
        title: "Full weekly analysis",
        body: "Build enough consistency to unlock a calmer, fuller weekly read of your behavior patterns.",
        footer: "Designed for long-term reflection, not one-off spikes.",
      },
      {
        title: "Every premium journaling tool",
        body: "Keep prompts, AI tags, quick analysis, and the locked insight surfaces available year-round.",
        footer: "Everything in one longer commitment.",
      },
      {
        title: "Premium privacy settings",
        body: "Use privacy mode and preview controls whenever you want more distance from on-screen journal details.",
        footer: "Useful for shared spaces and quieter routines.",
      },
      {
        title: "Best long-term value",
        body: "Reduce billing friction while staying with the version of Journal.IO built for steady use.",
        footer: "A simpler choice for users who already know they will stay.",
      },
    ],
    primaryOfferingKey: "yearly",
    secondaryOfferingKeys: ["monthly"],
    visibleOfferingKeys: ["yearly", "monthly"],
    enabled: false,
    fallbackTemplateKey: "monthly-standard",
    showIfOfferingKeysAvailable: ["yearly", "monthly"],
    placementKeys: [
      "profile_upgrade_banner",
      "subscription_screen",
      "insights_ai_tab_locked",
      "settings_privacy_mode_locked",
      "settings_hide_previews_locked",
      "privacy_export_locked",
    ],
  },
  {
    key: "post-auth-trial",
    title: "Choose your premium path",
    headline: "Start with a weekly plan or choose the longer yearly path up front.",
    subheadline:
      "Post-auth premium introduces the weekly plan first, while yearly stays available with the store-backed trial path when eligible.",
    heroBadgeLabel: "Free trial available",
    purchaseChipTitle: null,
    purchaseChipBody: null,
    featureCarouselTitle: null,
    socialProofLine: null,
    footerLegal:
      "Yearly trial eligibility is confirmed by the store at checkout. Weekly does not include a trial.",
    featureList: [
      {
        title: "Start with the weekly plan",
        body: "Guide new users through the lighter premium path first, while yearly remains available for people who want the longer commitment.",
        footer: "Weekly stays free of trial language.",
      },
      {
        title: "Keep the messaging calmer before pricing",
        body: "The mobile flow can lead with a free-trial explanation and reminder reassurance before the actual pricing choice appears.",
        footer: "A softer post-auth upsell sequence.",
      },
      {
        title: "Weekly and yearly only",
        body: "This template is reserved for the post-auth paywall and renders only the weekly and yearly pricing cards from backend offering metadata.",
        footer: "Contextual locked-feature paywalls can keep their simpler monthly flow.",
      },
    ],
    primaryOfferingKey: "weekly",
    secondaryOfferingKeys: ["yearly"],
    visibleOfferingKeys: ["weekly", "yearly"],
    enabled: true,
    fallbackTemplateKey: "weekly-standard",
    showIfOfferingKeysAvailable: ["weekly", "yearly"],
    placementKeys: ["post_auth"],
  },
  {
    key: "post-auth-exit-offer",
    title: "Keep the yearly premium path open",
    headline: "Before you continue, the yearly plan is still available with the trial path if the store allows it.",
    subheadline: "A dedicated post-auth exit offer that keeps the focus on the yearly premium option only.",
    heroBadgeLabel: "Exit offer",
    purchaseChipTitle: null,
    purchaseChipBody: null,
    featureCarouselTitle: null,
    socialProofLine: null,
    footerLegal:
      "Yearly trial eligibility is still confirmed by the store at checkout.",
    featureList: [
      {
        title: "One quieter exit step",
        body: "If the user dismisses the main post-auth paywall, this template keeps a final yearly offer available before they continue into the app.",
        footer: "The screen is reserved for the post-auth exit flow only.",
      },
      {
        title: "Yearly only",
        body: "This template renders only the yearly premium card, so the exit offer stays focused instead of reopening the full plan comparison.",
        footer: "A simpler follow-up surface after dismissal.",
      },
      {
        title: "Still store-backed and truthful",
        body: "The app should render the live RevenueCat package price and any real introductory trial details returned by the store.",
        footer: "No fabricated discount copy outside the configured offer metadata.",
      },
    ],
    primaryOfferingKey: "yearly_exit_offer",
    secondaryOfferingKeys: [],
    visibleOfferingKeys: ["yearly_exit_offer"],
    enabled: true,
    fallbackTemplateKey: "weekly-standard",
    showIfOfferingKeysAvailable: ["yearly_exit_offer"],
    placementKeys: ["post_auth_exit_offer"],
  },
  {
    key: "lifetime-launch",
    title: "Lifetime Offer",
    headline: "A one-time unlock for the first 100 Journal.IO members.",
    subheadline: "Reserve lifetime premium access while the launch offer is still available.",
    heroBadgeLabel: "Lifetime access",
    purchaseChipTitle: "One-time",
    purchaseChipBody: "No renewal",
    featureCarouselTitle: "What lifetime unlocks",
    socialProofLine: "Be one of the first users to be part of this family.",
    footerLegal: "One-time purchase. Premium stays on this account after sync.",
    featureList: [
      {
        title: "Lifetime access, one decision",
        body: "Unlock all current premium journaling, insight, and privacy tools with one purchase.",
        footer: "No renewals. No recurring billing.",
      },
      {
        title: "One-time offer window",
        body: "This launch template is reserved for the first 100 successful lifetime purchasers.",
        footer: "Once it sells out, the app falls back to the standard premium paywall.",
      },
      {
        title: "Built for users staying long-term",
        body: "Ideal for users who already know they want Journal.IO as part of their ongoing reflection habit.",
        footer: "A cleaner commitment for the earliest supporters.",
      },
    ],
    primaryOfferingKey: "lifetime",
    secondaryOfferingKeys: [],
    visibleOfferingKeys: ["lifetime"],
    enabled: true,
    fallbackTemplateKey: "weekly-standard",
    showIfOfferingKeysAvailable: ["lifetime"],
    placementKeys: ["profile_upgrade_banner", "subscription_screen"],
  },
];

const DEFAULT_CONFIG: Pick<
  IPaywallConfig,
  | "key"
  | "enabled"
  | "premiumIntentWindowHours"
  | "premiumIntentThreshold"
  | "interruptiveProbability"
  | "interruptiveCooldownHours"
  | "interruptiveMaxShowsPer30Days"
  | "interruptiveEligibleScreens"
  | "interruptiveExcludedStages"
  | "placements"
> = {
  key: "global",
  enabled: true,
  premiumIntentWindowHours: 24,
  premiumIntentThreshold: 3,
  interruptiveProbability: 0.3,
  interruptiveCooldownHours: 48,
  interruptiveMaxShowsPer30Days: 3,
  interruptiveEligibleScreens: ["home", "insights"],
  interruptiveExcludedStages: [
    "onboarding",
    "auth",
    "sign-in",
    "create-account",
    "verify-email",
    "profile",
    "new-entry",
    "journal-edit",
  ],
  placements: [
    {
      key: "post_auth",
      templateKey: "post-auth-trial",
      fallbackTemplateKey: null,
      enabled: true,
      interruptiveEnabled: false,
      interruptiveTemplateKey: null,
    },
    {
      key: "post_auth_exit_offer",
      templateKey: "post-auth-exit-offer",
      fallbackTemplateKey: "weekly-standard",
      enabled: true,
      interruptiveEnabled: false,
      interruptiveTemplateKey: null,
    },
    {
      key: "profile_upgrade_banner",
      templateKey: "lifetime-launch",
      fallbackTemplateKey: "weekly-standard",
      enabled: true,
      interruptiveEnabled: false,
      interruptiveTemplateKey: null,
    },
    {
      key: "subscription_screen",
      templateKey: "weekly-standard",
      fallbackTemplateKey: null,
      enabled: true,
      interruptiveEnabled: false,
      interruptiveTemplateKey: null,
    },
    {
      key: "home_ai_card_locked",
      templateKey: "weekly-standard",
      fallbackTemplateKey: null,
      enabled: true,
      interruptiveEnabled: false,
      interruptiveTemplateKey: null,
    },
    {
      key: "insights_ai_tab_locked",
      templateKey: "weekly-standard",
      fallbackTemplateKey: null,
      enabled: true,
      interruptiveEnabled: false,
      interruptiveTemplateKey: null,
    },
    {
      key: "new_entry_auto_tag_locked",
      templateKey: "weekly-standard",
      fallbackTemplateKey: null,
      enabled: true,
      interruptiveEnabled: false,
      interruptiveTemplateKey: null,
    },
    {
      key: "entry_quick_analysis_locked",
      templateKey: "weekly-standard",
      fallbackTemplateKey: null,
      enabled: true,
      interruptiveEnabled: false,
      interruptiveTemplateKey: null,
    },
    {
      key: "settings_privacy_mode_locked",
      templateKey: "weekly-standard",
      fallbackTemplateKey: null,
      enabled: true,
      interruptiveEnabled: false,
      interruptiveTemplateKey: null,
    },
    {
      key: "settings_hide_previews_locked",
      templateKey: "weekly-standard",
      fallbackTemplateKey: null,
      enabled: true,
      interruptiveEnabled: false,
      interruptiveTemplateKey: null,
    },
    {
      key: "privacy_export_locked",
      templateKey: "weekly-standard",
      fallbackTemplateKey: null,
      enabled: true,
      interruptiveEnabled: false,
      interruptiveTemplateKey: null,
    },
    {
      key: "home_interruptive",
      templateKey: "weekly-standard",
      fallbackTemplateKey: null,
      enabled: true,
      interruptiveEnabled: true,
      interruptiveTemplateKey: "weekly-standard",
    },
    {
      key: "insights_interruptive",
      templateKey: "weekly-standard",
      fallbackTemplateKey: null,
      enabled: true,
      interruptiveEnabled: true,
      interruptiveTemplateKey: "weekly-standard",
    },
  ],
};

const PREMIUM_INTENT_EVENT_TYPES = new Set<PaywallEventType>([
  "locked_feature_tap",
  "upgrade_tap",
]);

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const LEGACY_TEMPLATE_KEYS = new Set<PaywallTemplateKey>([
  "monthly-standard",
  "yearly-commitment",
]);
const normalizeActiveTemplateKey = (
  key?: PaywallTemplateKey | null
): PaywallTemplateKey | null => {
  if (!key) {
    return null;
  }

  return LEGACY_TEMPLATE_KEYS.has(key) ? "weekly-standard" : key;
};

const getMembershipPlanKeyFromOfferingKey = (
  offeringKey: PaywallOfferingKey
): "weekly" | "monthly" | "yearly" | "lifetime" =>
  offeringKey === "yearly_exit_offer" ? "yearly" : offeringKey;

const getMissingDefaultPlacements = (
  currentPlacements: IPaywallConfig["placements"],
  defaultPlacements: IPaywallConfig["placements"]
) =>
  defaultPlacements.filter(
    defaultPlacement =>
      !currentPlacements.some(
        currentPlacement => currentPlacement.key === defaultPlacement.key
      )
  );

const getMissingTemplatePlacementKeys = (
  currentPlacementKeys: string[],
  defaultPlacementKeys: string[]
) =>
  defaultPlacementKeys.filter(
    placementKey => !currentPlacementKeys.includes(placementKey)
  );

const ensureDefaultPaywallSetup = async () => {
  await Promise.all(
    DEFAULT_OFFERINGS.map(async offering => {
      await paywallOfferingModel.updateOne(
        { key: offering.key },
        { $setOnInsert: offering },
        { upsert: true }
      );

      const legacyOfferingIdsByKey: Record<PaywallOfferingKey, string[]> = {
        weekly: ["weekly_standard"],
        monthly: ["monthly_standard"],
        yearly: ["yearly_commitment"],
        yearly_exit_offer: [],
        lifetime: ["lifetime_launch"],
      };
      const legacyPricesByKey: Record<PaywallOfferingKey, string[]> = {
        weekly: ["$7.99"],
        monthly: ["$14.99"],
        yearly: ["$59.99"],
        yearly_exit_offer: [],
        lifetime: ["$99.99", "$250"],
      };

      await paywallOfferingModel.updateOne(
        {
          key: offering.key,
          $or: [
            { revenueCatOfferingId: { $in: legacyOfferingIdsByKey[offering.key] } },
            { revenueCatOfferingId: { $exists: false } },
            { revenueCatOfferingId: null },
            { revenueCatPackageId: { $exists: false } },
            { revenueCatPackageId: null },
            { price: { $in: legacyPricesByKey[offering.key] } },
          ],
        },
        {
          $set: {
            price: offering.price,
            priceSuffix: offering.priceSuffix,
            subtitle: offering.subtitle,
            badge: offering.badge,
            highlight: offering.highlight,
            revenueCatOfferingId: offering.revenueCatOfferingId,
            revenueCatPackageId: offering.revenueCatPackageId,
            purchaseLimit: offering.purchaseLimit,
          },
        }
      );

      if (offering.key === "lifetime") {
        await paywallOfferingModel.updateOne(
          { key: "lifetime" },
          {
            $set: {
              subtitle: offering.subtitle,
              badge: offering.badge,
              highlight: offering.highlight,
              purchaseLimit: offering.purchaseLimit,
            },
          }
        );
      }
    })
  );

  await Promise.all(
    DEFAULT_TEMPLATES.map(async template => {
      await paywallTemplateModel.updateOne(
        { key: template.key },
        { $setOnInsert: template },
        { upsert: true }
      );

      const currentTemplate = await paywallTemplateModel
        .findOne({ key: template.key }, { placementKeys: 1 })
        .lean()
        .exec();
      const missingTemplatePlacementKeys = getMissingTemplatePlacementKeys(
        currentTemplate?.placementKeys || [],
        template.placementKeys
      );

      if (missingTemplatePlacementKeys.length) {
        await paywallTemplateModel.updateOne(
          { key: template.key },
          {
            $addToSet: {
              placementKeys: {
                $each: missingTemplatePlacementKeys,
              },
            },
          }
        );
      }

      await paywallTemplateModel.updateOne(
        {
          key: template.key,
          $or: [
            { visibleOfferingKeys: { $exists: false } },
            { visibleOfferingKeys: { $size: 0 } },
          ],
        },
        { $set: { visibleOfferingKeys: template.visibleOfferingKeys } }
      );

      await paywallTemplateModel.updateOne(
        {
          key: template.key,
          "featureList.0": { $type: "string" },
        },
        {
          $set: {
            featureList: template.featureList,
            visibleOfferingKeys: template.visibleOfferingKeys,
          },
        }
      );

      if (template.key === "lifetime-launch") {
        await paywallTemplateModel.updateOne(
          { key: "lifetime-launch" },
          {
            $set: {
              title: template.title,
              headline: template.headline,
              subheadline: template.subheadline,
              heroBadgeLabel: template.heroBadgeLabel,
              purchaseChipTitle: template.purchaseChipTitle,
              purchaseChipBody: template.purchaseChipBody,
              featureCarouselTitle: template.featureCarouselTitle,
              socialProofLine: template.socialProofLine,
              footerLegal: template.footerLegal,
              featureList: template.featureList,
              secondaryOfferingKeys: [],
              visibleOfferingKeys: ["lifetime"],
              showIfOfferingKeysAvailable: ["lifetime"],
              placementKeys: template.placementKeys,
            },
          }
        );
      }

      if (template.key === "weekly-standard") {
        await paywallTemplateModel.updateOne(
          {
            key: "weekly-standard",
            $or: [
              { visibleOfferingKeys: ["weekly", "monthly"] },
              { secondaryOfferingKeys: ["monthly"] },
            ],
          },
          {
            $set: {
              title: template.title,
              headline: template.headline,
              subheadline: template.subheadline,
              heroBadgeLabel: template.heroBadgeLabel,
              purchaseChipTitle: template.purchaseChipTitle,
              purchaseChipBody: template.purchaseChipBody,
              featureCarouselTitle: template.featureCarouselTitle,
              socialProofLine: template.socialProofLine,
              footerLegal: template.footerLegal,
              featureList: template.featureList,
              secondaryOfferingKeys: ["yearly"],
              visibleOfferingKeys: ["weekly", "yearly"],
              showIfOfferingKeysAvailable: ["weekly", "yearly"],
              fallbackTemplateKey: null,
              placementKeys: template.placementKeys,
              enabled: true,
            },
          }
        );
      }

      if (template.key === "post-auth-trial") {
        await paywallTemplateModel.updateOne(
          { key: "post-auth-trial" },
          {
            $set: {
              title: template.title,
              headline: template.headline,
              subheadline: template.subheadline,
              heroBadgeLabel: template.heroBadgeLabel,
              purchaseChipTitle: template.purchaseChipTitle,
              purchaseChipBody: template.purchaseChipBody,
              featureCarouselTitle: template.featureCarouselTitle,
              socialProofLine: template.socialProofLine,
              footerLegal: template.footerLegal,
              featureList: template.featureList,
              primaryOfferingKey: "weekly",
              secondaryOfferingKeys: ["yearly"],
              visibleOfferingKeys: ["weekly", "yearly"],
              fallbackTemplateKey: "weekly-standard",
              showIfOfferingKeysAvailable: ["weekly", "yearly"],
              placementKeys: template.placementKeys,
              enabled: true,
            },
          }
        );
      }

      if (template.key === "post-auth-exit-offer") {
        await paywallTemplateModel.updateOne(
          { key: template.key },
          {
            $set: {
              title: template.title,
              headline: template.headline,
              subheadline: template.subheadline,
              heroBadgeLabel: template.heroBadgeLabel,
              purchaseChipTitle: template.purchaseChipTitle,
              purchaseChipBody: template.purchaseChipBody,
              featureCarouselTitle: template.featureCarouselTitle,
              socialProofLine: template.socialProofLine,
              footerLegal: template.footerLegal,
              featureList: template.featureList,
              primaryOfferingKey: "yearly_exit_offer",
              secondaryOfferingKeys: [],
              visibleOfferingKeys: ["yearly_exit_offer"],
              fallbackTemplateKey: template.fallbackTemplateKey,
              showIfOfferingKeysAvailable: ["yearly_exit_offer"],
              placementKeys: template.placementKeys,
              enabled: template.enabled,
            },
          }
        );
      }

      if (template.key === "monthly-standard" || template.key === "yearly-commitment") {
        await paywallTemplateModel.updateOne(
          { key: template.key },
          { $set: { enabled: false } }
        );
      }
    })
  );

  await paywallConfigModel.updateOne(
    { key: DEFAULT_CONFIG.key },
    { $setOnInsert: DEFAULT_CONFIG },
    { upsert: true }
  );

  const currentConfig = await paywallConfigModel.findOne({ key: DEFAULT_CONFIG.key }).exec();

  if (currentConfig) {
    const missingDefaultPlacements = getMissingDefaultPlacements(
      currentConfig.placements,
      DEFAULT_CONFIG.placements
    );

    if (missingDefaultPlacements.length) {
      await paywallConfigModel.updateOne(
        { key: DEFAULT_CONFIG.key },
        {
          $push: {
            placements: {
              $each: missingDefaultPlacements,
            },
          },
        }
      );
    }

    const normalizedPlacements = currentConfig.placements.map(placement => ({
      key: placement.key,
      templateKey:
        normalizeActiveTemplateKey(placement.templateKey) || "weekly-standard",
      fallbackTemplateKey: normalizeActiveTemplateKey(
        placement.fallbackTemplateKey || null
      ),
      enabled: placement.enabled,
      interruptiveEnabled: placement.interruptiveEnabled,
      interruptiveTemplateKey: normalizeActiveTemplateKey(
        placement.interruptiveTemplateKey || null
      ),
    }));

    const hasPlacementChanges = normalizedPlacements.some((placement, index) => {
      const currentPlacement = currentConfig.placements[index];

      if (!currentPlacement) {
        return true;
      }

      return (
        placement.templateKey !== currentPlacement.templateKey ||
        placement.fallbackTemplateKey !==
          (currentPlacement.fallbackTemplateKey || null) ||
        placement.interruptiveTemplateKey !==
          (currentPlacement.interruptiveTemplateKey || null)
      );
    });

    if (hasPlacementChanges) {
      await paywallConfigModel.updateOne(
        { key: DEFAULT_CONFIG.key },
        { $set: { placements: normalizedPlacements } }
      );
    }

    await paywallConfigModel.updateOne(
      { key: DEFAULT_CONFIG.key, "placements.key": "post_auth" },
      {
        $set: {
          "placements.$.templateKey": "post-auth-trial",
          "placements.$.fallbackTemplateKey": null,
          "placements.$.interruptiveEnabled": false,
          "placements.$.interruptiveTemplateKey": null,
        },
      }
    );

    await paywallConfigModel.updateOne(
      {
        key: DEFAULT_CONFIG.key,
        placements: { $not: { $elemMatch: { key: "post_auth_exit_offer" } } },
      },
      {
        $push: {
          placements: {
            key: "post_auth_exit_offer",
            templateKey: "post-auth-exit-offer",
            fallbackTemplateKey: "weekly-standard",
            enabled: true,
            interruptiveEnabled: false,
            interruptiveTemplateKey: null,
          },
        },
      }
    );
  }
};

const normalizeResolvedOffering = (
  offering: IPaywallOffering
): ResolvedOffering => ({
  key: offering.key,
  title: offering.title,
  price: offering.price,
  priceSuffix: offering.priceSuffix || null,
  subtitle: offering.subtitle || null,
  badge: offering.badge || null,
  highlight: offering.highlight || null,
  sortOrder: offering.sortOrder,
  revenueCatOfferingId: offering.revenueCatOfferingId || null,
  revenueCatPackageId: offering.revenueCatPackageId || null,
  purchasedUsersCount: offering.purchasedUsersCount,
  purchaseLimit: offering.purchaseLimit || null,
});

const normalizeResolvedTemplate = (
  template: IPaywallTemplate
): ResolvedTemplate => ({
  key: template.key,
  title: template.title,
  headline: template.headline,
  subheadline: template.subheadline || null,
  heroBadgeLabel: template.heroBadgeLabel || null,
  purchaseChipTitle: template.purchaseChipTitle || null,
  purchaseChipBody: template.purchaseChipBody || null,
  featureCarouselTitle: template.featureCarouselTitle || null,
  socialProofLine: template.socialProofLine || null,
  footerLegal: template.footerLegal || null,
  featureList: template.featureList || [],
  primaryOfferingKey: template.primaryOfferingKey,
  secondaryOfferingKeys: template.secondaryOfferingKeys || [],
  visibleOfferingKeys:
    template.visibleOfferingKeys?.length
      ? template.visibleOfferingKeys
      : [
          template.primaryOfferingKey,
          ...(template.secondaryOfferingKeys || []),
        ],
});

const isLifetimeOfferingSoldOut = (offering: IPaywallOffering | undefined) => {
  if (!offering || offering.key !== "lifetime") {
    return false;
  }

  return Boolean(
    offering.purchaseLimit &&
      offering.purchasedUsersCount >= offering.purchaseLimit
  );
};

const resolveTemplateForPlacement = ({
  placement,
  templatesByKey,
  offeringsByKey,
  visitedTemplateKeys = new Set<PaywallTemplateKey>(),
}: {
  placement: IPaywallPlacementConfig;
  templatesByKey: Map<PaywallTemplateKey, IPaywallTemplate>;
  offeringsByKey: Map<PaywallOfferingKey, IPaywallOffering>;
  visitedTemplateKeys?: Set<PaywallTemplateKey>;
}): {
  template: IPaywallTemplate | null;
  offerings: IPaywallOffering[];
  reason: string;
} => {
  if (visitedTemplateKeys.has(placement.templateKey)) {
    return {
      template: null,
      offerings: [],
      reason: "template_cycle_detected",
    };
  }

  visitedTemplateKeys.add(placement.templateKey);

  const template = templatesByKey.get(placement.templateKey);

  if (!template || !template.enabled) {
    if (placement.fallbackTemplateKey) {
      return resolveTemplateForPlacement({
        placement: {
          ...placement,
          templateKey: placement.fallbackTemplateKey,
          fallbackTemplateKey: null,
        },
        templatesByKey,
        offeringsByKey,
        visitedTemplateKeys,
      });
    }

    return {
      template: null,
      offerings: [],
      reason: "template_unavailable",
    };
  }

  const supportsPlacement =
    !template.placementKeys.length || template.placementKeys.includes(placement.key);

  if (!supportsPlacement) {
    const fallbackTemplateKey =
      template.fallbackTemplateKey || placement.fallbackTemplateKey || null;

    if (fallbackTemplateKey) {
      return resolveTemplateForPlacement({
        placement: {
          ...placement,
          templateKey: fallbackTemplateKey,
          fallbackTemplateKey: null,
        },
        templatesByKey,
        offeringsByKey,
        visitedTemplateKeys,
      });
    }

    return {
      template: null,
      offerings: [],
      reason: "template_not_allowed_for_placement",
    };
  }

  const requiredOfferingKeys = template.visibleOfferingKeys?.length
    ? template.visibleOfferingKeys
    : [template.primaryOfferingKey, ...template.secondaryOfferingKeys];
  const resolvedOfferings = requiredOfferingKeys
    .map(key => offeringsByKey.get(key))
    .filter((value): value is IPaywallOffering => Boolean(value && value.enabled))
    .sort((left, right) => left.sortOrder - right.sortOrder);

  const hasLifetimePrimary = template.primaryOfferingKey === "lifetime";
  const lifetimeOffering = offeringsByKey.get("lifetime");
  const isLifetimeSoldOut =
    hasLifetimePrimary && isLifetimeOfferingSoldOut(lifetimeOffering);

  const hasMissingRequiredOffering = requiredOfferingKeys.some(
    key => !offeringsByKey.get(key)?.enabled
  );

  if (isLifetimeSoldOut || hasMissingRequiredOffering) {
    const fallbackTemplateKey =
      template.fallbackTemplateKey || placement.fallbackTemplateKey || null;

    if (fallbackTemplateKey) {
      return resolveTemplateForPlacement({
        placement: {
          ...placement,
          templateKey: fallbackTemplateKey,
          fallbackTemplateKey: null,
        },
        templatesByKey,
        offeringsByKey,
        visitedTemplateKeys,
      });
    }

    return {
      template: null,
      offerings: [],
      reason: isLifetimeSoldOut ? "lifetime_sold_out" : "offerings_unavailable",
    };
  }

  if (!resolvedOfferings.length) {
    return {
      template: null,
      offerings: [],
      reason: "offerings_unavailable",
    };
  }

  return {
    template,
    offerings: resolvedOfferings,
    reason: "ready",
  };
};

const shouldAllowInterruptivePaywall = async ({
  userId,
  config,
  screenKey,
  currentStage,
  lastInterruptivePaywallAt,
}: {
  userId: string;
  config: IPaywallConfig;
  screenKey?: string;
  currentStage?: string;
  lastInterruptivePaywallAt?: Date | null;
}): Promise<string | null> => {
  if (!screenKey || !config.interruptiveEligibleScreens.includes(screenKey)) {
    return "screen_not_eligible";
  }

  if (currentStage && config.interruptiveExcludedStages.includes(currentStage)) {
    return "stage_excluded";
  }

  const now = Date.now();
  const intentWindowStart = new Date(
    now - config.premiumIntentWindowHours * 60 * 60 * 1000
  );
  const premiumIntentEventCount = await paywallEventModel.countDocuments({
    userId,
    eventType: { $in: Array.from(PREMIUM_INTENT_EVENT_TYPES) },
    createdAt: { $gte: intentWindowStart },
  });

  if (premiumIntentEventCount < config.premiumIntentThreshold) {
    return "insufficient_premium_intent";
  }

  if (lastInterruptivePaywallAt) {
    const cooldownMs = config.interruptiveCooldownHours * 60 * 60 * 1000;

    if (now - lastInterruptivePaywallAt.getTime() < cooldownMs) {
      return "interruptive_cooldown_active";
    }
  }

  const interruptiveImpressionCount = await paywallEventModel.countDocuments({
    userId,
    eventType: "paywall_impression",
    wasInterruptive: true,
    createdAt: { $gte: new Date(now - THIRTY_DAYS_MS) },
  });

  if (interruptiveImpressionCount >= config.interruptiveMaxShowsPer30Days) {
    return "interruptive_cap_reached";
  }

  if (Math.random() > config.interruptiveProbability) {
    return "interruptive_random_hold";
  }

  return null;
};

const getPaywallConfig = async (
  userId: string,
  input: PaywallConfigInput
): Promise<PaywallDecision | null> => {
  await ensureDefaultPaywallSetup();

  const [user, config, templates, offerings] = await Promise.all([
    userModel.findById(userId).exec(),
    paywallConfigModel.findOne({ key: "global" }).exec(),
    paywallTemplateModel.find().exec(),
    paywallOfferingModel.find().exec(),
  ]);

  if (!user || !config) {
    return null;
  }

  const triggerMode = input.triggerMode || "contextual";
  const screenKey = input.screenKey || null;

  if (!config.enabled) {
    return {
      shouldShow: false,
      placementKey: input.placementKey,
      screenKey,
      triggerMode,
      wasInterruptive: triggerMode === "interruptive",
      reason: "paywall_disabled",
      template: null,
      offerings: [],
    };
  }

  if (user.isPremium) {
    return {
      shouldShow: false,
      placementKey: input.placementKey,
      screenKey,
      triggerMode,
      wasInterruptive: triggerMode === "interruptive",
      reason: "user_already_premium",
      template: null,
      offerings: [],
    };
  }

  const placement = config.placements.find(
    item => item.key === input.placementKey && item.enabled
  );

  if (!placement) {
    return {
      shouldShow: false,
      placementKey: input.placementKey,
      screenKey,
      triggerMode,
      wasInterruptive: triggerMode === "interruptive",
      reason: "placement_disabled",
      template: null,
      offerings: [],
    };
  }

  if (triggerMode === "interruptive") {
    if (!placement.interruptiveEnabled) {
      return {
        shouldShow: false,
        placementKey: input.placementKey,
        screenKey,
        triggerMode,
        wasInterruptive: true,
        reason: "interruptive_not_enabled",
        template: null,
        offerings: [],
      };
    }

    const interruptiveBlockReason = await shouldAllowInterruptivePaywall({
      userId,
      config,
      ...(screenKey ? { screenKey } : {}),
      ...(input.currentStage ? { currentStage: input.currentStage } : {}),
      ...(user.lastInterruptivePaywallAt
        ? { lastInterruptivePaywallAt: user.lastInterruptivePaywallAt }
        : {}),
    });

    if (interruptiveBlockReason) {
      return {
        shouldShow: false,
        placementKey: input.placementKey,
        screenKey,
        triggerMode,
        wasInterruptive: true,
        reason: interruptiveBlockReason,
        template: null,
        offerings: [],
      };
    }
  }

  const templatesByKey = new Map(
    templates.map(template => [template.key, template] as const)
  );
  const offeringsByKey = new Map(
    offerings.map(offering => [offering.key, offering] as const)
  );

  const basePlacement =
    triggerMode === "interruptive" && placement.interruptiveTemplateKey
      ? {
          ...placement,
          templateKey: placement.interruptiveTemplateKey,
        }
      : placement;
  const resolved = resolveTemplateForPlacement({
    placement: basePlacement,
    templatesByKey,
    offeringsByKey,
  });

  if (!resolved.template || !resolved.offerings.length) {
    return {
      shouldShow: false,
      placementKey: input.placementKey,
      screenKey,
      triggerMode,
      wasInterruptive: triggerMode === "interruptive",
      reason: resolved.reason,
      template: null,
      offerings: [],
    };
  }

  return {
    shouldShow: true,
    placementKey: input.placementKey,
    screenKey,
    triggerMode,
    wasInterruptive: triggerMode === "interruptive",
    reason: resolved.reason,
    template: normalizeResolvedTemplate(resolved.template),
    offerings: resolved.offerings.map(normalizeResolvedOffering),
  };
};

const trackPaywallEvent = async (
  userId: string,
  input: TrackPaywallEventInput
) => {
  await ensureDefaultPaywallSetup();

  const event = await paywallEventModel.create({
    userId,
    placementKey: input.placementKey,
    screenKey: input.screenKey || null,
    eventType: input.eventType,
    templateKey: input.templateKey || null,
    offeringKey: input.offeringKey || null,
    wasInterruptive: Boolean(input.wasInterruptive),
    metadata: input.metadata || null,
  });

  const shouldUpdateLastInterruptive =
    input.wasInterruptive && input.eventType === "paywall_impression";
  const shouldUpdateLastPaywallEvent =
    PREMIUM_INTENT_EVENT_TYPES.has(input.eventType) ||
    input.eventType === "paywall_impression";

  if (shouldUpdateLastInterruptive || shouldUpdateLastPaywallEvent) {
    await userModel.updateOne(
      { _id: userId },
      {
        $set: {
          ...(shouldUpdateLastInterruptive
            ? { lastInterruptivePaywallAt: event.createdAt }
            : {}),
          ...(shouldUpdateLastPaywallEvent
            ? { lastPaywallEventAt: event.createdAt }
            : {}),
        },
      }
    );
  }

  return {
    eventId: event._id.toString(),
    createdAt: event.createdAt.toISOString(),
  };
};

const syncPaywallPurchase = async (
  userId: string,
  input: SyncPaywallPurchaseInput
) => {
  await ensureDefaultPaywallSetup();

  const offering = await paywallOfferingModel.findOne({
    key: input.offeringKey,
  });

  if (!offering) {
    return null;
  }

  const now = new Date();
  const premiumUpdate = {
    isPremium: true,
    premiumPlanKey: getMembershipPlanKeyFromOfferingKey(input.offeringKey),
    premiumActivatedAt: now,
    premiumSource: "revenuecat_client_sync",
  };

  let user = null;

  if (input.offeringKey === "lifetime") {
    user = await userModel.findOneAndUpdate(
      { _id: userId, lifetimePurchaseRecordedAt: null },
      {
        $set: {
          ...premiumUpdate,
          lifetimePurchaseRecordedAt: now,
        },
      },
      { new: true }
    );

    if (user) {
      await paywallOfferingModel.updateOne(
        { key: "lifetime" },
        { $inc: { purchasedUsersCount: 1 } }
      );
    } else {
      user = await userModel.findByIdAndUpdate(
        userId,
        { $set: premiumUpdate },
        { new: true }
      );
    }
  } else {
    user = await userModel.findByIdAndUpdate(
      userId,
      { $set: premiumUpdate },
      { new: true }
    );
  }

  if (!user) {
    return null;
  }

  await paywallEventModel.create({
    userId,
    placementKey: "purchase_sync",
    screenKey: null,
    eventType: input.wasRestore ? "restore_success" : "purchase_success",
    templateKey: null,
    offeringKey: input.offeringKey,
    wasInterruptive: false,
    metadata: {
      revenueCatOfferingId: input.revenueCatOfferingId,
      revenueCatPackageId: input.revenueCatPackageId,
      store: input.store,
      entitlementId: input.entitlementId,
      wasRestore: Boolean(input.wasRestore),
    },
  });

  return buildUserProfilePayload(user);
};

export {
  ensureDefaultPaywallSetup,
  getMissingDefaultPlacements,
  getMissingTemplatePlacementKeys,
  getPaywallConfig,
  resolveTemplateForPlacement,
  shouldAllowInterruptivePaywall,
  syncPaywallPurchase,
  trackPaywallEvent,
};
export type {
  PaywallConfigInput,
  PaywallDecision,
  ResolvedOffering,
  ResolvedTemplate,
  SyncPaywallPurchaseInput,
  TrackPaywallEventInput,
};
