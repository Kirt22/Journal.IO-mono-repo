import mongoose, { Document, Model } from "mongoose";
import { connectMongoDB } from "../config/mongo.db.config";
import {
  PAYWALL_OFFERING_KEYS,
  type PaywallOfferingKey,
} from "./paywallOffering.schema";

export const PAYWALL_TEMPLATE_KEYS = [
  "weekly-standard",
  "monthly-standard",
  "yearly-commitment",
  "post-auth-trial",
  "post-auth-exit-offer",
  "lifetime-launch",
] as const;

export type PaywallTemplateKey = (typeof PAYWALL_TEMPLATE_KEYS)[number];

export type PaywallFeatureCard = {
  title: string;
  body: string;
  footer?: string | null;
};

export interface IPaywallTemplate extends Document {
  _id: mongoose.Types.ObjectId;
  key: PaywallTemplateKey;
  title: string;
  headline: string;
  subheadline?: string | null;
  heroBadgeLabel?: string | null;
  purchaseChipTitle?: string | null;
  purchaseChipBody?: string | null;
  featureCarouselTitle?: string | null;
  socialProofLine?: string | null;
  footerLegal?: string | null;
  featureList: PaywallFeatureCard[];
  primaryOfferingKey: PaywallOfferingKey;
  secondaryOfferingKeys: PaywallOfferingKey[];
  visibleOfferingKeys: PaywallOfferingKey[];
  enabled: boolean;
  fallbackTemplateKey?: PaywallTemplateKey | null;
  showIfOfferingKeysAvailable: PaywallOfferingKey[];
  placementKeys: string[];
  createdAt: Date;
  updatedAt: Date;
}

const paywallTemplateSchema = new mongoose.Schema<IPaywallTemplate>(
  {
    key: {
      type: String,
      enum: PAYWALL_TEMPLATE_KEYS,
      required: true,
      unique: true,
      trim: true,
    },
    title: { type: String, required: true, trim: true },
    headline: { type: String, required: true, trim: true },
    subheadline: { type: String, default: null, trim: true },
    heroBadgeLabel: { type: String, default: null, trim: true },
    purchaseChipTitle: { type: String, default: null, trim: true },
    purchaseChipBody: { type: String, default: null, trim: true },
    featureCarouselTitle: { type: String, default: null, trim: true },
    socialProofLine: { type: String, default: null, trim: true },
    footerLegal: { type: String, default: null, trim: true },
    featureList: {
      type: [
        new mongoose.Schema<PaywallFeatureCard>(
          {
            title: { type: String, required: true, trim: true },
            body: { type: String, required: true, trim: true },
            footer: { type: String, default: null, trim: true },
          },
          { _id: false }
        ),
      ],
      default: [],
      required: true,
    },
    primaryOfferingKey: {
      type: String,
      enum: PAYWALL_OFFERING_KEYS,
      required: true,
    },
    secondaryOfferingKeys: {
      type: [String],
      enum: PAYWALL_OFFERING_KEYS,
      default: [],
      required: true,
    },
    visibleOfferingKeys: {
      type: [String],
      enum: PAYWALL_OFFERING_KEYS,
      default: [],
      required: true,
    },
    enabled: { type: Boolean, required: true, default: true },
    fallbackTemplateKey: {
      type: String,
      enum: PAYWALL_TEMPLATE_KEYS,
      default: null,
    },
    showIfOfferingKeysAvailable: {
      type: [String],
      enum: PAYWALL_OFFERING_KEYS,
      default: [],
      required: true,
    },
    placementKeys: {
      type: [String],
      default: [],
      required: true,
    },
  },
  { timestamps: true }
);

export const paywallTemplateModel: Model<IPaywallTemplate> =
  connectMongoDB.model<IPaywallTemplate>(
    "paywall_templates",
    paywallTemplateSchema
  );
