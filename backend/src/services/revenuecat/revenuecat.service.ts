import crypto from "node:crypto";
import https from "node:https";
import { URL } from "node:url";
import mongoose from "mongoose";
import {
  REVENUECAT_ENTITLEMENT_ID,
  getRevenueCatAllowedWebhookEnvironments,
  getRevenueCatAppId,
  getRevenueCatPlanKeyForProductId,
  getRevenueCatSecretApiKey,
  getRevenueCatWebhookAuthToken,
  isKnownRevenueCatProductId,
  isRevenueCatLifetimeProductId,
} from "../../config/revenueCat.config";
import { revenueCatWebhookEventModel } from "../../schema/revenueCatWebhookEvent.schema";
import { type IUser, userModel } from "../../schema/user.schema";
import { paywallOfferingModel } from "../../schema/paywallOffering.schema";
import {
  buildUserProfilePayload,
  type UserProfilePayload,
} from "../user/user.service";

type RevenueCatWebhookEventPayload = {
  id?: string | null;
  type: string;
  app_id?: string | null;
  app_user_id?: string | null;
  original_app_user_id?: string | null;
  aliases?: string[];
  transferred_from?: string[];
  transferred_to?: string[];
  environment?: string | null;
  product_id?: string | null;
  entitlement_ids?: string[] | null;
  purchased_at_ms?: number | null;
  event_timestamp_ms?: number | null;
  transaction_id?: string | number | null;
  original_transaction_id?: string | number | null;
};

type RevenueCatWebhookPayload = {
  api_version?: string;
  event: RevenueCatWebhookEventPayload;
};

type RevenueCatSubscription = {
  expires_date?: string | null;
  grace_period_expires_date?: string | null;
  purchase_date?: string | null;
  original_purchase_date?: string | null;
  unsubscribe_detected_at?: string | null;
  refunded_at?: string | null;
  billing_issues_detected_at?: string | null;
  store?: string | null;
};

type RevenueCatNonSubscription = {
  id?: string | null;
  purchase_date?: string | null;
  store?: string | null;
};

type RevenueCatSubscriber = {
  entitlements?: Record<
    string,
    {
      expires_date?: string | null;
      grace_period_expires_date?: string | null;
      product_identifier?: string | null;
      purchase_date?: string | null;
    }
  > | null;
  subscriptions?: Record<string, RevenueCatSubscription> | null;
  non_subscriptions?: Record<string, RevenueCatNonSubscription[]> | null;
};

type RevenueCatSubscriberResponse = {
  request_date?: string;
  request_date_ms?: number;
  subscriber?: RevenueCatSubscriber | null;
};

type RevenueCatSyncResult = {
  profile: UserProfilePayload;
  requestDate: Date;
  isPremium: boolean;
  isStale: boolean;
};

type ProcessRevenueCatWebhookResult = {
  kind: "processed" | "duplicate";
  eventKey: string;
  userIds: string[];
};

type RevenueCatErrorCode =
  | "revenuecat_api_error"
  | "revenuecat_auth_failed"
  | "revenuecat_purchase_pending"
  | "revenuecat_response_invalid"
  | "revenuecat_webhook_auth_failed"
  | "revenuecat_webhook_app_mismatch"
  | "revenuecat_webhook_environment_invalid"
  | "revenuecat_webhook_payload_invalid"
  | "revenuecat_user_not_found";

class RevenueCatServiceError extends Error {
  readonly statusCode: number;
  readonly retryable: boolean;
  readonly safeErrorCode: RevenueCatErrorCode;

  constructor(
    message: string,
    options: {
      statusCode: number;
      retryable?: boolean;
      safeErrorCode: RevenueCatErrorCode;
    }
  ) {
    super(message);
    this.name = "RevenueCatServiceError";
    this.statusCode = options.statusCode;
    this.retryable = options.retryable ?? false;
    this.safeErrorCode = options.safeErrorCode;
  }
}

const normalizeOptionalString = (value?: string | number | null) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed || null;
};

const parseOptionalDate = (value?: string | null) => {
  const normalized = normalizeOptionalString(value);

  if (!normalized) {
    return null;
  }

  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const isCanonicalObjectId = (value?: string | null) =>
  Boolean(value && mongoose.isValidObjectId(value) && String(new mongoose.Types.ObjectId(value)) === value);

const buildRevenueCatDigest = (value: string) =>
  crypto.createHash("sha256").update(value).digest();

const isAuthorizedRevenueCatWebhookRequest = (authorizationHeader?: string | null) => {
  const configuredToken = getRevenueCatWebhookAuthToken();
  const normalizedHeader = normalizeOptionalString(authorizationHeader);

  if (!configuredToken || !normalizedHeader) {
    return false;
  }

  return crypto.timingSafeEqual(
    buildRevenueCatDigest(normalizedHeader),
    buildRevenueCatDigest(`Bearer ${configuredToken}`)
  );
};

const getLegacyRevenueCatEventKey = (event: RevenueCatWebhookEventPayload) => {
  const fallbackParts = [
    normalizeOptionalString(event.type),
    normalizeOptionalString(event.app_user_id),
    normalizeOptionalString(event.original_app_user_id),
    normalizeOptionalString(event.product_id),
    normalizeOptionalString(event.transaction_id),
    normalizeOptionalString(event.original_transaction_id),
    typeof event.event_timestamp_ms === "number"
      ? String(event.event_timestamp_ms)
      : null,
    typeof event.purchased_at_ms === "number" ? String(event.purchased_at_ms) : null,
  ].filter((value): value is string => Boolean(value));

  if (fallbackParts.length < 4) {
    return null;
  }

  return crypto.createHash("sha256").update(fallbackParts.join("|")).digest("hex");
};

const getRevenueCatWebhookEventKey = (event: RevenueCatWebhookEventPayload) =>
  normalizeOptionalString(event.id) || getLegacyRevenueCatEventKey(event);

const isAllowedRevenueCatWebhookEnvironment = (environment?: string | null) => {
  const normalizedEnvironment = normalizeOptionalString(environment)?.toUpperCase();

  if (!normalizedEnvironment) {
    return false;
  }

  return getRevenueCatAllowedWebhookEnvironments().has(normalizedEnvironment);
};

const getRevenueCatSubscriberApiPath = (appUserId: string) =>
  `/v1/subscribers/${encodeURIComponent(appUserId)}`;

const requestRevenueCat = async <T>(path: string): Promise<T> => {
  const secretApiKey = getRevenueCatSecretApiKey();

  if (!secretApiKey) {
    throw new RevenueCatServiceError(
      "RevenueCat verification is not configured right now.",
      {
        statusCode: 500,
        safeErrorCode: "revenuecat_auth_failed",
      }
    );
  }

  const url = new URL(`https://api.revenuecat.com${path}`);

  return new Promise<T>((resolve, reject) => {
    const request = https.request(
      url,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${secretApiKey}`,
          Accept: "application/json",
        },
      },
      response => {
        const chunks: Buffer[] = [];

        response.on("data", chunk => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });

        response.on("end", () => {
          const rawBody = Buffer.concat(chunks).toString("utf8");
          const statusCode = response.statusCode || 500;
          let parsedBody: unknown = null;

          try {
            parsedBody = rawBody ? JSON.parse(rawBody) : {};
          } catch {
            reject(
              new RevenueCatServiceError(
                "RevenueCat returned an invalid response.",
                {
                  statusCode: 502,
                  retryable: true,
                  safeErrorCode: "revenuecat_response_invalid",
                }
              )
            );
            return;
          }

          if (statusCode >= 200 && statusCode < 300) {
            resolve(parsedBody as T);
            return;
          }

          if (statusCode === 401 || statusCode === 403) {
            reject(
              new RevenueCatServiceError(
                "RevenueCat rejected the verification request.",
                {
                  statusCode: 500,
                  safeErrorCode: "revenuecat_auth_failed",
                }
              )
            );
            return;
          }

          reject(
            new RevenueCatServiceError(
              "RevenueCat verification failed.",
              {
                statusCode: 503,
                retryable: statusCode >= 429,
                safeErrorCode: "revenuecat_api_error",
              }
            )
          );
        });
      }
    );

    request.on("error", error => {
      reject(
        new RevenueCatServiceError(
          error instanceof Error
            ? error.message
            : "RevenueCat verification failed.",
          {
            statusCode: 503,
            retryable: true,
            safeErrorCode: "revenuecat_api_error",
          }
        )
      );
    });

    request.end();
  });
};

const getLatestNonSubscriptionPurchase = (
  productId: string,
  subscriber?: RevenueCatSubscriber | null
) => {
  const purchases = subscriber?.non_subscriptions?.[productId] || [];

  return purchases.reduce<RevenueCatNonSubscription | null>((latest, current) => {
    const latestDate = parseOptionalDate(latest?.purchase_date || null);
    const currentDate = parseOptionalDate(current.purchase_date || null);

    if (!currentDate) {
      return latest;
    }

    if (!latestDate || currentDate > latestDate) {
      return current;
    }

    return latest;
  }, null);
};

const getLatestDate = (...dates: Array<Date | null>) =>
  dates.reduce<Date | null>((latest, current) => {
    if (!current) {
      return latest;
    }

    return !latest || current > latest ? current : latest;
  }, null);

const mapRevenueCatSubscriberState = (
  response: RevenueCatSubscriberResponse,
  existingUser: Pick<
    IUser,
    | "isPremium"
    | "premiumActivatedAt"
    | "lifetimePurchaseRecordedAt"
    | "premiumRevenueCatRequestDate"
  >
) => {
  const requestDate =
    parseOptionalDate(response.request_date || null) ||
    (typeof response.request_date_ms === "number"
      ? new Date(response.request_date_ms)
      : null) ||
    new Date();

  const entitlement =
    response.subscriber?.entitlements?.[REVENUECAT_ENTITLEMENT_ID] || null;
  const productId = normalizeOptionalString(entitlement?.product_identifier);
  const planKey = getRevenueCatPlanKeyForProductId(productId);
  const subscription =
    productId && response.subscriber?.subscriptions
      ? response.subscriber.subscriptions[productId] || null
      : null;
  const latestNonSubscription =
    productId ? getLatestNonSubscriptionPurchase(productId, response.subscriber) : null;
  const expiresAt = getLatestDate(
    parseOptionalDate(entitlement?.expires_date || null),
    parseOptionalDate(subscription?.expires_date || null),
    parseOptionalDate(entitlement?.grace_period_expires_date || null),
    parseOptionalDate(subscription?.grace_period_expires_date || null)
  );
  const isLifetime = isRevenueCatLifetimeProductId(productId);
  const isKnownEntitlement = Boolean(
    entitlement && planKey && isKnownRevenueCatProductId(productId)
  );
  const isPremium = Boolean(
    isKnownEntitlement &&
      !subscription?.refunded_at &&
      (isLifetime || Boolean(expiresAt && expiresAt > requestDate))
  );
  const verifiedPurchaseDate =
    parseOptionalDate(entitlement?.purchase_date || null) ||
    parseOptionalDate(subscription?.purchase_date || null) ||
    parseOptionalDate(subscription?.original_purchase_date || null) ||
    parseOptionalDate(latestNonSubscription?.purchase_date || null);
  const willRenew = isPremium
    ? isLifetime
      ? false
      : !Boolean(subscription?.unsubscribe_detected_at || subscription?.refunded_at)
    : null;
  const shouldPreserveActivatedAt =
    Boolean(existingUser.isPremium && existingUser.premiumActivatedAt);
  const premiumActivatedAt = isPremium
    ? shouldPreserveActivatedAt
      ? existingUser.premiumActivatedAt || verifiedPurchaseDate || requestDate
      : verifiedPurchaseDate || requestDate
    : null;
  const lifetimePurchaseRecordedAt =
    isPremium && isLifetime
      ? existingUser.lifetimePurchaseRecordedAt ||
        verifiedPurchaseDate ||
        requestDate
      : existingUser.lifetimePurchaseRecordedAt || null;

  return {
    requestDate,
    isPremium,
    planKey: isPremium ? planKey : null,
    productId: isPremium ? productId : null,
    expiresAt: isPremium ? expiresAt : null,
    willRenew,
    premiumActivatedAt,
    premiumVerifiedAt: requestDate,
    lifetimePurchaseRecordedAt,
  };
};

const buildPremiumUpdateFilter = (userId: string, requestDate: Date) => ({
  _id: userId,
  $or: [
    { premiumRevenueCatRequestDate: { $exists: false } },
    { premiumRevenueCatRequestDate: null },
    { premiumRevenueCatRequestDate: { $lte: requestDate } },
  ],
});

const resolveExistingUserIds = async (candidateIds: string[]) => {
  const canonicalIds = Array.from(
    new Set(candidateIds.map(identifier => identifier.trim()).filter(isCanonicalObjectId))
  );

  if (!canonicalIds.length) {
    return [];
  }

  const users = await userModel
    .find(
      {
        _id: {
          $in: canonicalIds.map(identifier => new mongoose.Types.ObjectId(identifier)),
        },
      },
      { _id: 1 }
    )
    .lean();

  return users.map(user => user._id.toString());
};

const resolveRevenueCatEventUserIds = async (
  event: RevenueCatWebhookEventPayload
) => {
  const directAppUserId = normalizeOptionalString(event.app_user_id);

  if (isCanonicalObjectId(directAppUserId)) {
    const [existingUserId] = await resolveExistingUserIds([
      directAppUserId as string,
    ]);

    if (existingUserId) {
      return [existingUserId];
    }
  }

  const aliasCandidates = [
    normalizeOptionalString(event.original_app_user_id),
    ...(event.aliases || []).map(identifier => normalizeOptionalString(identifier)),
  ].filter((identifier): identifier is string => Boolean(identifier));
  const existingAliasUserIds = await resolveExistingUserIds(aliasCandidates);

  if (existingAliasUserIds.length === 1) {
    return existingAliasUserIds;
  }

  return [];
};

const reconcileRevenueCatSubscriberForUser = async (
  userId: string
): Promise<RevenueCatSyncResult> => {
  const existingUser = await userModel.findById(userId, {
    isPremium: 1,
    premiumActivatedAt: 1,
    lifetimePurchaseRecordedAt: 1,
    premiumRevenueCatRequestDate: 1,
    name: 1,
    phoneNumber: 1,
    email: 1,
    premiumPlanKey: 1,
    avatarColor: 1,
    journalingGoals: 1,
    profileSetupCompleted: 1,
    onboardingCompleted: 1,
    profilePic: 1,
    onboardingContext: 1,
  });

  if (!existingUser) {
    throw new RevenueCatServiceError("We couldn't find your account.", {
      statusCode: 404,
      safeErrorCode: "revenuecat_user_not_found",
    });
  }

  const response = await requestRevenueCat<RevenueCatSubscriberResponse>(
    getRevenueCatSubscriberApiPath(userId)
  );
  const mappedState = mapRevenueCatSubscriberState(response, existingUser);
  const updateFilter = buildPremiumUpdateFilter(userId, mappedState.requestDate);

  const updatedUser = await userModel.findOneAndUpdate(
    updateFilter,
    {
      $set: {
        isPremium: mappedState.isPremium,
        premiumPlanKey: mappedState.planKey,
        premiumActivatedAt: mappedState.premiumActivatedAt,
        premiumProductId: mappedState.productId,
        premiumExpiresAt: mappedState.expiresAt,
        premiumWillRenew: mappedState.willRenew,
        premiumVerifiedAt: mappedState.premiumVerifiedAt,
        premiumRevenueCatRequestDate: mappedState.requestDate,
        revenueCatAppUserId: userId,
        premiumSource: "revenuecat_verified",
        lifetimePurchaseRecordedAt: mappedState.lifetimePurchaseRecordedAt,
      },
    },
    { new: true }
  );

  if (!updatedUser) {
    const currentUser = await userModel.findById(userId);

    if (!currentUser) {
      throw new RevenueCatServiceError("We couldn't find your account.", {
        statusCode: 404,
        safeErrorCode: "revenuecat_user_not_found",
      });
    }

    return {
      profile: buildUserProfilePayload(currentUser),
      requestDate: mappedState.requestDate,
      isPremium: Boolean(currentUser.isPremium),
      isStale: true,
    };
  }

  if (
    mappedState.isPremium &&
    isRevenueCatLifetimeProductId(mappedState.productId) &&
    !existingUser.lifetimePurchaseRecordedAt &&
    updatedUser.lifetimePurchaseRecordedAt
  ) {
    await paywallOfferingModel.updateOne(
      { key: "lifetime" },
      { $inc: { purchasedUsersCount: 1 } }
    );
  }

  return {
    profile: buildUserProfilePayload(updatedUser),
    requestDate: mappedState.requestDate,
    isPremium: mappedState.isPremium,
    isStale: false,
  };
};

const markRevenueCatWebhookEventFailure = async (
  eventKey: string,
  error: RevenueCatServiceError
) => {
  await revenueCatWebhookEventModel.updateOne(
    { eventKey },
    {
      $set: {
        processingState: "failed",
        retryable: error.retryable,
        safeErrorCode: error.safeErrorCode,
      },
    }
  );
};

const processRevenueCatWebhook = async (
  payload: RevenueCatWebhookPayload,
  authorizationHeader?: string | null
): Promise<ProcessRevenueCatWebhookResult> => {
  if (!isAuthorizedRevenueCatWebhookRequest(authorizationHeader)) {
    throw new RevenueCatServiceError("RevenueCat webhook authorization failed.", {
      statusCode: 401,
      safeErrorCode: "revenuecat_webhook_auth_failed",
    });
  }

  const event = payload.event;
  const eventKey = getRevenueCatWebhookEventKey(event);

  if (!eventKey) {
    throw new RevenueCatServiceError("RevenueCat webhook payload is invalid.", {
      statusCode: 400,
      safeErrorCode: "revenuecat_webhook_payload_invalid",
    });
  }

  const configuredAppId = getRevenueCatAppId();
  const eventAppId = normalizeOptionalString(event.app_id);

  if (configuredAppId && eventAppId && configuredAppId !== eventAppId) {
    throw new RevenueCatServiceError("RevenueCat webhook app did not match.", {
      statusCode: 400,
      safeErrorCode: "revenuecat_webhook_app_mismatch",
    });
  }

  if (!isAllowedRevenueCatWebhookEnvironment(event.environment)) {
    throw new RevenueCatServiceError(
      "RevenueCat webhook environment is not allowed.",
      {
        statusCode: 400,
        safeErrorCode: "revenuecat_webhook_environment_invalid",
      }
    );
  }

  const now = new Date();
  const existingEvent = await revenueCatWebhookEventModel.findOne({ eventKey });

  if (existingEvent?.processingState === "processed") {
    await revenueCatWebhookEventModel.updateOne(
      { _id: existingEvent._id },
      {
        $inc: { deliveryCount: 1 },
        $set: { lastReceivedAt: now },
      }
    );

    return { kind: "duplicate", eventKey, userIds: [] };
  }

  await revenueCatWebhookEventModel.updateOne(
    { eventKey },
    {
      $setOnInsert: {
        eventKey,
        eventId: normalizeOptionalString(event.id),
        eventType: event.type,
        appId: eventAppId,
        appUserId: normalizeOptionalString(event.app_user_id),
        originalAppUserId: normalizeOptionalString(event.original_app_user_id),
        transferredFrom: (event.transferred_from || []).map(value => value.trim()),
        transferredTo: (event.transferred_to || []).map(value => value.trim()),
        environment: normalizeOptionalString(event.environment),
        firstReceivedAt: now,
      },
      $set: {
        processingState: "processing",
        retryable: false,
        safeErrorCode: null,
        lastReceivedAt: now,
        lastAttemptedAt: now,
      },
      $inc: {
        attempts: 1,
        deliveryCount: existingEvent ? 1 : 0,
      },
    },
    { upsert: true }
  );

  try {
    const eventUserIds = await resolveRevenueCatEventUserIds(event);
    const transferredFromUserIds = await resolveExistingUserIds(
      event.transferred_from || []
    );
    const transferredToUserIds = await resolveExistingUserIds(
      event.transferred_to || []
    );
    const affectedUserIds = Array.from(
      new Set([...eventUserIds, ...transferredFromUserIds, ...transferredToUserIds])
    );

    let latestRequestDate: Date | null = null;

    for (const userId of affectedUserIds) {
      const syncResult = await reconcileRevenueCatSubscriberForUser(userId);

      if (!latestRequestDate || syncResult.requestDate > latestRequestDate) {
        latestRequestDate = syncResult.requestDate;
      }
    }

    await revenueCatWebhookEventModel.updateOne(
      { eventKey },
      {
        $set: {
          processingState: "processed",
          processedAt: new Date(),
          retryable: false,
          safeErrorCode: null,
          revenueCatRequestDate: latestRequestDate,
        },
      }
    );

    return {
      kind: existingEvent ? "duplicate" : "processed",
      eventKey,
      userIds: affectedUserIds,
    };
  } catch (error) {
    if (error instanceof RevenueCatServiceError) {
      await markRevenueCatWebhookEventFailure(eventKey, error);
      throw error;
    }

    const wrappedError = new RevenueCatServiceError(
      "RevenueCat webhook processing failed.",
      {
        statusCode: 500,
        safeErrorCode: "revenuecat_api_error",
      }
    );
    await markRevenueCatWebhookEventFailure(eventKey, wrappedError);
    throw wrappedError;
  }
};

const syncAuthenticatedRevenueCatEntitlement = async (userId: string) => {
  const result = await reconcileRevenueCatSubscriberForUser(userId);
  return result.profile;
};

type RevenueCatPurchaseVerificationOptions = {
  retryDelaysMs?: number[];
  reconcile?: (userId: string) => Promise<RevenueCatSyncResult>;
  wait?: (delayMs: number) => Promise<void>;
};

const waitForRevenueCatRetry = (delayMs: number) =>
  new Promise<void>(resolve => {
    setTimeout(resolve, delayMs);
  });

const syncAuthenticatedRevenueCatPurchase = async (
  userId: string,
  options: RevenueCatPurchaseVerificationOptions = {}
) => {
  const retryDelaysMs = options.retryDelaysMs || [0, 500, 1500];
  const reconcile = options.reconcile || reconcileRevenueCatSubscriberForUser;
  const wait = options.wait || waitForRevenueCatRetry;

  for (const delayMs of retryDelaysMs) {
    if (delayMs > 0) {
      await wait(delayMs);
    }

    const result = await reconcile(userId);

    if (result.isPremium) {
      return result.profile;
    }
  }

  throw new RevenueCatServiceError(
    "Your purchase is still being verified. Your access will update automatically.",
    {
      statusCode: 503,
      retryable: true,
      safeErrorCode: "revenuecat_purchase_pending",
    }
  );
};

const isRevenueCatServiceError = (
  error: unknown
): error is RevenueCatServiceError => error instanceof RevenueCatServiceError;

export {
  RevenueCatServiceError,
  getRevenueCatWebhookEventKey,
  isAllowedRevenueCatWebhookEnvironment,
  isAuthorizedRevenueCatWebhookRequest,
  isRevenueCatServiceError,
  mapRevenueCatSubscriberState,
  processRevenueCatWebhook,
  reconcileRevenueCatSubscriberForUser,
  resolveRevenueCatEventUserIds,
  syncAuthenticatedRevenueCatEntitlement,
  syncAuthenticatedRevenueCatPurchase,
};
