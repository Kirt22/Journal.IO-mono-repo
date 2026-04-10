import mongoose, { Document, Model } from "mongoose";
import { connectMongoDB } from "../config/mongo.db.config";

export const PAYWALL_OFFERING_KEYS = [
  "weekly",
  "monthly",
  "yearly",
  "lifetime",
] as const;

export type PaywallOfferingKey = (typeof PAYWALL_OFFERING_KEYS)[number];

export interface IPaywallOffering extends Document {
  _id: mongoose.Types.ObjectId;
  key: PaywallOfferingKey;
  title: string;
  price: string;
  priceSuffix?: string | null;
  subtitle?: string | null;
  badge?: string | null;
  highlight?: string | null;
  enabled: boolean;
  sortOrder: number;
  revenueCatOfferingId?: string | null;
  revenueCatPackageId?: string | null;
  purchasedUsersCount: number;
  purchaseLimit?: number | null;
  createdAt: Date;
  updatedAt: Date;
}

const paywallOfferingSchema = new mongoose.Schema<IPaywallOffering>(
  {
    key: {
      type: String,
      enum: PAYWALL_OFFERING_KEYS,
      required: true,
      unique: true,
      trim: true,
    },
    title: { type: String, required: true, trim: true },
    price: { type: String, required: true, trim: true },
    priceSuffix: { type: String, default: null, trim: true },
    subtitle: { type: String, default: null, trim: true },
    badge: { type: String, default: null, trim: true },
    highlight: { type: String, default: null, trim: true },
    enabled: { type: Boolean, required: true, default: true },
    sortOrder: { type: Number, required: true, default: 0 },
    revenueCatOfferingId: { type: String, default: null, trim: true },
    revenueCatPackageId: { type: String, default: null, trim: true },
    purchasedUsersCount: { type: Number, required: true, default: 0, min: 0 },
    purchaseLimit: { type: Number, default: null, min: 1 },
  },
  { timestamps: true }
);

paywallOfferingSchema.index({ sortOrder: 1 });

export const paywallOfferingModel: Model<IPaywallOffering> =
  connectMongoDB.model<IPaywallOffering>(
    "paywall_offerings",
    paywallOfferingSchema
  );
