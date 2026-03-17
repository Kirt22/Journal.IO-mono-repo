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
