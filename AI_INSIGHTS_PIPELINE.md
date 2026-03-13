# AI Insights Pipeline

journal.io uses a simple AI architecture for MVP.

The system analyzes journal entries using OpenAI.

No vector database or RAG is required initially.

---

# Journal Analysis Flow

User writes journal
↓
POST /journals
↓
Journal stored in database
↓
AI analysis job triggered
↓
OpenAI API extracts structured insights
↓
Insights stored in entry_features collection

---

# AI Features Extracted

For each journal entry the AI extracts:

sentiment
primary emotions
themes
stress level
behavior markers
social context

---

# Example Feature Object

{
entry_id: ObjectId,
sentiment: "negative",
emotions: ["anxiety","frustration"],
themes: ["work"],
stress_level: 7,
behavior_markers: ["rumination"]
}

---

# Insights Aggregation

Insights APIs aggregate patterns over time.

Example metrics

average mood
stress trends
top emotions
most frequent themes

These metrics power the insights dashboard.

---

# Weekly Action Plan

The system generates weekly improvement steps using OpenAI.

Input

recent behavioral trends

Output

3–5 actionable suggestions

Example

take short breaks during work stress
walk outside for 10 minutes
schedule focused work sessions

---

# Future AI Architecture

Future versions may include:

vector database
coping strategy corpus
retrieval augmented generation

These are not required for MVP.
