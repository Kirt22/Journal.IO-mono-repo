import assert from "node:assert/strict";
import test from "node:test";
import {
  appleMobileSignInSchema,
  googleMobileSignInSchema,
  registerFromGoogleOAuthSchema,
} from "./auth.validators";

test("googleMobileSignInSchema accepts a valid mobile token payload", () => {
  const result = googleMobileSignInSchema.safeParse({
    body: {
      idToken: "google-id-token",
      onboardingContext: {
        reminderPreference: "Evening",
        aiOptIn: false,
      },
      onboardingCompleted: true,
    },
  });

  assert.equal(result.success, true);
});

test("googleMobileSignInSchema rejects an empty token payload", () => {
  const result = googleMobileSignInSchema.safeParse({
    body: {
      idToken: "",
    },
  });

  assert.equal(result.success, false);
});

test("appleMobileSignInSchema accepts a valid mobile token payload", () => {
  const result = appleMobileSignInSchema.safeParse({
    body: {
      identityToken: "apple-identity-token",
      nonce: "raw-apple-nonce-value",
      email: "alex@example.com",
      fullName: {
        givenName: "Alex",
        familyName: "Appleseed",
      },
      onboardingContext: {
        reminderPreference: "Evening",
        aiOptIn: false,
      },
      onboardingCompleted: true,
    },
  });

  assert.equal(result.success, true);
});

test("appleMobileSignInSchema accepts Apple's repeated sign-in null profile fields", () => {
  const result = appleMobileSignInSchema.safeParse({
    body: {
      identityToken: "apple-identity-token",
      nonce: "raw-apple-nonce-value",
      email: null,
      fullName: null,
      onboardingCompleted: true,
    },
  });

  assert.equal(result.success, true);
});

test("appleMobileSignInSchema rejects an empty token payload", () => {
  const result = appleMobileSignInSchema.safeParse({
    body: {
      identityToken: "",
      nonce: "raw-apple-nonce-value",
    },
  });

  assert.equal(result.success, false);
});

test("registerFromGoogleOAuthSchema still accepts the legacy route payload", () => {
  const result = registerFromGoogleOAuthSchema.safeParse({
    body: {
      googleIdToken: "google-id-token",
    },
  });

  assert.equal(result.success, true);
});
