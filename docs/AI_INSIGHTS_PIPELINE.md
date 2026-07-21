# AI Insights Pipeline

Journal.IO uses an asynchronous, structured AI pipeline for behavioral insight generation.

The primary journaling flow must remain available even when AI processing fails.

The onboarding first-entry demo is not part of this stored pipeline. `POST /onboarding/demo-analysis` returns deterministic keyword-aware demo copy through a public, non-persisting endpoint and does not create `entry_features`.

---

# 1) Pipeline Flow

1. User submits a journal entry.
2. Entry is stored in the journal collection.
3. Analysis job is triggered asynchronously.
4. OpenAI extracts structured behavioral features.
5. Output is validated and normalized.
6. Features are stored in `entry_features`.
7. Insights endpoints aggregate trends over time.
8. Weekly plans are generated from aggregated trends, not ad hoc single-entry output.

---

# 2) Extracted Feature Scope

Per-entry extraction includes:

- sentiment
- primary emotions
- themes
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
  - deterministic weekly scoring still computes metadata, confidence, and supporting heuristic signals
  - OpenAI then refines the user-facing weekly summary, pattern tags, action plan copy, and Journal.IO support guidance when the user has AI enabled and the backend is configured with `OPENAI_API_KEY`
  - if OpenAI is unavailable, the deterministic weekly copy remains the fallback
- the collecting and insufficient payloads both include quick-analysis availability so the frontend can direct the user toward single-entry reflections while the next weekly read is still building
- the cache key is scoped to `window start + window end + timezone + status`

Current implemented prompt and tag generation:

- `GET /prompts/writing` uses OpenAI to generate a fresh personalized prompt list from recent writing patterns and recent journal excerpts when AI is enabled
- `POST /journal/suggest_tags` uses OpenAI to choose from Journal.IO's allowed tag set for the in-progress draft when AI is enabled
- `POST /journal/quick_analysis` returns a short structured reflection for one saved entry; it is premium-gated, respects AI opt-out, uses OpenAI refinement when available, falls back to deterministic wording otherwise, and now returns a visual-first single-entry payload with summary, scorecard, tags, signals, and one grounded next step
- quick analysis now strips prompt carryover from the saved entry before reading it and, when the remaining text is too unclear, returns a low-signal reflection that asks for cleaner user-written detail instead of forcing a stronger interpretation
- quick analysis and weekly AI analysis now run a deterministic safety-signal check before normal interpretation; entries may still be saved, but self-harm or harm-to-others wording receives support-first copy and is excluded from normal trait/pattern scoring
- `POST /guided-reflection/session-analysis` is the onboarding post-save exception to the normal stored analysis pipeline: it does not persist per-entry center scores yet, but every response now includes `brainSessionMap` with one dominant center, 1-3 secondary centers, all 8 center scores, concise nuanced details, and evidence snippets constrained to the user's own writing
- session-analysis `brainSessionMap` falls back deterministically when OpenAI is unavailable, disabled, or malformed; clear fallback sessions can still use local center scoring, while low-signal/no-reliable-map sessions use the Self-Reflection & Identity dominant baseline
- `POST /guided-reflection/goal-suggestions` returns only 1-4 local starter goals supported by the user's writing; prompts and deterministic fallbacks require specific, low-effort actions with a trigger, time limit, quantity, or first step rather than padded or vague reflection advice. Titles are capped at 30 characters and descriptions at 96 characters for the compact onboarding card.
- prompt, tag, quick-analysis, weekly-analysis, and onboarding session-analysis routes fall back deterministically when the user has opted out of AI or the backend is not configured for OpenAI
- weekly AI analysis uses release behavior by default; the old early-ready development preview flag is ignored, and early ready reports now require the explicit `AI_INSIGHTS_EXPERIMENTAL_EARLY_READY=true` flag in non-production only

Current implemented Mind Map cache:

- `GET /insights/mind-map` reads from the same per-user `insights` document as overview and weekly AI analysis
- the personal-data route is premium-only and respects AI opt-out. The iOS Mind Map tab itself is available to everyone, but Free and AI-off users receive a local educational model without calling this endpoint or calculating personal results
- the route requires `range=latest_week|all_time`
- `latest_week` uses the latest closed premium-week window in the user's local timezone
- `all_time` aggregates the user's full journal history, including pre-premium entries
- the route reuses the same 8-region reflection taxonomy already used by onboarding session analysis, but converts it into a stable always-8-region payload with score, confidence, rank, intensity, evidence snippets, and short insight copy
- Mind Map scoring is deterministic and does not make a new OpenAI call
- before scoring, the backend strips prompt carryover from saved journals, excludes obvious filler/gibberish from clear-writing thresholds, and down-weights low-signal entries so weak text does not masquerade as a strong region signal
- `latest_week` returns:
  - `building` while the user is still inside the first premium week or when the latest closed week does not meet the minimum active-day / clear-writing thresholds
  - `support_first` when the latest closed premium week contains safety-sensitive writing
  - `ready` when the latest closed premium week meets the thresholds and is safe to rank
- `all_time` excludes safety-sensitive entries from normal scoring and returns:
  - `building` when the safe writing history still lacks at least 4 active days or enough clear writing
  - `support_first` only when safety-sensitive history leaves no safe writing to map
  - `ready` when the safe writing history is sufficient to rank all 8 regions
- latest-week and all-time caches are stored separately, with cache keys scoped to timezone, scorer version, and response status; latest-week also includes the closed premium-week window
- journal create, edit, delete, and favorite-toggle writes mark both Mind Map caches stale without blocking the primary journal flow
- AI opt-out clears both Mind Map caches immediately, and privacy exports include the stored Mind Map cache payloads when present

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
- analysis status is persisted
- retries are possible
- user-facing messaging stays calm and non-technical

---

# 8) MVP Boundaries

Not required for this pipeline in MVP:

- vector database
- RAG
- complex intervention knowledge retrieval layers
