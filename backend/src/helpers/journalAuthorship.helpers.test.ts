import assert from "node:assert/strict";
import test from "node:test";
import { extractJournalAuthorship } from "./journalAuthorship.helpers";

const JADE_REFLECTION =
  "Protecting your morning seems tied to the focused hour you keep reaching for.";
const JADE_QUESTION = "What tends to get in the way of that first hour?";
const JADE_TURN = "Going quiet there sounds like it buys you a little distance.";

/** The exact shape composeFirstReflectionEntry produces. */
const GUIDED_BLOB = [
  "One good or exciting thing from today:\nI finished the deck before lunch.",
  "One hurdle or stressful moment:\nMy manager messaged me and I went quiet.",
  "What I want to carry into tomorrow:\nI want to answer instead of going silent.",
  `Journal.IO reflection:\n${JADE_REFLECTION}`,
  [
    "Going deeper:",
    `Question:\n${JADE_QUESTION}\nMy response:\nI keep pushing it to the afternoon.`,
    `Journal.IO:\n${JADE_TURN}`,
    "I added:\nIt only happens on deadline weeks.",
  ].join("\n\n"),
].join("\n\n");

const GUIDED_MANIFEST = [
  "One good or exciting thing from today:",
  "One hurdle or stressful moment:",
  "What I want to carry into tomorrow:",
  "Journal.IO reflection:",
  "Going deeper:",
  "Question:",
  "My response:",
  "Journal.IO:",
  "I added:",
  JADE_REFLECTION,
  JADE_QUESTION,
  JADE_TURN,
];

test("the manifest strips every app-authored sentence from a guided entry", () => {
  const { userText, appText } = extractJournalAuthorship({
    content: GUIDED_BLOB,
    type: "guided",
    aiPrompt: "Onboarding first guided reflection",
    appAuthoredSegments: GUIDED_MANIFEST,
  });

  // What the person actually typed survives.
  assert.match(userText, /finished the deck before lunch/);
  assert.match(userText, /manager messaged me and I went quiet/);
  assert.match(userText, /pushing it to the afternoon/);
  assert.match(userText, /only happens on deadline weeks/);

  // Nothing Journal.IO wrote does.
  assert.doesNotMatch(userText, /Protecting your morning/);
  assert.doesNotMatch(userText, /tends to get in the way/);
  assert.doesNotMatch(userText, /buys you a little distance/);
  assert.doesNotMatch(userText, /Journal\.IO/);
  assert.doesNotMatch(userText, /Going deeper/);
  assert.doesNotMatch(userText, /My response/);

  // The app's words are kept, so they can still be passed as context.
  assert.match(appText, /Protecting your morning/);
});

test("a legacy guided entry with no manifest still parses by label", () => {
  const { userText } = extractJournalAuthorship({
    content: GUIDED_BLOB,
    type: "guided",
    aiPrompt: "Onboarding first guided reflection",
  });

  assert.match(userText, /finished the deck before lunch/);
  assert.match(userText, /only happens on deadline weeks/);

  // The reason this fix exists: aiPrompt is a label that never appears in the
  // content, so the existing prompt-echo strip is a no-op here.
  assert.doesNotMatch(userText, /Protecting your morning/);
  assert.doesNotMatch(userText, /tends to get in the way/);
  assert.doesNotMatch(userText, /buys you a little distance/);
});

test("a label inside a user's own sentence is not treated as a header", () => {
  const content = [
    "One hurdle or stressful moment:",
    "I asked for my response: nothing came back.",
    "Going deeper: I think I already know why.",
  ].join("\n");

  const { userText } = extractJournalAuthorship({ content, type: "guided" });

  // Both lines are the person's. Losing real writing is worse than carrying a
  // stray label through, so the parser only matches a label alone on its line.
  assert.match(userText, /I asked for my response: nothing came back/);
  assert.match(userText, /I think I already know why/);
});

test("text before any recognised label is kept as the user's", () => {
  const { userText } = extractJournalAuthorship({
    content: "Just a plain guided entry with no labels at all.",
    type: "guided",
  });

  assert.equal(userText, "Just a plain guided entry with no labels at all.");
});

test("every inserted writing prompt is stripped, not just the last", () => {
  const content = [
    "What felt heaviest today?",
    "traffic was awful and I got home late",
    "",
    "What are you avoiding?",
    "calling my sister back",
  ].join("\n");

  const { userText } = extractJournalAuthorship({
    content,
    type: "open_ended",
    // aiPrompt only ever holds the LAST prompt tapped — the whole reason the
    // manifest exists.
    aiPrompt: "What are you avoiding?",
    appAuthoredSegments: ["What felt heaviest today?", "What are you avoiding?"],
  });

  assert.doesNotMatch(userText, /What felt heaviest today/);
  assert.doesNotMatch(userText, /What are you avoiding/);
  assert.match(userText, /traffic was awful/);
  assert.match(userText, /calling my sister back/);
});

test("a legacy open-ended entry defers to the existing prompt-echo strip", () => {
  const { userText, appText } = extractJournalAuthorship({
    content: "What are you avoiding? calling my sister back",
    type: "open_ended",
    aiPrompt: "What are you avoiding?",
  });

  assert.doesNotMatch(userText, /What are you avoiding/);
  assert.match(userText, /calling my sister back/);
  assert.equal(appText, "What are you avoiding?");
});

test("userWordCount counts only the person's words", () => {
  const thin = extractJournalAuthorship({
    content: [
      "One good or exciting thing from today:\ngood day",
      "One hurdle or stressful moment:\ntraffic",
      `Journal.IO reflection:\n${JADE_REFLECTION}`,
    ].join("\n\n"),
    type: "guided",
    appAuthoredSegments: [
      "One good or exciting thing from today:",
      "One hurdle or stressful moment:",
      "Journal.IO reflection:",
      JADE_REFLECTION,
    ],
  });

  // Three words, not the twelve Journal.IO added. This is what lets the
  // low-signal gate see a thin session as thin.
  assert.equal(thin.userWordCount, 3);
});

test("an entry that strips to nothing falls back rather than reading as empty", () => {
  // Pathological manifest: it claims to have written the entire entry. A parser
  // fault must not present as "this person wrote nothing".
  const { userText, userWordCount } = extractJournalAuthorship({
    content: "the whole entry",
    type: "open_ended",
    appAuthoredSegments: ["the whole entry"],
  });

  assert.equal(userText, "the whole entry");
  assert.equal(userWordCount, 3);
});

test("an empty entry stays empty", () => {
  const result = extractJournalAuthorship({ content: "   ", type: "guided" });

  assert.deepEqual(result, { userText: "", appText: "", userWordCount: 0 });
});
