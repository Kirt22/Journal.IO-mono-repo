import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { userModel } from "../../schema/user.schema";
import {
  AiAnalysisDisabledError,
  getInsightsAiAnalysis,
} from "./insights.service";

type FindByIdQueryResult<T> = {
  select: () => {
    lean: () => {
      exec: () => Promise<T>;
    };
  };
};

const userTarget = userModel as unknown as {
  findById: (userId: string) => FindByIdQueryResult<unknown>;
};

const originalFindById = userTarget.findById;

afterEach(() => {
  userTarget.findById = originalFindById;
});

test("getInsightsAiAnalysis blocks opted-out users before loading AI analysis", async () => {
  userTarget.findById = () => ({
    select: () => ({
      lean: () => ({
        exec: async () => ({
          onboardingContext: {
            aiOptIn: false,
          },
        }),
      }),
    }),
  });

  await assert.rejects(
    () => getInsightsAiAnalysis("user-123"),
    (error: unknown) => {
      assert.ok(error instanceof AiAnalysisDisabledError);
      assert.equal(
        (error as Error).message,
        "AI analysis is turned off for this account."
      );
      return true;
    }
  );
});
