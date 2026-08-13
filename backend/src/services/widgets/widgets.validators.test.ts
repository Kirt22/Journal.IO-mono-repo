import assert from "node:assert/strict";
import test from "node:test";
import { widgetMoodCheckInSchema, widgetSessionSchema } from "./widgets.validators";

test("widgetSessionSchema accepts a bounded iOS installation identifier", () => {
  const result = widgetSessionSchema.safeParse({
    body: {
      platform: "ios",
      installationId: "4B72A6B1-843F-49FA-97DC-2DEED20CD125",
    },
  });

  assert.equal(result.success, true);
});

test("widgetSessionSchema rejects unsupported platforms and extra identity fields", () => {
  assert.equal(
    widgetSessionSchema.safeParse({
      body: { platform: "android", installationId: "installation-123" },
    }).success,
    false
  );
  assert.equal(
    widgetSessionSchema.safeParse({
      body: {
        platform: "ios",
        installationId: "installation-123",
        userId: "another-user",
      },
    }).success,
    false
  );
});

test("widgetMoodCheckInSchema accepts only the established mood values", () => {
  assert.equal(
    widgetMoodCheckInSchema.safeParse({
      body: { mood: "good" },
      headers: { "x-client-timezone": "Asia/Kolkata" },
    }).success,
    true
  );
  assert.equal(
    widgetMoodCheckInSchema.safeParse({ body: { mood: "anxious" } }).success,
    false
  );
});
