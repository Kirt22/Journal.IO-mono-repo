# AI Insights Pipeline

Journal.IO uses an asynchronous, structured AI pipeline for behavioral insight generation.

The primary journaling flow must remain available even when AI processing fails.

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
- both routes fall back to deterministic prompt/tag generation when the user has opted out of AI or the backend is not configured for OpenAI

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

Allowed phrases:

- "journal entries suggest"
- "appears associated with"
- "a recurring pattern may be"

Disallowed:

- diagnosis language
- medical certainty
- psychiatric labeling

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
