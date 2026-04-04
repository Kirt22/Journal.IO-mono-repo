import assert from "node:assert/strict";
import test from "node:test";
import {
  googleMobileSignInSchema,
  registerFromGoogleOAuthSchema,
} from "./auth.validators";

test("googleMobileSignInSchema accepts a valid mobile token payload", () => {
  const result = googleMobileSignInSchema.safeParse({
    body: {
      idToken: "google-id-token",
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

test("registerFromGoogleOAuthSchema still accepts the legacy route payload", () => {
  const result = registerFromGoogleOAuthSchema.safeParse({
    body: {
      googleIdToken: "google-id-token",
    },
  });

  assert.equal(result.success, true);
});
