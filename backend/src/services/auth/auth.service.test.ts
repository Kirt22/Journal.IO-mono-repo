import assert from "node:assert/strict";
import crypto from "node:crypto";
import test, { afterEach } from "node:test";
import { userModel } from "../../schema/user.schema";
import {
  resetAppleIdentityTokenVerifierForTests,
  resetGoogleIdTokenVerifierForTests,
  setAppleIdentityTokenVerifierForTests,
  setGoogleIdTokenVerifierForTests,
  signInWithEmail,
  signInWithApple,
  signInWithGoogle,
} from "./auth.service";

type GoogleLookupQuery =
  | { googleUserId: string }
  | { appleUserId: string }
  | { email: string };

type UserDocument = {
  _id: { toString: () => string };
  name: string;
  phoneNumber: string | null;
  email: string | null;
  googleUserId: string | null;
  appleUserId: string | null;
  authProviders: string[];
  passwordHash?: string | null;
  emailPasswordHash?: string | null;
  journalingGoals: string[];
  avatarColor: string | null;
  profileSetupCompleted: boolean;
  onboardingCompleted: boolean;
  profilePic: string | null;
  isPremium?: boolean;
  premiumPlanKey?: "weekly" | "monthly" | "yearly" | "lifetime" | null;
  premiumActivatedAt?: Date | null;
  onboardingContext?: {
    aiOptIn?: boolean | null;
    goals?: string[];
  } | null;
  emailVerified: boolean;
  emailVerifiedAt: Date | null;
  save: () => Promise<UserDocument>;
};

const userTarget = userModel as unknown as {
  findOne: (query: GoogleLookupQuery) => Promise<UserDocument | null>;
  create: (payload: Record<string, unknown>) => Promise<UserDocument>;
  updateOne: (...args: unknown[]) => Promise<unknown>;
};

const originalFindOne = userTarget.findOne;
const originalCreate = userTarget.create;
const originalUpdateOne = userTarget.updateOne;

const buildLegacyPasswordHash = (password: string) => {
  const salt = "test-salt";
  const derivedKey = crypto.scryptSync(password, salt, 64).toString("hex");

  return `${salt}:${derivedKey}`;
};

const buildUserDocument = (
  overrides: Partial<Omit<UserDocument, "save">> = {}
): UserDocument => {
  const user: UserDocument = {
    _id: {
      toString: () => "user-123",
    },
    name: "Alex",
    phoneNumber: null,
    email: "alex@example.com",
    googleUserId: null,
    appleUserId: null,
    authProviders: ["email"],
    passwordHash: null,
    emailPasswordHash: null,
    journalingGoals: [],
    avatarColor: null,
    profileSetupCompleted: false,
    onboardingCompleted: false,
    profilePic: null,
    isPremium: false,
    premiumPlanKey: null,
    premiumActivatedAt: null,
    emailVerified: false,
    emailVerifiedAt: null,
    save: async () => user,
    ...overrides,
  };

  return user;
};

afterEach(() => {
  userTarget.findOne = originalFindOne;
  userTarget.create = originalCreate;
  userTarget.updateOne = originalUpdateOne;
  resetAppleIdentityTokenVerifierForTests();
  resetGoogleIdTokenVerifierForTests();
  delete process.env.JWT_ACCESS_SECRET;
});

test("signInWithEmail persists onboarding AI preference for an existing user", async () => {
  process.env.JWT_ACCESS_SECRET = "test-access-secret";

  const password = "strong-password";
  const existingUser = buildUserDocument({
    passwordHash: buildLegacyPasswordHash(password),
    emailVerified: true,
    emailVerifiedAt: new Date("2026-04-04T10:00:00.000Z"),
    onboardingContext: {
      aiOptIn: true,
      goals: [],
    },
  });
  const refreshUpdates: unknown[] = [];
  let saveCount = 0;

  existingUser.save = async () => {
    saveCount += 1;
    return existingUser;
  };

  userTarget.findOne = async query => {
    if ("email" in query && query.email === "alex@example.com") {
      return existingUser;
    }

    return null;
  };
  userTarget.updateOne = async (...args) => {
    refreshUpdates.push(args);
    return { acknowledged: true };
  };

  const result = await signInWithEmail({
    email: "alex@example.com",
    password,
    onboardingContext: {
      aiOptIn: false,
      goals: ["Daily Reflection"],
    },
    onboardingCompleted: true,
  });

  assert.equal(result.ok, true);

  if (!result.ok) {
    return;
  }

  assert.equal(existingUser.onboardingContext?.aiOptIn, false);
  assert.deepEqual(existingUser.journalingGoals, ["Daily Reflection"]);
  assert.equal(existingUser.onboardingCompleted, true);
  assert.equal(result.user.aiOptIn, false);
  assert.deepEqual(result.user.journalingGoals, ["Daily Reflection"]);
  assert.equal(saveCount, 1);
  assert.equal(refreshUpdates.length, 1);
});

test("signInWithGoogle links a verified Google identity onto an existing email user", async () => {
  process.env.JWT_ACCESS_SECRET = "test-access-secret";

  const existingUser = buildUserDocument();
  const refreshUpdates: unknown[] = [];

  setGoogleIdTokenVerifierForTests(async () => ({
    googleSub: "google-sub-123",
    email: "alex@example.com",
    emailVerified: true,
    name: "Alex",
    picture: "https://example.com/avatar.png",
  }));

  userTarget.findOne = async query => {
    if ("googleUserId" in query) {
      return null;
    }

    if ("email" in query && query.email === "alex@example.com") {
      return existingUser;
    }

    return null;
  };
  userTarget.updateOne = async (...args) => {
    refreshUpdates.push(args);
    return { acknowledged: true };
  };

  const result = await signInWithGoogle({
    idToken: "google-id-token",
    onboardingContext: {
      aiOptIn: false,
      goals: ["Daily Reflection"],
    },
    onboardingCompleted: true,
  });

  assert.equal(result.ok, true);

  if (!result.ok) {
    return;
  }

  assert.equal(result.user.email, "alex@example.com");
  assert.equal(existingUser.googleUserId, "google-sub-123");
  assert.equal(existingUser.profilePic, "https://example.com/avatar.png");
  assert.equal(existingUser.emailVerified, true);
  assert.equal(existingUser.onboardingCompleted, true);
  assert.equal(existingUser.onboardingContext?.aiOptIn, false);
  assert.deepEqual(existingUser.journalingGoals, ["Daily Reflection"]);
  assert.ok(existingUser.authProviders.includes("google"));
  assert.equal(result.user.aiOptIn, false);
  assert.match(result.tokens.accessToken, /\S+/);
  assert.match(result.tokens.refreshToken, /\S+/);
  assert.equal(refreshUpdates.length, 1);
});

test("signInWithGoogle rejects linking when the email is already bound to another Google identity", async () => {
  process.env.JWT_ACCESS_SECRET = "test-access-secret";

  const existingUser = buildUserDocument({
    googleUserId: "google-sub-existing",
    authProviders: ["email", "google"],
    emailVerified: true,
    emailVerifiedAt: new Date("2026-04-04T10:00:00.000Z"),
  });

  setGoogleIdTokenVerifierForTests(async () => ({
    googleSub: "google-sub-new",
    email: "alex@example.com",
    emailVerified: true,
    name: "Alex",
    picture: null,
  }));

  userTarget.findOne = async query => {
    if ("googleUserId" in query) {
      return null;
    }

    if ("email" in query && query.email === "alex@example.com") {
      return existingUser;
    }

    return null;
  };
  userTarget.updateOne = async () => ({ acknowledged: true });

  const result = await signInWithGoogle({
    idToken: "google-id-token",
  });

  assert.equal(result.ok, false);

  if (result.ok) {
    return;
  }

  assert.equal(result.status, 409);
  assert.equal(result.code, "GOOGLE_ACCOUNT_ALREADY_LINKED");
});

test("signInWithApple links a verified Apple identity onto an existing email user", async () => {
  process.env.JWT_ACCESS_SECRET = "test-access-secret";

  const existingUser = buildUserDocument();
  const refreshUpdates: unknown[] = [];

  setAppleIdentityTokenVerifierForTests(async () => ({
    appleSub: "apple-sub-123",
    email: "alex@example.com",
    emailVerified: true,
    name: "Alex Appleseed",
  }));

  userTarget.findOne = async query => {
    if ("appleUserId" in query) {
      return null;
    }

    if ("email" in query && query.email === "alex@example.com") {
      return existingUser;
    }

    return null;
  };
  userTarget.updateOne = async (...args) => {
    refreshUpdates.push(args);
    return { acknowledged: true };
  };

  const result = await signInWithApple({
    identityToken: "apple-identity-token",
    nonce: "raw-apple-nonce-value",
    onboardingContext: {
      aiOptIn: false,
      goals: ["Daily Reflection"],
    },
    onboardingCompleted: true,
  });

  assert.equal(result.ok, true);

  if (!result.ok) {
    return;
  }

  assert.equal(result.user.email, "alex@example.com");
  assert.equal(existingUser.appleUserId, "apple-sub-123");
  assert.equal(existingUser.emailVerified, true);
  assert.equal(existingUser.onboardingCompleted, true);
  assert.equal(existingUser.onboardingContext?.aiOptIn, false);
  assert.deepEqual(existingUser.journalingGoals, ["Daily Reflection"]);
  assert.ok(existingUser.authProviders.includes("apple"));
  assert.equal(result.user.aiOptIn, false);
  assert.match(result.tokens.accessToken, /\S+/);
  assert.match(result.tokens.refreshToken, /\S+/);
  assert.equal(refreshUpdates.length, 1);
});

test("signInWithApple rejects linking when the email is already bound to another Apple identity", async () => {
  process.env.JWT_ACCESS_SECRET = "test-access-secret";

  const existingUser = buildUserDocument({
    appleUserId: "apple-sub-existing",
    authProviders: ["email", "apple"],
    emailVerified: true,
    emailVerifiedAt: new Date("2026-04-04T10:00:00.000Z"),
  });

  setAppleIdentityTokenVerifierForTests(async () => ({
    appleSub: "apple-sub-new",
    email: "alex@example.com",
    emailVerified: true,
    name: "Alex",
  }));

  userTarget.findOne = async query => {
    if ("appleUserId" in query) {
      return null;
    }

    if ("email" in query && query.email === "alex@example.com") {
      return existingUser;
    }

    return null;
  };
  userTarget.updateOne = async () => ({ acknowledged: true });

  const result = await signInWithApple({
    identityToken: "apple-identity-token",
    nonce: "raw-apple-nonce-value",
  });

  assert.equal(result.ok, false);

  if (result.ok) {
    return;
  }

  assert.equal(result.status, 409);
  assert.equal(result.code, "APPLE_ACCOUNT_ALREADY_LINKED");
});
