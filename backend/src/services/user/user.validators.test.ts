import assert from "node:assert/strict";
import test from "node:test";
import { updatePremiumStatusSchema } from "./user.validators";

test("updatePremiumStatusSchema accepts the legacy iOS premium payload", () => {
  const enabledResult = updatePremiumStatusSchema.safeParse({
    body: { isPremium: true },
  });
  const disabledResult = updatePremiumStatusSchema.safeParse({
    body: { isPremium: false },
  });

  assert.equal(enabledResult.success, true);
  assert.equal(disabledResult.success, true);
});
