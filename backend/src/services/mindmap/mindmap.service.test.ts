import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { journalModel } from "../../schema/journal.schema";
import { mindMapEntryScoreModel } from "../../schema/mindMapEntryScore.schema";
import { userModel } from "../../schema/user.schema";
import { REFLECTION_REGION_IDS } from "../../helpers/reflectionMap.helpers";
import {
  buildRegionFocus,
  buildRegionTimeSeries,
  buildRegionTrendMap,
  getEntryMindMap,
} from "./mindmap.service";

const userTarget = userModel as unknown as {
  findById: (userId: string) => {
    select: () => { lean: () => { exec: () => Promise<unknown> } };
  };
};
const journalTarget = journalModel as unknown as {
  findOne: (query: unknown) => {
    select: () => { lean: () => { exec: () => Promise<unknown> } };
  };
};
const scoreTarget = mindMapEntryScoreModel as unknown as {
  find: (query: unknown) => {
    sort: () => { select: () => { lean: () => { exec: () => Promise<unknown[]> } } };
  };
};

const originalUserFindById = userTarget.findById;
const originalJournalFindOne = journalTarget.findOne;
const originalScoreFind = scoreTarget.find;

const PREMIUM_ACCESS = {
  isPremium: true,
  premiumPlanKey: "yearly",
  premiumExpiresAt: new Date("2099-01-01T00:00:00.000Z"),
  premiumSource: "revenuecat_verified",
};

afterEach(() => {
  userTarget.findById = originalUserFindById;
  journalTarget.findOne = originalJournalFindOne;
  scoreTarget.find = originalScoreFind;
});

const mockUser = (overrides: Record<string, unknown>) => {
  userTarget.findById = () => ({
    select: () => ({
      lean: () => ({ exec: async () => ({ ...PREMIUM_ACCESS, ...overrides }) }),
    }),
  });
};

const mockScoreRows = (rows: unknown[]) => {
  scoreTarget.find = () => ({
    sort: () => ({ select: () => ({ lean: () => ({ exec: async () => rows }) }) }),
  });
};

test("buildRegionFocus prefers the most-rising region over the strongest", () => {
  const focus = buildRegionFocus("self_reflection_identity", [
    { id: "self_reflection_identity", signalScore: 1, trend: "steady" },
    { id: "planning_self_control", signalScore: 0.6, trend: "rising" },
    { id: "memory_meaning", signalScore: 0.4, trend: "rising" },
  ]);

  assert.equal(focus.regionId, "planning_self_control");
  assert.ok(focus.body.length > 0);
});

test("buildRegionFocus falls back to the strongest region when nothing is rising", () => {
  const focus = buildRegionFocus("memory_meaning", [
    { id: "memory_meaning", signalScore: 0.9, trend: "steady" },
    { id: "planning_self_control", signalScore: 0.5, trend: "easing" },
  ]);

  assert.equal(focus.regionId, "memory_meaning");
});

test("buildRegionTrendMap returns all steady when there are too few scored entries", async () => {
  mockScoreRows([
    { regionScores: [], entryCreatedAt: new Date() },
    { regionScores: [], entryCreatedAt: new Date() },
  ]);

  const trends = await buildRegionTrendMap({ userId: "user-1" });

  assert.equal(trends.size, REFLECTION_REGION_IDS.length);
  assert.ok([...trends.values()].every(info => info.trend === "steady"));
});

test("buildRegionTrendMap flags a region as rising when recent entries emphasise it", async () => {
  const low = REFLECTION_REGION_IDS.map(id => ({ id, score: 0.1, confidence: 0.5 }));
  const high = REFLECTION_REGION_IDS.map(id => ({
    id,
    score: id === "planning_self_control" ? 0.9 : 0.1,
    confidence: 0.6,
  }));
  mockScoreRows([
    { regionScores: low, entryCreatedAt: new Date("2026-01-01") },
    { regionScores: low, entryCreatedAt: new Date("2026-01-02") },
    { regionScores: high, entryCreatedAt: new Date("2026-01-03") },
    { regionScores: high, entryCreatedAt: new Date("2026-01-04") },
  ]);

  const trends = await buildRegionTrendMap({ userId: "user-1" });

  assert.equal(trends.get("planning_self_control")?.trend, "rising");
});

test("buildRegionTimeSeries averages a region's score per day bucket", async () => {
  mockScoreRows([
    {
      regionScores: [{ id: "planning_self_control", score: 0.4, confidence: 0.5 }],
      entryCreatedAt: new Date("2026-07-01T09:00:00.000Z"),
    },
    {
      regionScores: [{ id: "planning_self_control", score: 0.6, confidence: 0.5 }],
      entryCreatedAt: new Date("2026-07-01T20:00:00.000Z"),
    },
    {
      regionScores: [{ id: "planning_self_control", score: 0.9, confidence: 0.5 }],
      entryCreatedAt: new Date("2026-07-02T10:00:00.000Z"),
    },
  ]);

  const { points } = await buildRegionTimeSeries({
    userId: "user-1",
    regionId: "planning_self_control",
    bucket: "day",
  });

  assert.deepEqual(
    points.map(point => point.dateKey),
    ["2026-07-01", "2026-07-02"]
  );
  assert.equal(points[0]?.value, 0.5); // (0.4 + 0.6) / 2
  assert.equal(points[1]?.value, 0.9);
});

test("buildRegionTimeSeries groups entries into weekly buckets", async () => {
  mockScoreRows([
    {
      regionScores: [{ id: "memory_meaning", score: 0.2, confidence: 0.5 }],
      entryCreatedAt: new Date("2026-07-01T09:00:00.000Z"), // Wed -> week of Mon Jun 29
    },
    {
      regionScores: [{ id: "memory_meaning", score: 0.4, confidence: 0.5 }],
      entryCreatedAt: new Date("2026-07-03T09:00:00.000Z"), // Fri -> same week
    },
    {
      regionScores: [{ id: "memory_meaning", score: 0.8, confidence: 0.5 }],
      entryCreatedAt: new Date("2026-07-08T09:00:00.000Z"), // next week (Mon Jul 6)
    },
  ]);

  const { points } = await buildRegionTimeSeries({
    userId: "user-1",
    regionId: "memory_meaning",
    bucket: "week",
  });

  assert.deepEqual(
    points.map(point => point.dateKey),
    ["2026-06-29", "2026-07-06"]
  );
  assert.ok(Math.abs((points[0]?.value ?? 0) - 0.3) < 1e-9);
  assert.equal(points[1]?.value, 0.8);
});

test("buildRegionTimeSeries returns an empty series for an empty window", async () => {
  mockScoreRows([]);

  const { points } = await buildRegionTimeSeries({
    userId: "user-1",
    regionId: "emotional_intensity",
    bucket: "day",
  });

  assert.deepEqual(points, []);
});

test("getEntryMindMap returns null when the entry is not owned by the user", async () => {
  mockUser({});
  journalTarget.findOne = () => ({
    select: () => ({ lean: () => ({ exec: async () => null }) }),
  });

  const result = await getEntryMindMap("user-1", "missing-journal");

  assert.equal(result, null);
});
