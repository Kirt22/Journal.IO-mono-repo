import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { adminConfigModel } from "../../schema/adminConfig.schema";
import { getHomeOfferConfig } from "./admin.service";

const configTarget = adminConfigModel as unknown as {
  findOneAndUpdate: (
    filter: Record<string, unknown>,
    update: Record<string, unknown>,
    options: Record<string, unknown>
  ) => {
    lean: () => {
      exec: () => Promise<{ homeSummerOfferVisible?: boolean } | null>;
    };
  };
};

const originalFindOneAndUpdate = configTarget.findOneAndUpdate;

afterEach(() => {
  configTarget.findOneAndUpdate = originalFindOneAndUpdate;
});

test("getHomeOfferConfig returns the stored global summer offer flag", async () => {
  configTarget.findOneAndUpdate = () =>
    ({
      lean: () => ({
        exec: async () => ({ homeSummerOfferVisible: false }),
      }),
    }) as ReturnType<typeof configTarget.findOneAndUpdate>;

  const config = await getHomeOfferConfig();

  assert.deepEqual(config, { homeSummerOfferVisible: false });
});

test("getHomeOfferConfig defaults the summer offer to visible when the document is missing", async () => {
  configTarget.findOneAndUpdate = () =>
    ({
      lean: () => ({
        exec: async () => null,
      }),
    }) as ReturnType<typeof configTarget.findOneAndUpdate>;

  const config = await getHomeOfferConfig();

  assert.deepEqual(config, { homeSummerOfferVisible: true });
});
