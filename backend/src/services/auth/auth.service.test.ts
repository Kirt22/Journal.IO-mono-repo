import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { userModel } from "../../schema/user.schema";
import {
  resetGoogleIdTokenVerifierForTests,
  setGoogleIdTokenVerifierForTests,
  signInWithGoogle,
} from "./auth.service";

type GoogleLookupQuery =
  | { googleUserId: string }
  | { email: string };

type UserDocument = {
  _id: { toString: () => string };
  name: string;
  phoneNumber: string | null;
  email: string | null;
  googleUserId: string | null;
  authProviders: string[];
  journalingGoals: string[];
  avatarColor: string | null;
  profileSetupCompleted: boolean;
  onboardingCompleted: boolean;
  profilePic: string | null;
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
    authProviders: ["email"],
    journalingGoals: [],
    avatarColor: null,
    profileSetupCompleted: false,
    onboardingCompleted: false,
    profilePic: null,
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
  resetGoogleIdTokenVerifierForTests();
  delete process.env.JWT_ACCESS_SECRET;
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
  assert.ok(existingUser.authProviders.includes("google"));
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
