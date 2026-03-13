# AI_ARCHITECTURE.md

## Backend and AI Architecture

journal.io backend is built using:

* Node.js
* Express
* MongoDB
* OpenAI API

The system follows a modular service-based architecture.

---

# Backend Folder Structure

backend/src

config
helpers
middleware
routes
schema
types

services

auth
user
journal
prompts
insights
plans
safety
reminders
streaks
privacy
admin

Each service module contains:

* feature.routes.ts
* feature.controllers.ts
* feature.validators.ts

---

# Request Flow

Client Request
↓
Route Handler
↓
Controller
↓
Service Logic
↓
Database
↓
Response

---

# AI Processing Overview

AI analysis runs after a journal entry is saved.

Workflow:

User submits journal
↓
Entry saved to database
↓
AI analysis job triggered
↓
OpenAI analyzes journal text
↓
Structured behavioral features extracted
↓
Features stored in database
↓
Insights API aggregates trends

---

# AI Model Usage (MVP)

The system uses OpenAI to extract:

* sentiment
* emotions
* themes
* stress indicators
* behavior markers

---

# AI Output Format

Example structured output:

{
sentiment: "negative",
emotions: ["anxiety","frustration"],
themes: ["work"],
stress_level: 7,
behavior_markers: ["rumination"]
}

---

# Insights Aggregation

Insights APIs compute:

* average mood
* stress trend
* most common emotions
* recurring themes

---

# Weekly Plan Generation

Weekly plans are generated using OpenAI based on recent patterns.

Example plan:

* take short breaks during work
* schedule focused work sessions
* walk outside daily

---

# Future Architecture

Future improvements may include:

* vector databases
* retrieval augmented generation
* intervention knowledge base

These are **not required for the MVP.**
