import { createHash } from "node:crypto";

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ISO_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const SCRATCH_DATABASE_PATTERN = /^journal_io_demo_capture_[a-z0-9_-]+$/;

const startOfLocalDay = value =>
  new Date(value.getFullYear(), value.getMonth(), value.getDate());

export const addLocalDays = (value, amount) => {
  const next = new Date(value);
  next.setDate(next.getDate() + amount);
  return next;
};

export const dateForOffset = (anchor, dayOffset, timeOfDay = "12:00") => {
  const [hour, minute] = timeOfDay.split(":").map(Number);
  const date = addLocalDays(startOfLocalDay(anchor), dayOffset);
  date.setHours(hour, minute, 0, 0);
  return date;
};

export const toLocalDateKey = value => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const sha256 = value =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

export const assertScratchCaptureEnvironment = ({ env, uri }) => {
  if (env.NODE_ENV === "production" || env.MONGO_STAGE === "prod") {
    throw new Error("Demo capture is forbidden in a production runtime.");
  }
  if (!uri) {
    throw new Error("Set DEMO_CAPTURE_MONGO_URI to an isolated scratch database.");
  }

  const parsed = new URL(uri);
  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  if (!SCRATCH_DATABASE_PATTERN.test(databaseName)) {
    throw new Error(
      "Demo capture database must be named journal_io_demo_capture_<scenario>.",
    );
  }

  const applicationUris = [
    env.MONGO_URI,
    env.MONGO_URI_LOCAL,
    env.MONGO_URI_DEV,
    env.MONGO_URI_PROD,
  ].filter(Boolean);
  if (applicationUris.includes(uri)) {
    throw new Error("Demo capture URI must not equal an application database URI.");
  }

  return databaseName;
};

export const assertAuthoredScenario = scenario => {
  if (!scenario || typeof scenario !== "object") {
    throw new Error("Scenario fixture must be a JSON object.");
  }
  if (scenario.fictional !== true) {
    throw new Error("Scenario must explicitly declare fictional: true.");
  }
  if (!Array.isArray(scenario.entries) || scenario.entries.length !== 30) {
    throw new Error("Scenario must contain exactly 30 fictional entries.");
  }

  const offsets = scenario.entries.map(entry => entry.dayOffset).sort((a, b) => a - b);
  const expectedOffsets = Array.from({ length: 30 }, (_, index) => index - 29);
  if (JSON.stringify(offsets) !== JSON.stringify(expectedOffsets)) {
    throw new Error("Entry dayOffset values must be contiguous from -29 through 0.");
  }

  scenario.entries.forEach(entry => {
    if (!TIME_PATTERN.test(entry.timeOfDay || "")) {
      throw new Error(`Invalid timeOfDay for dayOffset ${entry.dayOffset}.`);
    }
    if (![1, 2, 3, 4, 5].includes(entry.mood)) {
      throw new Error(`Invalid mood for dayOffset ${entry.dayOffset}.`);
    }
    if (
      !Array.isArray(entry.answers) ||
      entry.answers.length !== 3 ||
      entry.answers.some(answer => typeof answer !== "string" || !answer.trim())
    ) {
      throw new Error(`Entry ${entry.dayOffset} needs three non-empty answers.`);
    }
  });

  if (
    !Array.isArray(scenario.askJadeQuestions) ||
    scenario.askJadeQuestions.length < 3 ||
    scenario.askJadeQuestions.length > 5
  ) {
    throw new Error("Scenario needs 3-5 Ask Jade questions.");
  }
  if (!scenario.askJadeFallbackQuestion?.trim()) {
    throw new Error("Scenario needs an Ask Jade fallback question.");
  }
  if (!offsets.includes(scenario.filmingEntryDayOffset)) {
    throw new Error("filmingEntryDayOffset must reference an authored entry.");
  }
  if (!offsets.includes(scenario.goalSourceDayOffset)) {
    throw new Error("goalSourceDayOffset must reference an authored entry.");
  }
};

const dayOffsetFromDate = (value, anchor) => {
  const date = startOfLocalDay(value);
  const base = startOfLocalDay(anchor);
  return Math.round((date.getTime() - base.getTime()) / 86_400_000);
};

const relativeDateToken = (date, anchor, format) => ({
  $demoDate: {
    dayOffset: dayOffsetFromDate(date, anchor),
    ...(format === "iso"
      ? {
          timeOfDay: `${String(date.getHours()).padStart(2, "0")}:${String(
            date.getMinutes(),
          ).padStart(2, "0")}`,
        }
      : {}),
    format,
  },
});

export const normalizeCapturedDates = (value, anchor) => {
  if (value instanceof Date) {
    return relativeDateToken(value, anchor, "iso");
  }
  if (Array.isArray(value)) {
    return value.map(item => normalizeCapturedDates(item, anchor));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        normalizeCapturedDates(item, anchor),
      ]),
    );
  }
  if (typeof value === "string" && DATE_KEY_PATTERN.test(value)) {
    return relativeDateToken(new Date(`${value}T12:00:00`), anchor, "dateKey");
  }
  if (typeof value === "string" && ISO_PATTERN.test(value)) {
    return relativeDateToken(new Date(value), anchor, "iso");
  }
  return value;
};

export const authoredHashInput = scenario => ({
  id: scenario.id,
  entries: scenario.entries,
  askJadeQuestions: scenario.askJadeQuestions,
  askJadeFallbackQuestion: scenario.askJadeFallbackQuestion,
  filmingEntryDayOffset: scenario.filmingEntryDayOffset,
  goalSourceDayOffset: scenario.goalSourceDayOffset,
});
