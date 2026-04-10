import { z } from "zod";
import {
  PAYWALL_EVENT_TYPES,
} from "../../schema/paywallEvent.schema";
import { PAYWALL_OFFERING_KEYS } from "../../schema/paywallOffering.schema";

const getPaywallConfigSchema = z.object({
  body: z.object({}).optional(),
  params: z.object({}).optional(),
  query: z.object({
    placementKey: z.string().min(1, "placementKey is required"),
    screenKey: z.string().min(1).optional(),
    currentStage: z.string().min(1).optional(),
    triggerMode: z.enum(["contextual", "interruptive"]).optional(),
  }),
});

const trackPaywallEventSchema = z.object({
  body: z.object({
    placementKey: z.string().min(1, "placementKey is required"),
    screenKey: z.string().min(1).optional(),
    eventType: z.enum(PAYWALL_EVENT_TYPES),
    templateKey: z.string().min(1).optional(),
    offeringKey: z.enum(PAYWALL_OFFERING_KEYS).optional(),
    wasInterruptive: z.boolean().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

const syncPaywallPurchaseSchema = z.object({
  body: z.object({
    offeringKey: z.enum(PAYWALL_OFFERING_KEYS),
    revenueCatOfferingId: z.string().min(1, "revenueCatOfferingId is required"),
    revenueCatPackageId: z.string().min(1, "revenueCatPackageId is required"),
    store: z.string().min(1, "store is required"),
    entitlementId: z.string().min(1, "entitlementId is required"),
    wasRestore: z.boolean().optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export {
  getPaywallConfigSchema,
  syncPaywallPurchaseSchema,
  trackPaywallEventSchema,
};
