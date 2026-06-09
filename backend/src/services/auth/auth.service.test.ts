import assert from "node:assert/strict";
import crypto from "node:crypto";
import test, { afterEach } from "node:test";
import { userModel } from "../../schema/user.schema";
import {
  requestPasswordReset,
  resetAppleIdentityTokenVerifierForTests,
  resetGoogleIdTokenVerifierForTests,
  resetPassword,
  setAppleIdentityTokenVerifierForTests,
  setGoogleIdTokenVerifierForTests,
  signInWithEmail,
  signInWithApple,
  signInWithGoogle,
} from "./auth.service";

type AuthLookupQuery = Record<string, unknown>;

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
  refreshTokenHash?: string | null;
  refreshTokenExpiresAt?: Date | null;
  passwordResetTokenHash?: string | null;
  passwordResetExpiresAt?: Date | null;
  passwordResetRequestedAt?: Date | null;
  onboardingContext?: {
    aiOptIn?: boolean | null;
    goals?: string[];
  } | null;
  emailVerified: boolean;
  emailVerifiedAt: Date | null;
  save: () => Promise<UserDocument>;
};

const userTarget = userModel as unknown as {
  findOne: (query: AuthLookupQuery) => Promise<UserDocument | null>;
  create: (payload: Record<string, unknown>) => Promise<UserDocument>;
  updateOne: (...args: unknown[]) => Promise<unknown>;
};

const originalFindOne = userTarget.findOne;
const originalCreate = userTarget.create;
const originalUpdateOne = userTarget.updateOne;
const originalConsoleInfo = console.info;
const originalNodeEnv = process.env.NODE_ENV;
const originalAuthEmailHeloHost = process.env.AUTH_EMAIL_HELO_HOST;
const originalAuthEmailDeliveryMode = process.env.AUTH_EMAIL_DELIVERY_MODE;

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
    refreshTokenHash: null,
    refreshTokenExpiresAt: null,
    passwordResetTokenHash: null,
    passwordResetExpiresAt: null,
    passwordResetRequestedAt: null,
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
  console.info = originalConsoleInfo;
  resetAppleIdentityTokenVerifierForTests();
  resetGoogleIdTokenVerifierForTests();
  delete process.env.JWT_ACCESS_SECRET;
  delete process.env.AUTH_PASSWORD_RESET_APP_URL;
  delete process.env.AUTH_PASSWORD_RESET_EXPIRES_IN;
  if (originalNodeEnv === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = originalNodeEnv;
  }
  if (originalAuthEmailHeloHost === undefined) {
    delete process.env.AUTH_EMAIL_HELO_HOST;
  } else {
    process.env.AUTH_EMAIL_HELO_HOST = originalAuthEmailHeloHost;
  }
  if (originalAuthEmailDeliveryMode === undefined) {
    delete process.env.AUTH_EMAIL_DELIVERY_MODE;
  } else {
    process.env.AUTH_EMAIL_DELIVERY_MODE = originalAuthEmailDeliveryMode;
  }
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

test("requestPasswordReset stores a hashed token and returns a dev reset link", async () => {
  const existingUser = buildUserDocument({
    passwordHash: buildLegacyPasswordHash("old-password"),
    emailVerified: true,
    emailVerifiedAt: new Date("2026-04-04T10:00:00.000Z"),
  });
  let saveCount = 0;

  existingUser.save = async () => {
    saveCount += 1;
    return existingUser;
  };

  userTarget.findOne = async query => {
    if (query.email === "alex@example.com") {
      return existingUser;
    }

    return null;
  };

  const result = await requestPasswordReset({
    email: "Alex@Example.com",
  });

  assert.equal(result.ok, true);
  assert.equal(result.challenge.email, "alex@example.com");
  assert.match(result.challenge.resetToken || "", /^[a-f0-9]{64}$/);
  assert.match(
    result.challenge.resetLink || "",
    /^http:\/\/localhost:3000\/reset-password\?token=[a-f0-9]{64}$/
  );
  assert.match(existingUser.passwordResetTokenHash || "", /^[a-f0-9]{64}$/);
  assert.ok(existingUser.passwordResetExpiresAt);
  assert.ok(existingUser.passwordResetRequestedAt);
  assert.equal(saveCount, 1);
});

test("requestPasswordReset also works for verified accounts without a stored password", async () => {
  const existingUser = buildUserDocument({
    passwordHash: null,
    emailPasswordHash: null,
    authProviders: ["google"],
    emailVerified: true,
    emailVerifiedAt: new Date("2026-04-04T10:00:00.000Z"),
  });
  const loggedMessages: string[] = [];
  let saveCount = 0;

  existingUser.save = async () => {
    saveCount += 1;
    return existingUser;
  };

  userTarget.findOne = async query => {
    if (query.email === "alex@example.com") {
      return existingUser;
    }

    return null;
  };
  console.info = (message?: unknown, ...optionalParams: unknown[]) => {
    loggedMessages.push(
      [message, ...optionalParams]
        .map(value =>
          typeof value === "string" ? value : JSON.stringify(value)
        )
        .join(" ")
    );
  };

  const result = await requestPasswordReset({
    email: "alex@example.com",
  });

  assert.equal(result.ok, true);
  assert.equal(result.challenge.email, "alex@example.com");
  assert.match(result.challenge.resetToken || "", /^[a-f0-9]{64}$/);
  assert.match(
    result.challenge.resetLink || "",
    /^http:\/\/localhost:3000\/reset-password\?token=[a-f0-9]{64}$/
  );
  assert.match(existingUser.passwordResetTokenHash || "", /^[a-f0-9]{64}$/);
  assert.ok(existingUser.passwordResetExpiresAt);
  assert.ok(existingUser.passwordResetRequestedAt);
  assert.equal(saveCount, 1);
  assert.ok(loggedMessages.some(message => /delivery_attempt/.test(message)));
  assert.ok(loggedMessages.some(message => /"hasStoredPassword":false/.test(message)));
});

test("requestPasswordReset respects an explicit reset app url override", async () => {
  process.env.AUTH_PASSWORD_RESET_APP_URL = "journalio://reset-password";

  const existingUser = buildUserDocument({
    passwordHash: buildLegacyPasswordHash("old-password"),
    emailVerified: true,
    emailVerifiedAt: new Date("2026-04-04T10:00:00.000Z"),
  });

  existingUser.save = async () => existingUser;

  userTarget.findOne = async query => {
    if (query.email === "alex@example.com") {
      return existingUser;
    }

    return null;
  };

  const result = await requestPasswordReset({
    email: "alex@example.com",
  });

  assert.equal(result.ok, true);
  assert.match(
    result.challenge.resetLink || "",
    /^journalio:\/\/reset-password\?token=[a-f0-9]{64}$/
  );
});

test("requestPasswordReset defaults to the hosted browser reset page in production", async () => {
  process.env.NODE_ENV = "production";
  process.env.AUTH_EMAIL_HELO_HOST = "api.journalio.app";
  process.env.AUTH_EMAIL_DELIVERY_MODE = "console";
  const loggedMessages: string[] = [];

  const existingUser = buildUserDocument({
    passwordHash: buildLegacyPasswordHash("old-password"),
    emailVerified: true,
    emailVerifiedAt: new Date("2026-04-04T10:00:00.000Z"),
  });

  existingUser.save = async () => existingUser;

  userTarget.findOne = async query => {
    if (query.email === "alex@example.com") {
      return existingUser;
    }

    return null;
  };
  console.info = (message?: unknown, ...optionalParams: unknown[]) => {
    loggedMessages.push(
      [message, ...optionalParams]
        .map(value =>
          typeof value === "string" ? value : JSON.stringify(value)
        )
        .join(" ")
    );
  };

  const result = await requestPasswordReset({
    email: "alex@example.com",
  });

  assert.equal(result.ok, true);
  assert.equal(result.challenge.resetLink, undefined);
  assert.ok(
    loggedMessages.some(message =>
      /^(\[Auth\] Password reset link for alex@example\.com: )https:\/\/api\.journalio\.app\/reset-password\?token=[a-f0-9]{64}$/.test(
        message
      )
    )
  );
});

test("requestPasswordReset returns a generic success for unknown emails", async () => {
  let saveCount = 0;
  const loggedMessages: string[] = [];

  userTarget.findOne = async () => null;
  userTarget.updateOne = async () => {
    saveCount += 1;
    return { acknowledged: true };
  };
  console.info = (message?: unknown, ...optionalParams: unknown[]) => {
    loggedMessages.push(
      [message, ...optionalParams]
        .map(value =>
          typeof value === "string" ? value : JSON.stringify(value)
        )
        .join(" ")
    );
  };

  const result = await requestPasswordReset({
    email: "missing@example.com",
  });

  assert.equal(result.ok, true);
  assert.equal(result.challenge.email, "missing@example.com");
  assert.equal(result.challenge.resetToken, undefined);
  assert.equal(result.challenge.resetLink, undefined);
  assert.equal(saveCount, 0);
  assert.ok(loggedMessages.some(message => /user_not_found/.test(message)));
});

test("requestPasswordReset returns a generic success for unverified email accounts", async () => {
  const existingUser = buildUserDocument({
    passwordHash: buildLegacyPasswordHash("old-password"),
    emailVerified: false,
    emailVerifiedAt: null,
  });
  const loggedMessages: string[] = [];
  let saveCount = 0;

  existingUser.save = async () => {
    saveCount += 1;
    return existingUser;
  };

  userTarget.findOne = async query => {
    if (query.email === "alex@example.com") {
      return existingUser;
    }

    return null;
  };
  console.info = (message?: unknown, ...optionalParams: unknown[]) => {
    loggedMessages.push(
      [message, ...optionalParams]
        .map(value =>
          typeof value === "string" ? value : JSON.stringify(value)
        )
        .join(" ")
    );
  };

  const result = await requestPasswordReset({
    email: "alex@example.com",
  });

  assert.equal(result.ok, true);
  assert.equal(result.challenge.email, "alex@example.com");
  assert.equal(result.challenge.resetToken, undefined);
  assert.equal(result.challenge.resetLink, undefined);
  assert.equal(saveCount, 0);
  assert.ok(loggedMessages.some(message => /email_not_verified/.test(message)));
});

test("resetPassword rejects an invalid or expired token", async () => {
  userTarget.findOne = async () => null;

  const result = await resetPassword({
    token: "f".repeat(64),
    password: "new-password",
  });

  assert.equal(result.ok, false);

  if (result.ok) {
    return;
  }

  assert.equal(result.status, 400);
  assert.equal(result.code, "PASSWORD_RESET_TOKEN_INVALID");
});

test("resetPassword updates the password and clears reset and refresh tokens", async () => {
  process.env.JWT_ACCESS_SECRET = "test-access-secret";
  const resetToken = "a".repeat(64);
  const resetTokenHash = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");
  const existingUser = buildUserDocument({
    passwordHash: buildLegacyPasswordHash("old-password"),
    emailPasswordHash: buildLegacyPasswordHash("old-password"),
    emailVerified: true,
    emailVerifiedAt: new Date("2026-04-04T10:00:00.000Z"),
    refreshTokenHash: "stored-refresh-token-hash",
    refreshTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
    passwordResetTokenHash: resetTokenHash,
    passwordResetExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
    passwordResetRequestedAt: new Date(),
  });
  let saveCount = 0;

  existingUser.save = async () => {
    saveCount += 1;
    return existingUser;
  };

  userTarget.findOne = async query => {
    if (query.passwordResetTokenHash === resetTokenHash) {
      return existingUser;
    }

    if (query.email === "alex@example.com") {
      return existingUser;
    }

    return null;
  };
  userTarget.updateOne = async () => ({ acknowledged: true });

  const result = await resetPassword({
    token: resetToken,
    password: "new-password",
  });

  assert.equal(result.ok, true);
  assert.equal(saveCount, 1);
  assert.equal(existingUser.passwordResetTokenHash, null);
  assert.equal(existingUser.passwordResetExpiresAt, null);
  assert.equal(existingUser.passwordResetRequestedAt, null);
  assert.equal(existingUser.refreshTokenHash, null);
  assert.equal(existingUser.refreshTokenExpiresAt, null);

  const signInResult = await signInWithEmail({
    email: "alex@example.com",
    password: "new-password",
  });

  assert.equal(signInResult.ok, true);
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
