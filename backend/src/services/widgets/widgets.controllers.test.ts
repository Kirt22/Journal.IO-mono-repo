import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import type { Request, Response } from "express";
import { moodCheckInModel } from "../../schema/mood.schema";
import { getMoodDateKey } from "../mood/mood.service";
import { logWidgetMoodController } from "./widgets.controllers";

type MoodDocument = {
  toObject: () => {
    _id: { toString: () => string };
    mood: "good";
    moodDateKey: string;
    createdAt: Date;
    updatedAt: Date;
  };
};

const moodTarget = moodCheckInModel as unknown as {
  findOne: (...args: unknown[]) => {
    exec: () => Promise<MoodDocument | null>;
    sort: () => { exec: () => Promise<MoodDocument | null> };
  };
};

const originalFindOne = moodTarget.findOne;

afterEach(() => {
  moodTarget.findOne = originalFindOne;
});

test("logWidgetMoodController returns the effective mood without exposing record details", async () => {
  const effectiveMoodDateKey = getMoodDateKey(new Date(), "UTC");
  const createdAt = new Date("2026-07-22T12:00:00.000Z");
  const existingMood: MoodDocument = {
    toObject: () => ({
      _id: { toString: () => "private-mood-id" },
      mood: "good",
      moodDateKey: "2026-07-22",
      createdAt,
      updatedAt: createdAt,
    }),
  };
  moodTarget.findOne = () => ({
    exec: async () => existingMood,
    sort: () => ({ exec: async () => existingMood }),
  });
  const request = {
    widgetSession: {
      sessionId: "session-123",
      userId: "user-123",
      platform: "ios",
      installationId: "installation-123",
    },
    headers: { "x-client-timezone": "UTC" },
    body: { mood: "terrible" },
  } as unknown as Request;
  let statusCode = 200;
  let payload: unknown;
  const response = {
    status(code: number) {
      statusCode = code;
      return response;
    },
    json(value: unknown) {
      payload = value;
      return response;
    },
  } as unknown as Response;

  await logWidgetMoodController(request, response);

  assert.equal(statusCode, 200);
  assert.deepEqual(payload, {
    success: true,
    message: "Your check-in has been saved.",
    data: {
      saved: true,
      moodDateKey: effectiveMoodDateKey,
      mood: "good",
      alreadyCheckedIn: true,
    },
  });
  assert.equal(JSON.stringify(payload).includes("private-mood-id"), false);
  assert.equal(JSON.stringify(payload).includes('"mood":"good"'), true);
});
