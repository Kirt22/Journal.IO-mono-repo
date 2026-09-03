import { analyzeJournalTextQuality } from "./journalTextQuality.helpers";

/**
 * The authorship boundary for a saved journal entry.
 *
 * Journal.IO writes its own words *into* the entry: a guided session is stored
 * as one prose blob containing the app's section labels, its reflection, and
 * every follow-up question it asked, interleaved with what the person actually
 * typed. An open-ended entry can contain any writing prompts the user tapped to
 * insert.
 *
 * Reading that back as if the person wrote all of it is how an app-authored
 * sentence ends up quoted as the user's own evidence, how a question the app
 * asked becomes "a topic they raised", and — because the same text feeds theme
 * extraction — how the app's own words become a pattern-graph node with an
 * occurrence count. Ask Jade already refuses to mine its own turns for exactly
 * this reason (`askJadeMining.service.ts`: mining assistant text "would let the
 * graph confirm its own conclusions"); this module is the journal equivalent.
 *
 * Pure functions only, so both the services and their tests can use it without
 * touching Mongo or OpenAI.
 */

/**
 * The literal section labels the guided composer writes into `content`
 * (`composeFirstReflectionEntry` in `FirstGuidedReflectionScreen.tsx`).
 *
 * Only used for entries saved before `appAuthoredSegments` existed. New entries
 * carry their own manifest, so a change to the composer's wording cannot
 * silently break them.
 */
export const GUIDED_ENTRY_LABELS = {
  /** Section headers whose body is the user's own answer. */
  userSections: [
    "One good or exciting thing from today:",
    "One hurdle or stressful moment:",
    "What I want to carry into tomorrow:",
    "My response:",
    "I added:",
  ],
  /** Section headers whose body was written by the app. */
  appSections: ["Journal.IO reflection:", "Question:", "Journal.IO:"],
  /** A structural header with no body of its own. */
  structural: ["Going deeper:"],
} as const;

export type JournalAuthorship = {
  /** Only what the person typed. The corpus for evidence, themes and triggers. */
  userText: string;
  /**
   * What the app contributed. Kept rather than discarded so it can be handed to
   * a model as clearly-labelled *context* — the questions someone was answering
   * are worth knowing, they are just not that person's words.
   */
  appText: string;
  /** Words in `userText`. Drives "is there enough here to say anything". */
  userWordCount: number;
};

const normalizeWhitespace = (value: string) =>
  value.replace(/\s+/g, " ").trim();

const countWords = (value: string) =>
  value.split(/\s+/).filter(Boolean).length;

const escapeRegex = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Remove each string the app recorded itself as having inserted.
 *
 * Exact literal removal, longest first so a segment that contains another
 * cannot leave a fragment behind. This is the preferred path: it needs no
 * knowledge of the entry's shape and stays correct if the composer changes.
 */
const stripManifestSegments = (
  content: string,
  segments: string[]
): { userText: string; appText: string } => {
  const usable = segments
    .map((segment) => segment.trim())
    .filter(Boolean)
    .sort((left, right) => right.length - left.length);

  if (!usable.length) {
    return { userText: content, appText: "" };
  }

  let remaining = content;
  const removed: string[] = [];

  for (const segment of usable) {
    const pattern = new RegExp(escapeRegex(segment), "gi");
    if (pattern.test(remaining)) {
      remaining = remaining.replace(pattern, "\n");
      removed.push(segment);
    }
  }

  return {
    userText: normalizeWhitespace(remaining),
    appText: normalizeWhitespace(removed.join(" ")),
  };
};

/**
 * Split a legacy guided blob by its section labels.
 *
 * Labels are matched only at the start of a line, so a user sentence that
 * happens to contain one ("my response: nothing") is never mistaken for a
 * header. Where a line is ambiguous the parser keeps it: losing something the
 * person actually wrote is worse than carrying one stray label through, and the
 * manifest path is what makes new entries exact rather than merely careful.
 */
const parseGuidedSections = (
  content: string
): { userText: string; appText: string } => {
  const userLabels = new Set<string>(GUIDED_ENTRY_LABELS.userSections);
  const appLabels = new Set<string>(GUIDED_ENTRY_LABELS.appSections);
  const structural = new Set<string>(GUIDED_ENTRY_LABELS.structural);

  const userLines: string[] = [];
  const appLines: string[] = [];
  // Anything before the first recognised label belongs to the person: a blob
  // that does not parse must not silently become "no user text".
  let current: "user" | "app" = "user";

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line) {
      continue;
    }

    if (structural.has(line)) {
      continue;
    }

    if (userLabels.has(line)) {
      current = "user";
      continue;
    }

    if (appLabels.has(line)) {
      current = "app";
      appLines.push(line.replace(/:$/, ""));
      continue;
    }

    (current === "user" ? userLines : appLines).push(line);
  }

  return {
    userText: normalizeWhitespace(userLines.join(" ")),
    appText: normalizeWhitespace(appLines.join(" ")),
  };
};

/**
 * Separate a journal entry into what the person wrote and what the app added.
 *
 * Strategy order matters:
 *   1. `appAuthoredSegments` — the app's own record of what it inserted. Exact.
 *   2. guided structural parse — for entries saved before the manifest existed.
 *   3. `analyzeJournalTextQuality` prompt-echo strip — the existing open-ended
 *      path, reused rather than reimplemented. Note it only knows the single
 *      prompt in `aiPrompt`, which is why the manifest exists.
 *
 * Falls back to treating everything as user text rather than returning nothing:
 * an entry that yields no user text at all would read as "they wrote nothing",
 * which is a worse failure than a little app text slipping through.
 */
export const extractJournalAuthorship = ({
  content,
  type,
  aiPrompt,
  appAuthoredSegments,
}: {
  content: string;
  type?: string | null | undefined;
  aiPrompt?: string | null | undefined;
  appAuthoredSegments?: string[] | null | undefined;
}): JournalAuthorship => {
  const source = (content || "").trim();

  if (!source) {
    return { userText: "", appText: "", userWordCount: 0 };
  }

  const segments = Array.isArray(appAuthoredSegments)
    ? appAuthoredSegments
    : [];

  let userText = "";
  let appText = "";

  if (segments.length) {
    const stripped = stripManifestSegments(source, segments);
    userText = stripped.userText;
    appText = stripped.appText;
  } else if (type === "guided") {
    const parsed = parseGuidedSections(source);
    userText = parsed.userText;
    appText = parsed.appText;
  } else {
    const quality = analyzeJournalTextQuality({
      content: source,
      aiPrompt: aiPrompt ?? null,
    });
    userText = quality.strippedText.trim();
    appText = quality.promptEchoDetected ? (aiPrompt || "").trim() : "";
  }

  if (!userText) {
    // Every strategy emptied the entry. That is far more likely to be a parser
    // fault than a genuinely empty entry, so hand back the original and let the
    // low-signal gates judge it on its merits.
    return {
      userText: normalizeWhitespace(source),
      appText,
      userWordCount: countWords(normalizeWhitespace(source)),
    };
  }

  return { userText, appText, userWordCount: countWords(userText) };
};
