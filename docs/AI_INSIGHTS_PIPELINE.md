# AI Insights Pipeline

Journal.IO uses an asynchronous, structured AI pipeline for behavioral insight generation.

The primary journaling flow must remain available even when AI processing fails.

The onboarding first-entry demo is not part of this stored pipeline. `POST /onboarding/demo-analysis` returns deterministic keyword-aware demo copy through a public, non-persisting endpoint and does not create `entry_features`.

---

# 1) Pipeline Flow

1. User submits a journal entry.
2. Entry is stored in the journal collection.
3. Analysis job is triggered asynchronously.
4. OpenAI extracts structured behavioral features (8-region scores plus a therapist-style key insight: context summary + recurring themes with evidence).
5. Output is validated and normalized.
6. Region scores are stored in `mindmap_entry_scores`; the key insight (summary + themes) is stored in `entry_insights`. (The generic `entry_features` naming in this doc is realised as these two collections.)
7. Insights endpoints aggregate trends and recurring patterns over time.
8. Weekly plans are generated from aggregated trends, not ad hoc single-entry output.

---

# 2) Extracted Feature Scope

Per-entry extraction includes:

- sentiment
- primary emotions
- normalized detected topics from the closed emotional/action/context taxonomy
- one detected mood: `amazing`, `good`, `okay`, `bad`, or `terrible`
- stress level
- behavior markers
- social context

Optional derived fields can be added when validators and schemas are updated together.

---

# 3) Structured Feature Shape (Example)

```json
{
  "entryId": "ObjectId",
  "sentiment": "negative",
  "emotions": ["anxiety", "frustration"],
  "themes": ["work"],
  "stressLevel": 7,
  "behaviorMarkers": ["rumination"],
  "socialContext": ["team conflict"]
}
```

---

# 4) Aggregation Outputs

Insights endpoints should compute:

- mood trend
- stress trend
- dominant emotions
- recurring themes
- frequency-based behavior markers

These support home insight cards, insights dashboards, and weekly planning flows.

Current implemented non-AI overview aggregation:

- `GET /insights/overview` is backed by a cached per-user `insights` document
- the cache stores aggregate counters and maps derived from journal entries and mood check-ins
- the cache is updated from journal create/edit/delete/favorite writes and mood logging writes
- if the cache is absent, it is rebuilt from MongoDB source collections
- this overview cache is separate from the future AI-derived feature aggregation pipeline

Current implemented weekly AI-analysis cache:

- `GET /insights/ai-analysis` reads from the same per-user `insights` document
- weekly windows are anchored to `premiumActivatedAt` in the requesting user’s local timezone
- the route accepts `X-Client-Timezone` so window boundaries and labels can match the user’s local week
- the route now exposes three states:
  - `collecting` while the current premium week is still open
  - `insufficient` when the most recent closed premium week ended with fewer than 4 active journal days
  - `ready` when the most recent closed premium week ended with at least 4 active journal days
- a weekly AI report is only generated from a closed 7-day premium window with at least 4 active journal days
- journal and mood writes mark the weekly AI-analysis cache as stale without blocking the primary save flow
- when the AI-analysis route is requested and the cache is stale or missing for the relevant premium-week window, the backend recomputes:
  - weekly summary metadata
  - pattern tags
  - scoreboard cards
  - emotion-trend data
  - theme breakdown
  - human-readable signals: what helped, what drained, what kept showing up
  - actionable steps
  - Journal.IO support guidance
- recomputation uses only the journals and mood check-ins that fall inside that premium-week window, then writes the structured result back to the `insights` document
- before weekly copy is synthesized, the backend strips saved prompt text from each journal and down-weights low-signal entries such as prompt carryover, very short filler, or obvious gibberish so those entries lower confidence instead of masquerading as grounded themes
- the current implementation is hybrid and cache-backed:
  - deterministic weekly scoring still computes metadata, confidence, and supporting heuristic signals, plus a deterministic behavioural-`patterns` fallback from the week's recurring topics
  - OpenAI then refines the user-facing weekly summary, pattern tags, action plan copy, Journal.IO support guidance, and the behavioural `patterns` for eligible Premium users when the backend is configured with `OPENAI_API_KEY`
  - **behavioural patterns replace the earlier Big Five / dark-triad framing.** Each pattern names a behaviour and the trigger/feeling it connects to, with the user's own evidence and one gentle, non-judgmental nudge. To generate them, the enhancement now feeds the model the window's persisted `entry_insights` themes, recurrence-ranked patterns (`aggregateRecurringPatterns`), the rolling long-term memory (`buildUserReflectionMemory`), the mood-by-day trend, and per-entry hour/weekday — so it reasons about real behaviour↔trigger links and the user's longer arc instead of counting keywords. Safety-sensitive weeks return empty patterns.
  - if OpenAI is unavailable, the deterministic weekly copy remains the fallback
  - the weekly cache key includes a payload version (`WEEKLY_AI_ANALYSIS_VERSION`); bump it when the payload shape changes so stale caches recompute
- the collecting and insufficient payloads both include quick-analysis availability so the frontend can direct the user toward single-entry reflections while the next weekly read is still building
- the cache key is scoped to `window start + window end + timezone + status`

Current implemented prompt and tag generation:

- every OpenAI-backed interpretation/extraction path shares an evidence-led challenge balance: when both difficult and positive material exist, roughly 55% of attention goes to supported friction and unresolved difficulty and 45% to supported strengths/resources. The ratio never permits invented negative material, and all user-facing output remains warm, constructive, non-clinical, and uncertainty-aware.
- `GET /prompts/writing` uses OpenAI to generate a fresh personalized prompt list from recent writing patterns and recent journal excerpts when the user is eligible and OpenAI is configured
- `POST /journal/suggest_tags` uses OpenAI to choose from Journal.IO's allowed tag set for the in-progress draft when the user is eligible and OpenAI is configured
- journal create/edit writes an immediate deterministic `detectedTopics`/`detectedMood` baseline without blocking the save; guided and open-ended session analysis may replace it with validated structured output
- `detectedTopics` remains separate from user-authored `tags`; reserved `onboarding:` metadata is rejected from new journal writes and excluded from journal responses, weekly tag normalization, and cached popular-topic presentation without requiring a historical journal migration
- `POST /journal/session_analysis` is an idempotent get-or-create read for the shared Premium saved-entry analysis. It replays the embedded versioned snapshot when present, generates and atomically stores one for eligible legacy entries on first open, persists normalized detected metadata without overwriting user-authored tags, and excludes Quick Notes
- `POST /journal/quick_analysis` returns a short structured reflection for one saved entry; it is premium-gated, uses OpenAI refinement when available, falls back to deterministic wording otherwise, and now returns a visual-first single-entry payload with summary, scorecard, tags, signals, one grounded next step, and an optional `connection` line. The `connection` is drawn from the user's long-term memory (`buildUserReflectionMemory`, best-effort) so a single-entry card can name when today genuinely echoes a specific past thread; it is `null` when there is no real connection or memory is unavailable
- quick analysis now strips prompt carryover from the saved entry before reading it and, when the remaining text is too unclear, returns a low-signal reflection that asks for cleaner user-written detail instead of forcing a stronger interpretation
- quick analysis and weekly AI analysis now run a deterministic safety-signal check before normal interpretation; entries may still be saved, but self-harm or harm-to-others wording receives support-first copy and is excluded from normal trait/pattern scoring
- `POST /guided-reflection/session-analysis` is the guided post-save exception to the normal stored analysis pipeline: every response includes normalized topics, one five-value mood, and `brainSessionMap`; supplying the saved `journalId` persists the full response as the journal's immutable session snapshot, while center scores continue through the per-entry Mind Map scorer
- session-analysis `brainSessionMap` falls back deterministically when OpenAI is unavailable, disabled, or malformed; clear fallback sessions can still use local center scoring, while low-signal/no-reliable-map sessions use the Self-Reflection & Identity dominant baseline
- `POST /guided-reflection/goal-suggestions` returns 0-4 local starter goals supported by the user's writing; prompts and deterministic fallbacks require specific, low-effort actions or a plausible contextual experiment rather than padded or vague reflection advice. Active and archived goals both participate in deterministic intent deduplication, eligible AI paths add one transient batch semantic comparison (`>= 0.84` cosine similarity), and an empty result is valid when no new action remains. Titles are capped at 30 characters and descriptions at 96 characters for the compact onboarding card.
- prompt, tag, quick-analysis, weekly-analysis, and onboarding session-analysis routes fall back deterministically when the backend is not configured for OpenAI
- weekly AI analysis uses release behavior by default; the old early-ready development preview flag is ignored, and early ready reports now require the explicit `AI_INSIGHTS_EXPERIMENTAL_EARLY_READY=true` flag in non-production only

Current implemented Mind Map cache:

- `GET /insights/mind-map` reads from the same per-user `insights` document as overview and weekly AI analysis
- the personal-data route is Premium-only. The iOS Mind Map tab itself is available to everyone, but Free users receive a local educational model without calling this endpoint or calculating personal results
- the route requires `range=latest_week|monthly|all_time` (the controller maps each faithfully; the mobile Mind Map screen defaults to `monthly`)
- `latest_week` uses the latest closed premium-week window in the user's local timezone
- `all_time` aggregates the user's full journal history, including pre-premium entries
- the route reuses the same 8-region reflection taxonomy already used by onboarding session analysis, but converts it into a stable always-8-region payload with score, confidence, rank, intensity, evidence snippets, and short insight copy
- per-entry scoring: every journal entry (open-ended and guided) is scored across the 8 regions and **persisted** in the `mindmap_entry_scores` collection. A deterministic heuristic row is written synchronously at save time (so the per-entry Mind Map, `GET /mind-map/entry/:journalId`, is instantly available), then a background pass upgrades it with an OpenAI Responses call gated by `canUseOpenAiForUser` (returns `null` → keep heuristic). Entry save never blocks or fails on scoring.
- per-entry **key insight** persistence: the same save-time + background AI pass also writes one row per journal to the `entry_insights` collection — a short context summary, an emotional tone, the dominant region, up to 4 evidence-backed behavioral/emotional themes, and an embedding of the distilled memory text. The extraction applies the same challenge-aware balance without inventing problems; each theme keeps a rationale, the user's own evidence quote, and a confidence. The heuristic pass derives themes from the strongest evidenced regions; the AI pass replaces them with genuinely observed themes and computes the embedding (`requestEmbedding`, `OPENAI_EMBEDDING_MODEL`). This powers guided long-term memory and the Mind Map's recurring patterns.
- **long-term memory** (premium): the AI insight pass also fire-and-forget refreshes a rolling `user_memories` document (`updateUserMemory`) — an AI-maintained whole-history narrative of ongoing situations, key relationships, and sensitive topics. At guided-reflection time, `buildUserReflectionMemory(userId, { queryEmbedding })` composes three layers into a token-bounded block injected into every prompt: (1) the rolling narrative, (2) semantic recall of the most relevant past entries (cosine over stored embeddings via `loadRelevantEntryInsights`), and (3) recurrence-ranked themes. All layers are best-effort and never block a save or a session.
- the global `/insights/mind-map` route aggregates these persisted per-entry scores across the window's clear entries (favorites weighted ×1.12), falling back to per-entry keyword scoring for legacy entries with no stored row. It also aggregates persisted `entry_insights` themes into the ordered `patterns` array (recurrence-ranked, keeping the highest-confidence rationale + evidence quote per theme). The route itself makes no new OpenAI call.
- ranges are `latest_week`, `monthly` (rolling last 30 days), and `all_time`; each has its own cache fields + cache key on the `insights` document.
- each region carries a neutral emphasis `trend` (`rising`/`steady`/`easing`) + `trendLabel`, comparing the recent half of clear scored entries to the earlier half; the ready payload adds a supportive, non-clinical `focus` prompt. Trends never imply improvement or decline.
- **tier scoring** (v4): each region also carries a `tier` band (`low`/`balanced`/`high`/`very_high`) + `tierLabel`, and the ready payload adds a top-level `overallTier` (`{ tier, label, blurb }`). Tiers band the region's **pre-normalization weighted mean** against a fixed per-region baseline table (`REFLECTION_REGION_BASELINE` in `reflectionMap.helpers.ts`) — a deterministic "how you compare to a typical reflector" read that is band-only (never a number, percentile, or clinical judgement) and survives AI failure. `getReflectionRegionTier` / `getOverallReflectionTier` own the logic; per-entry maps compute the same tiers off the single entry's region scores. Baseline thresholds are tunable calibration constants.
- **per-region development series**: `GET /insights/mind-map/region/:regionId/series?range=…` (`buildRegionTimeSeries` in `mindmap.service.ts`) returns the region's averaged per-entry score bucketed by day (recent windows) or week (all-time), read directly from `mindmap_entry_scores` with no OpenAI call. It powers the small development graph in the region detail modal and is fetched lazily when a region is opened.
- `MIND_MAP_SCORER_VERSION` (in `mindmap.service.ts`) is embedded in cache keys and stored on each per-entry row; bump it to invalidate all caches + treat stored rows as stale (bumped to `4` for tier bands)
- before scoring, the backend strips prompt carryover from saved journals, excludes obvious filler/gibberish from clear-writing thresholds, and down-weights low-signal entries so weak text does not masquerade as a strong region signal
- `latest_week` returns:
  - `building` while the user is still inside the first premium week or when the latest closed week does not meet the minimum active-day / clear-writing thresholds
  - `support_first` when the latest closed premium week contains safety-sensitive writing
  - `ready` when the latest closed premium week meets the thresholds and is safe to rank
- `all_time` (the range the Mind Map screen uses) excludes safety-sensitive entries from normal scoring and returns:
  - `building` when there are fewer than `MIND_MAP_MIN_ENTRIES` (5) clear entries — **entry-count based and day-independent** (writing 5 clear entries across any number of days unlocks it); its building `progress.entriesNeeded` is entry-based. `monthly`/`latest_week` keep the day-based gate.
  - `support_first` only when safety-sensitive history leaves no safe writing to map
  - `ready` when the safe writing history is sufficient to rank all 8 regions
- latest-week and all-time caches are stored separately, with cache keys scoped to timezone, scorer version, and response status; latest-week also includes the closed premium-week window
- **dev bypass:** set `AI_ALLOW_NON_PREMIUM=true` **or** the dedicated non-production `MINDMAP_DEV_BYPASS_MIN_ACTIVE_DAYS=true` (the latter lets a real premium account bypass without enabling the non-premium AI path). While a bypass is active: the readiness thresholds relax (`4/2/40` → `1/1/10`); `getClearMindMapJournals` accepts any safe, non-empty entry (so short / low-signal dev writing still counts); the map is **forced to `ready` as soon as there is ≥1 clear entry in the window** (`mindMapForceReady`, skipping the active-days / clear-entry / word minimums — needs ≥1 entry so the map isn't empty/NaN); and `getInsightsMindMap` skips the cached-response short-circuit so a previously cached `building` map recomputes immediately (recompute is DB/heuristic-only, no live AI). The entry must be in the **current month** for the `monthly` map the screen uses. Never set either flag in production.
- journal create, edit, delete, and favorite-toggle writes mark both Mind Map caches stale without blocking the primary journal flow; create/edit also re-score the per-entry row, and a completed background AI upgrade re-marks the global caches stale so the next read reflects the AI signal
- account deletion removes Mind Map caches, journal session-analysis snapshots, persisted per-entry scores, `entry_insights` rows (summaries + themes + evidence quotes + embeddings), the `user_memories` rolling-memory document, and the user's `pattern_nodes` / `pattern_edges`. Privacy exports include session snapshots, stored Mind Map cache payloads, the `mindMapEntryScores` array when present, and the full `patternGraph` (nodes + edges) — a user is entitled to see the patterns the app concluded about them and the connections it drew between them

---

# 4b) Pattern Graph

Aggregation above answers *what recurs*. The pattern graph answers *how two recurring things relate* for one specific person — the step from "you overeat, seen 9×" to "the screen-heavy evenings and the eating past fullness look like the same loop".

**Source.** A materialized projection of `entry_insights.themes` (and themes mined from Ask Jade sessions), written fire-and-forget from the same background pass that upgrades entry scores. `entry_insights` stays the source of truth, so the graph is fully replayable and is never a parallel write path.

**Nodes** (`pattern_nodes`) are behaviours with the reason they were noticed and the user's own sentence as evidence. Identity resolves in four stages, cheapest first: exact slug (`toThemeId`) → alias → phrasing-independent key (`toPatternKey`, token-sorted + lightly stemmed) → embedding near-duplicate at cosine ≥ 0.90. Stages 1-3 are free; only a genuinely new pattern costs an embedding, and only for premium users. A merged node is retained with `status: "merged"` rather than deleted, so a wrong merge stays reversible.

**Edges** (`pattern_edges`) come from three tiers:

| Tier | Source | Cost | What it establishes |
|---|---|---|---|
| 1 | `co_occurrence` | free | two patterns appeared in the same entry |
| 2 | `temporal` | free | one pattern tended to precede another, with lag samples |
| 3 | `ai_inferred` | one throttled call | the mechanism between a pair the deterministic tiers only counted |

Tier 3 (`OPENAI_PATTERN_GRAPH_MODEL`, low reasoning effort, `PATTERN_GRAPH_REFINE_EVERY` default 5) may only **relate and group patterns that already exist**. Before anything is written the response is validated: endpoints not in the exact key set are dropped, self-edges are dropped, unexplained edges are dropped, and any evidence quote not copied verbatim from a stored user sentence is discarded rather than attributed to them.

**God nodes** are umbrella clusters over member patterns. They are the riskiest surface in the graph, because the obvious name for a cluster is usually a condition. Three guards: umbrella labels must be multi-word behavioural phrases ("bracing for things going wrong"), `isClinicalPatternLabel` rejects diagnoses / abbreviations / Big Five and dark-triad trait nouns, and clusters need ≥2 established members plus confidence ≥ 0.6. Umbrellas are fully derived from the latest refinement, capped at 6 per user, and chat-mined patterns may never seed one.

**Reaching a prompt.** `buildPatternGraphMemoryBlock` clamps to 700 characters and *replaces* the recurring-themes block once a user has ≥3 patterns seen ≥2× — recurring themes are a graph with no edges, so the only net growth in the shared 2200-character memory budget is the connection lines. Below that threshold the existing `aggregateRecurringPatterns` path is unchanged. Edges under 0.55 confidence never reach a prompt, and a `precedes` edge needs 3 observations before it is described as a sequence.

**Drift control** is deterministic and testable: strength decays by recency (45-day half-life), single-sighting nodes go dormant at 90 days and are deleted at 180, single-observation edges are pruned at 60 days, and `ai_inferred` edges expire at 180 days without reconfirmation. Deleting a journal entry strips evidence citing it and flags the graph for replay, so the graph never quotes writing the user can no longer see.

---

# 5) Weekly Plan Generation

Weekly plans consume recent aggregated trend summaries and produce 3-5 action steps.

Output requirements:

- practical
- specific
- behavior-focused
- low cognitive load

---

# 6) Safety and Language Constraints

All AI-derived user-facing insight text must be:

- non-clinical
- uncertainty-aware
- supportive
- safety-first for elevated-risk content

Allowed phrases:

- "journal entries suggest"
- "appears associated with"
- "a recurring pattern may be"

Disallowed:

- diagnosis language
- medical certainty
- psychiatric labeling
- turning self-harm or harm-to-others wording into normal personality/trait conclusions

---

# 7) Failure Handling

If analysis fails:

- journal entry remains saved
- pattern-graph and long-term-memory updates are fire-and-forget and swallow their own errors, so neither a graph write nor a refinement failure can surface into the entry pipeline
- analysis status is persisted
- retries are possible
- user-facing messaging stays calm and non-technical

Ask Jade may present stored aggregates as rich reply blocks when the user explicitly requests a graph, trend, comparison, or statistics view. These blocks reuse the insights overview and timezone-aware mood-history services; the model cannot author numeric values. Emotion/theme visualization remains outside the MVP until those signals use a normalized aggregation model.

---

# 8) MVP Boundaries

Not required for this pipeline in MVP:

- vector database
- RAG
- complex intervention knowledge retrieval layers
