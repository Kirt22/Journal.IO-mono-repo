#!/usr/bin/env node
// Seed 30 consecutive days of guided journal entries onto a demo account, for
// marketing screenshots and video.
//
//   npm run build
//   node scripts/seed-demo-entries.mjs --email=someone@example.com            # dry run
//   node scripts/seed-demo-entries.mjs --email=someone@example.com --apply
//
// Flags
//   --email=<address>  demo account (required)
//   --apply            actually write; without it nothing is persisted
//   --wipe-all         delete ALL existing data for the account first, not just
//                      previously seeded rows. Analytics are aggregates, so one
//                      stray old entry shifts every percentage.
//   --model=<id>       model for this run only (default gpt-5.4-nano). Set
//                      in-process; backend/.env is never touched.
//   --strong=<id>      retry model when the cheap one returns a fallback
//                      (default gpt-5.4-mini). --strong=off disables retries.
//   --no-ai            skip every model call. Heuristic scores only — fast and
//                      free, for rehearsing the pipeline.
//
// WHY NOT THE HTTP API. POST /journal/create_journal cannot backdate: createdAt
// comes from { timestamps: true } and neither the validator, the controller nor
// CreateJournalInput accepts a date.
//
// WHY NOT RAW MONGO. content/title/aiPrompt/tags/images are AES-256-GCM encrypted
// by schema setters (journal.schema.ts:105), with the field path as AAD and
// JSON.stringify framing. Hand-built envelopes are easy to get subtly wrong, and
// FIELD_ENCRYPTION_MODE=migration would hide the mistake until it flips to
// enforced.
//
// SO: import the compiled models and services from dist/ and call the same
// functions the app calls — the pattern print-field-encryption-canaries.mjs
// established. Encryption, heuristics, AI scoring, the pattern graph and the
// insights rebuild are all the real code paths, just driven with backdated
// timestamps and awaited instead of fired and forgotten.

import process from "node:process";
import "dotenv/config";
import { MongoClient } from "mongodb";
import { decryptFieldValue } from "../dist/helpers/fieldEncryption.helpers.js";
import { DAYS as ALL_DAYS, GUIDED_QUESTIONS } from "./demo-seed-dataset.mjs";
import {
  SEED_TAG,
  findUserIdByEmail,
  teardownDemoData,
} from "./teardown-demo-entries.mjs";

const argv = process.argv.slice(2);
const readFlag = name => argv.includes(`--${name}`);
const readOption = (name, fallback = null) => {
  const prefix = `--${name}=`;
  const match = argv.find(arg => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : fallback;
};

const EMAIL = readOption("email");
const APPLY = readFlag("apply");
const WIPE_ALL = readFlag("wipe-all");
const NO_AI = readFlag("no-ai");
// Reapply detectedTopics to already-seeded entries and rebuild the insights
// cache. Costs nothing — no model calls — so the Topic Snapshot can be retuned
// without paying to regenerate 30 analyses.
const RETOPIC = readFlag("retopic");
// Repair already-stored majorInsight values in place. Also free — no model calls.
const TIDY = readFlag("tidy");
// Regenerate the cached weekly AI analysis. The weekly call passes neither a
// model nor a reasoningEffort (insights.service.ts:2234) and caps output at
// 1500 tokens — on a gpt-5.x reasoning model the reasoning alone exhausts that,
// the helper returns null, and the screen silently falls back to its
// deterministic "X kept returning across the week" template. A non-reasoning
// model spends that budget on the answer instead, so the real analysis lands.
const WEEKLY = readFlag("weekly");
const WEEKLY_MODEL = readOption("weekly-model", "gpt-4.1-mini");
const MODEL = readOption("model", "gpt-5.4-nano");
// Rehearse the whole pipeline on the first N days before paying for all 30.
const LIMIT = Number(readOption("limit", "0")) || Infinity;
const STRONG_MODEL = readOption("strong", "gpt-5.4-mini");
// Guided reflection defaults to reasoningEffort "high"
// (guided-reflection.service.ts:230) while max_output_tokens stays at 2400 —
// and on gpt-5.4 reasoning tokens are drawn from that same budget, so the
// session analysis returns status "incomplete" (max_output_tokens) and the
// helper degrades to its deterministic fallback. Lowering the effort for this
// run leaves room for the 8-centre payload to actually be emitted.
const EFFORT = readOption("effort", "low");

// Asia/Dubai, no DST, so a fixed offset is exact year-round. Pinning it here
// rather than trusting the host TZ keeps the run reproducible on any machine.
const LOCAL_OFFSET = "+04:00";
const TIME_ZONE = "Asia/Dubai";

// Matches the real guided save (FirstGuidedReflectionScreen.tsx:1929) exactly.
const ENTRY_TITLE = "Today's reflection";
const ENTRY_AI_PROMPT = "Onboarding first guided reflection";

// Mood check-ins are written at a fixed evening hour rather than at the entry's
// timestamp. Their date key is local, the entry's bucket is UTC, and decoupling
// them stops the two after-1am entries from landing a day's mood on the wrong key.
const MOOD_CHECK_IN_LOCAL_TIME = "20:15:00";

const DAYS = Number.isFinite(LIMIT) ? ALL_DAYS.slice(0, LIMIT) : ALL_DAYS;

const toUtc = localWallClock => new Date(`${localWallClock}${LOCAL_OFFSET}`);

const setModelEnv = model => {
  process.env.OPENAI_GUIDED_REFLECTION_REASONING_EFFORT = EFFORT;
  process.env.OPENAI_RESPONSES_MODEL = model;
  process.env.OPENAI_MODEL = model;
  process.env.OPENAI_MINDMAP_ENTRY_MODEL = model;
  process.env.OPENAI_GUIDED_REFLECTION_MODEL = model;
  process.env.OPENAI_GUIDED_REFLECTION_SESSION_ANALYSIS_MODEL = model;
};

/**
 * Byte-for-byte reproduction of composeFirstReflectionEntry
 * (frontend/src/screens/onboarding/FirstGuidedReflectionScreen.tsx:517-573),
 * the single writer of the guided content format. Nothing in the app parses
 * this back out — EntryDetailScreen prints entry.content verbatim — so the
 * format IS the guided entry as far as every screen is concerned.
 */
const composeGuidedContent = ({ good, hurdle, carry, reflection, thread }) => {
  const parts = [];

  if (good) parts.push(`One good or exciting thing from today:\n${good}`);
  if (hurdle) parts.push(`One hurdle or stressful moment:\n${hurdle}`);
  if (carry) parts.push(`What I want to carry into tomorrow:\n${carry}`);
  if (reflection) parts.push(`Journal.IO reflection:\n${reflection.trim()}`);

  const deeperLines = (thread || [])
    .filter(item => item.text.trim())
    .map(item => {
      const text = item.text.trim();

      if (item.role === "user") {
        return item.promptQuestion
          ? `Question:\n${item.promptQuestion}\nMy response:\n${text}`
          : `My response:\n${text}`;
      }

      if (item.role === "assistant") return `Journal.IO:\n${text}`;

      return text;
    });

  if (deeperLines.length) parts.push(`Going deeper:\n${deeperLines.join("\n\n")}`);

  return parts.join("\n\n");
};

/**
 * Two cosmetic repairs to majorInsight, which SessionAnalysisScreen.tsx:391
 * renders verbatim:
 *
 * 1. gpt-5.4-nano habitually opens with a literal "Major insight:" label.
 * 2. The field's JSON schema caps it at 180 characters
 *    (SESSION_ANALYSIS_MAJOR_INSIGHT_MAX_LENGTH), and OpenAI's strict structured
 *    outputs enforce maxLength by constrained decoding — it stops mid-word rather
 *    than writing something shorter. On a first pass 17 of 30 came back chopped.
 *
 * Both are trims, never rewrites: the wording stays exactly as the model produced
 * it, cut back to the last point where it still reads as a finished thought.
 */
const tidyMajorInsight = analysis => {
  const original = analysis?.majorInsight;
  if (!original) return analysis;

  let text = original.replace(/^\s*(major\s+insight|insight)\s*[:\u2014-]\s*/i, "").trim();

  if (!/[.!?]$/.test(text)) {
    // Prefer the last finished sentence; fall back to the last clause break, so
    // a single long sentence still ends somewhere deliberate.
    const sentenceEnd = Math.max(text.lastIndexOf(". "), text.lastIndexOf("! "), text.lastIndexOf("? "));
    const clauseEnd = Math.max(
      text.lastIndexOf(" \u2014 "),
      text.lastIndexOf("; "),
      text.lastIndexOf(", ")
    );
    const cut = sentenceEnd >= 40 ? sentenceEnd + 1 : clauseEnd >= 40 ? clauseEnd : -1;

    if (cut > 0) text = text.slice(0, cut).trim();
    else text = text.replace(/\s+\S*$/, "").trim(); // drop the half-written word

    text = text.replace(/[\s,;:\u2014-]+$/, "");
    if (text.length >= 20) text = `${text}.`;
  }

  // The schema floor is 20 characters; never hand back something shorter.
  if (text.length < 20) return analysis;

  return { ...analysis, majorInsight: text.charAt(0).toUpperCase() + text.slice(1) };
};

const buildPromptAnswers = day => [
  { ...GUIDED_QUESTIONS[0], answer: day.good },
  { ...GUIDED_QUESTIONS[1], answer: day.hurdle },
  { ...GUIDED_QUESTIONS[2], answer: day.carry },
];

const main = async () => {
  if (!EMAIL) {
    console.error("Usage: node scripts/seed-demo-entries.mjs --email=<address> [--apply] [--wipe-all] [--model=<id>] [--no-ai]");
    process.exit(1);
  }

  if (!NO_AI) setModelEnv(MODEL);

  const uri = process.env.MONGO_URI || process.env.MONGO_URI_LOCAL;
  if (!uri) throw new Error("Set MONGO_URI or MONGO_URI_LOCAL before seeding.");

  // Imported after the env is set so the model helpers read the override, and
  // lazily so --help-style misuse fails before touching Mongoose.
  const { journalModel } = await import("../dist/schema/journal.schema.js");
  const { moodCheckInModel } = await import("../dist/schema/mood.schema.js");
  const { persistEntryScore, runEntryAiScore } = await import("../dist/services/mindmap/mindmap.service.js");
  const { persistJournalSessionAnalysisSnapshot } = await import("../dist/services/journal/journalMetadata.service.js");
  const {
    createFirstReflectionSummary,
    createGuidedReflectionSessionAnalysis,
  } = await import("../dist/services/guided-reflection/guided-reflection.service.js");
  const { rebuildInsightsCache, markUserMindMapStale } = await import("../dist/services/insights/insights.service.js");
  const mongoose = (await import("mongoose")).default;
  const { init_mongoDB } = await import("../dist/config/mongo.db.config.js");

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();

  const userId = await findUserIdByEmail(db, EMAIL);
  const userIdString = userId.toString();

  console.log(`account   ${EMAIL} -> ${userIdString}`);
  console.log(`database  ${db.databaseName}`);
  console.log(`range     ${DAYS[0].date} -> ${DAYS[DAYS.length - 1].date} (${DAYS.length} days)`);
  console.log(`model     ${NO_AI ? "none (--no-ai)" : MODEL}${!NO_AI && STRONG_MODEL !== "off" ? ` (fallback retry: ${STRONG_MODEL})` : ""}`);
  if (!NO_AI) console.log(`effort    ${EFFORT}`);
  console.log(`marker    seedTag=${SEED_TAG}`);
  console.log(`mode      ${APPLY ? "APPLY (writing)" : "dry run (nothing written)"}`);
  console.log("");

  if (WEEKLY) {
    if (!APPLY) {
      console.log(`Would regenerate the weekly AI analysis with ${WEEKLY_MODEL}. Re-run with --apply.`);
      await client.close();
      return;
    }

    process.env.OPENAI_RESPONSES_MODEL = WEEKLY_MODEL;
    process.env.OPENAI_MODEL = WEEKLY_MODEL;

    await init_mongoDB();

    // Cached weekly reads are only recomputed when marked stale.
    await db
      .collection("insights")
      .updateOne(
        { userId },
        { $set: { aiAnalysisStale: true, aiAnalysisCacheKey: null, aiAnalysis: null } }
      );

    const { getInsightsAiAnalysis } = await import("../dist/services/insights/insights.service.js");
    const analysis = await getInsightsAiAnalysis(userIdString, { timeZone: TIME_ZONE });

    const isTemplated = (analysis.patterns || []).some(pattern =>
      pattern.insight?.includes("kept returning across the week")
    );

    console.log(`weekly window   ${analysis.window?.label} (${analysis.window?.activeDays} active days)`);
    console.log(`headline        ${analysis.summary?.headline}`);
    console.log(`patterns        ${(analysis.patterns || []).length}`);
    console.log(
      isTemplated
        ? "  ✗ still the deterministic template — the model call did not land"
        : "  ✓ real AI patterns"
    );

    for (const pattern of analysis.patterns || []) {
      console.log(`   • ${pattern.label}: ${pattern.insight}`);
    }

    await mongoose.disconnect().catch(() => undefined);
    await client.close();
    return;
  }

  if (TIDY) {
    if (!APPLY) {
      console.log("Would tidy stored majorInsight values. Re-run with --apply.");
      await client.close();
      return;
    }

    await init_mongoDB();

    const seeded = await db
      .collection("journals")
      .find({ userId, seedTag: SEED_TAG }, { projection: { _id: 1, sessionAnalysisSnapshot: 1 } })
      .sort({ createdAt: 1 })
      .toArray();

    let changed = 0;

    for (const journal of seeded) {
      const stored = journal.sessionAnalysisSnapshot?.analysis;
      if (!stored) continue;

      const analysis = decryptFieldValue(stored, { path: "analysis" });
      const tidied = tidyMajorInsight(analysis);
      if (tidied.majorInsight === analysis.majorInsight) continue;

      // Snapshots are write-once unless the caller states the stored one is stale.
      await persistJournalSessionAnalysisSnapshot({
        userId: userIdString,
        journalId: journal._id.toString(),
        analysis: tidied,
        source: "guided",
        replaceExisting: true,
      });
      changed += 1;
    }

    console.log(`Tidied ${changed} of ${seeded.length} majorInsight values.`);
    await mongoose.disconnect().catch(() => undefined);
    await client.close();
    return;
  }

  if (RETOPIC) {
    if (!APPLY) {
      console.log("Would reapply detectedTopics to seeded entries and rebuild insights.");
      await client.close();
      return;
    }

    const seeded = await db
      .collection("journals")
      .find({ userId, seedTag: SEED_TAG }, { projection: { createdAt: 1 } })
      .sort({ createdAt: 1 })
      .toArray();

    if (seeded.length !== DAYS.length) {
      throw new Error(
        `Expected ${DAYS.length} seeded entries, found ${seeded.length}. Run a full seed instead.`
      );
    }

    for (const [index, journal] of seeded.entries()) {
      await db
        .collection("journals")
        .updateOne({ _id: journal._id }, { $set: { detectedTopics: DAYS[index].topics } });
    }

    await init_mongoDB();
    await rebuildInsightsCache(userIdString);
    await markUserMindMapStale(userIdString);
    console.log(`Reapplied topics to ${seeded.length} entries and rebuilt insights.`);
    await printSummary({ db, userId, stats: { aiSnapshots: 0, fallbackSnapshots: 0, retried: 0, threads: 0 } });
    await mongoose.disconnect().catch(() => undefined);
    await client.close();
    return;
  }

  if (!APPLY) {
    const sample = DAYS[0];
    console.log("Sample entry that would be written (day 1, without the AI sections):");
    console.log("---");
    console.log(composeGuidedContent({ ...sample, reflection: "<AI reflection>", thread: [] }));
    console.log("---");
    console.log("");
    console.log(`Would remove: ${WIPE_ALL ? "ALL existing data for this account" : `previously seeded rows (${SEED_TAG})`}`);
    console.log(`Would write:  ${DAYS.length} guided journals, ${DAYS.length} mood check-ins, plus derived scores/insights.`);
    console.log("Re-run with --apply.");
    await client.close();
    return;
  }

  // Idempotency: clear our own marker (or everything, with --wipe-all) before
  // writing, so a re-run replaces rather than duplicates.
  console.log(`Clearing ${WIPE_ALL ? "all existing data" : "previously seeded rows"}...`);
  const removed = await teardownDemoData({ db, userId, all: WIPE_ALL, apply: true });
  const removedTotal = Object.values(removed).reduce((sum, count) => sum + count, 0);
  console.log(`  removed ${removedTotal} documents`);
  console.log("");

  // The models are registered on mongoose's default connection, which nothing
  // has opened yet — the raw driver above is a separate client used only for the
  // marker writes and the summary aggregations.
  await init_mongoDB();

  const stats = {
    entries: 0,
    aiSnapshots: 0,
    fallbackSnapshots: 0,
    retried: 0,
    aiScores: 0,
    heuristicScores: 0,
    threads: 0,
  };

  for (const day of DAYS) {
    const createdAt = toUtc(day.at);
    const promptAnswers = buildPromptAnswers(day);
    let reflection = "";
    let followUpQuestion = "";

    // The app's reflection paragraph and its follow-up question come from the
    // same endpoint the guided screen calls, so the copy reads identically.
    if (!NO_AI) {
      const summary = await createFirstReflectionSummary({ userId: userIdString, promptAnswers })
        .catch(error => {
          console.log(`  day ${day.day}: reflection failed (${error.message})`);
          return null;
        });

      if (summary) {
        reflection = summary.reflection || "";
        followUpQuestion = summary.followUpQuestion || "";
      }
    }

    const thread =
      day.deeper && followUpQuestion
        ? [{ role: "user", kind: "deeper_response", text: day.deeper, promptQuestion: followUpQuestion }]
        : [];

    if (thread.length) stats.threads += 1;

    const content = composeGuidedContent({
      good: day.good,
      hurdle: day.hurdle,
      carry: day.carry,
      reflection,
      thread,
    });

    // timestamps:false is what lets the explicit createdAt survive — with
    // timestamps on, Mongoose overwrites it at insert.
    const [journal] = await journalModel.create(
      [
        {
          userId,
          title: ENTRY_TITLE,
          content,
          type: "guided",
          entryKind: "journal",
          aiPrompt: ENTRY_AI_PROMPT,
          tags: day.tags,
          // Set explicitly rather than left to detectEntryMetadataHeuristically:
          // detectedTopics is merged with tags into insights.tagCounts, and the
          // heuristic's five-topics-per-entry swamps the intended distribution.
          detectedTopics: day.topics,
          images: [],
          isFavorite: Boolean(day.standout),
          createdAt,
          updatedAt: createdAt,
        },
      ],
      { timestamps: false }
    );

    const journalId = journal._id.toString();
    stats.entries += 1;

    // Marker lives outside the Mongoose schema, so the app never reads or renders
    // it — unlike a tag, which would show in the edit screen and the Topic Snapshot.
    await db.collection("journals").updateOne({ _id: journal._id }, { $set: { seedTag: SEED_TAG } });

    await persistEntryScore({
      userId: userIdString,
      journalId,
      entryType: "guided",
      content,
      aiPrompt: ENTRY_AI_PROMPT,
      tags: day.tags,
      isFavorite: Boolean(day.standout),
      entryCreatedAt: createdAt,
    });

    if (!NO_AI) {
      // Fire-and-forget in production (journal.service.ts:1315). Awaited here so
      // the AI region scores, themes, embedding, user memory and pattern graph
      // are all in place before the insights rebuild reads them.
      const upgraded = await runEntryAiScore({
        userId: userIdString,
        journalId,
        content,
        aiPrompt: ENTRY_AI_PROMPT,
        tags: day.tags,
      }).catch(() => false);

      if (upgraded) stats.aiScores += 1;
      else stats.heuristicScores += 1;

      let analysis = await createGuidedReflectionSessionAnalysis({
        userId: userIdString,
        journalId,
        promptAnswers,
        aiSummary: reflection || undefined,
        threadMessages: thread.length ? thread : undefined,
      }).catch(() => null);

      // The cheap model sometimes misses the strict 8-centre schema and the
      // helper degrades to the deterministic fallback. Retry those on the
      // stronger model rather than shipping generic copy into a screenshot.
      if (analysis?.isFallback && STRONG_MODEL !== "off") {
        setModelEnv(STRONG_MODEL);
        const retried = await createGuidedReflectionSessionAnalysis({
          userId: userIdString,
          journalId,
          promptAnswers,
          aiSummary: reflection || undefined,
          threadMessages: thread.length ? thread : undefined,
        }).catch(() => null);
        setModelEnv(MODEL);

        if (retried && !retried.isFallback) {
          analysis = retried;
          stats.retried += 1;
        }
      }

      if (analysis) {
        if (analysis.isFallback) stats.fallbackSnapshots += 1;
        else stats.aiSnapshots += 1;

        await persistJournalSessionAnalysisSnapshot({
          userId: userIdString,
          journalId,
          analysis: tidyMajorInsight(analysis),
          source: "guided",
        });
      }
    } else {
      stats.heuristicScores += 1;
    }

    const flags = [
      day.lateNight ? "late-night" : null,
      day.standout ? "standout" : null,
      thread.length ? "deeper" : null,
    ].filter(Boolean);

    console.log(
      `  day ${String(day.day).padStart(2)}  ${day.date}  ${day.mood.padEnd(5)}  ` +
        `${day.tags.join("+").padEnd(24)}  ${content.length} chars` +
        (flags.length ? `  [${flags.join(", ")}]` : "")
    );
  }

  console.log("");
  console.log("Writing mood check-ins...");

  for (const day of DAYS) {
    const moodCreatedAt = toUtc(`${day.date}T${MOOD_CHECK_IN_LOCAL_TIME}`);
    const [checkIn] = await moodCheckInModel.create(
      [
        {
          userId,
          mood: day.mood,
          moodDateKey: day.date,
          moodDateKeyVersion: 1,
          createdAt: moodCreatedAt,
          updatedAt: moodCreatedAt,
        },
      ],
      { timestamps: false }
    );

    await db.collection("mood_checkins").updateOne({ _id: checkIn._id }, { $set: { seedTag: SEED_TAG } });
  }

  console.log(`  ${DAYS.length} check-ins written`);
  console.log("");

  // rebuildInsightsCache re-reads every journal and mood check-in from scratch,
  // which is the only correct way to build the cache for backdated data — the
  // incremental sync path assumes entries arrive in real time.
  console.log("Rebuilding insights cache...");
  await rebuildInsightsCache(userIdString);
  await markUserMindMapStale(userIdString);
  console.log("  done");

  await printSummary({ db, userId, stats });

  await mongoose.disconnect().catch(() => undefined);
  await client.close();
};

const printSummary = async ({ db, userId, stats }) => {
  const journals = await db
    .collection("journals")
    .find({ userId }, { projection: { createdAt: 1, type: 1, detectedTopics: 1, detectedMood: 1 } })
    .sort({ createdAt: 1 })
    .toArray();

  const dateKeys = [...new Set(journals.map(j => j.createdAt.toISOString().slice(0, 10)))].sort();

  // Longest run of consecutive UTC date keys — the same thing computeCurrentStreak
  // measures off insights.dailyJournalCounts.
  let longestStreak = 0;
  let run = 0;
  let previous = null;

  for (const key of dateKeys) {
    const expected = previous
      ? new Date(Date.parse(`${previous}T00:00:00Z`) + 86400000).toISOString().slice(0, 10)
      : null;
    run = previous && key === expected ? run + 1 : 1;
    longestStreak = Math.max(longestStreak, run);
    previous = key;
  }

  const moods = await db
    .collection("mood_checkins")
    .aggregate([{ $match: { userId } }, { $group: { _id: "$mood", n: { $sum: 1 } } }])
    .toArray();

  // insights.tagCounts is an encrypted path (insights.schema.ts:92), so the raw
  // driver hands back a jioenc envelope string, not the map.
  const insights = await db.collection("insights").findOne({ userId });
  let tagCountMap = {};

  try {
    const decrypted = decryptFieldValue(insights?.tagCounts, { path: "tagCounts" });
    tagCountMap = decrypted instanceof Map ? Object.fromEntries(decrypted) : decrypted || {};
  } catch {
    tagCountMap = {};
  }

  const tagCounts = Object.entries(tagCountMap);
  const topTags = tagCounts
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 5);
  const tagTotal = topTags.reduce((sum, [, count]) => sum + count, 0);

  const scores = await db.collection("mindmap_entry_scores").find({ userId }).toArray();
  const regionTotals = new Map();

  for (const score of scores) {
    for (const region of score.regionScores || []) {
      regionTotals.set(region.id, (regionTotals.get(region.id) || 0) + region.score);
    }
  }

  const regionRanking = [...regionTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id, total], index) => `${index + 1}. ${id} (${(total / Math.max(scores.length, 1)).toFixed(2)} avg)`);

  const aiScored = scores.filter(score => score.source === "ai").length;
  const snapshots = await db
    .collection("journals")
    .countDocuments({ userId, sessionAnalysisSnapshot: { $ne: null } });

  console.log("");
  console.log("=".repeat(64));
  console.log("SEED SUMMARY");
  console.log("=".repeat(64));
  console.log(`entries            ${journals.length} (all type=guided: ${journals.every(j => j.type === "guided")})`);
  console.log(`date range         ${dateKeys[0]} -> ${dateKeys[dateKeys.length - 1]} (UTC buckets)`);
  console.log(`distinct days      ${dateKeys.length}`);
  console.log(
    `longest streak     ${longestStreak}` +
      (longestStreak === DAYS.length ? "  ✓ no gaps" : `  ✗ EXPECTED ${DAYS.length}`)
  );
  console.log(`mood check-ins     ${moods.map(m => `${m._id} ${m.n}`).join(" · ")}`);
  console.log(`session snapshots  ${snapshots}/${journals.length} (AI ${stats.aiSnapshots}, fallback ${stats.fallbackSnapshots}, retried up ${stats.retried})`);
  console.log(`mind map scores    ${scores.length} rows, ${aiScored} AI-upgraded, ${scores.length - aiScored} heuristic`);
  console.log(`going-deeper       ${stats.threads} entries`);
  console.log("");
  console.log("Topic Snapshot (all-time tagCounts, top 5 — the weekly card slices the last window):");

  for (const [tag, count] of topTags) {
    console.log(`  ${String(Math.round((count / tagTotal) * 100)).padStart(3)}%  ${tag} (${count})`);
  }

  console.log("");
  console.log("Mind Map region ranking (mean score across entries):");
  for (const line of regionRanking.slice(0, 6)) console.log(`  ${line}`);

  console.log("");
  console.log("Patterns that should now be detectable:");
  console.log("  1. avoidance loop      11 mentions of one deferred task, days 2-25, resolved day 26");
  console.log("  2. sleep/mood          after-1am entries on days 8 and 19 (hour=1), each followed by a `bad` day");
  console.log("  3. validation arc      external markers days 1-12, internal ones days 18-30, hinge at 15-17");
  console.log("  4. topic distribution  see the percentages above");
  console.log("  5. brain region skew   see the ranking above");
  console.log("  6. standout            day 22 (Aug 13), favourited");
  console.log("");
  console.log(`Remove everything with: node scripts/teardown-demo-entries.mjs --email=${EMAIL} --all --apply`);
};

main().catch(error => {
  console.error(error);
  process.exit(1);
});
