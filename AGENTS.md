# journal.io – AI Development Guide

This repository contains the **journal.io behavioral journaling platform**.

journal.io helps users:

• journal daily
• detect behavioral patterns
• track emotional trends
• receive practical weekly actions

The project is structured to support **AI-assisted development using agents like Codex**.

---

# Development Strategy

Development follows a **feature-by-feature vertical slice approach**.

Each feature must be completed fully before starting the next feature.

Feature completion includes:

1. backend APIs
2. database schemas
3. frontend screens
4. API integration
5. UI polish
6. testing

This ensures stable iterative progress.

---

# Important Context Files

AI agents must read these files before generating code.

AI_PRODUCT.md
Defines product goals and functionality.

AI_ARCHITECTURE.md
Defines backend and AI processing architecture.

AI_API_SPEC.md
Defines REST API endpoints.

AI_UI_UX_CONTEXT.md
Defines frontend design system and screen behavior.

CODING_STANDARDS.md
Defines coding style and architecture rules.

FEATURE_DEVELOPMENT_WORKFLOW.md
Defines how features must be implemented.

AI_INSIGHTS_PIPELINE.md
Defines how AI analysis works.

SECURITY_MODEL.md
Defines encryption and privacy model.

AI_TASKS.md
Defines development roadmap.

---

# Technology Stack

Frontend

React Native
TypeScript
React Navigation
TanStack Query
Zustand

Backend

Node.js
Express
MongoDB (Mongoose)

AI Layer (MVP)

OpenAI API
background AI analysis jobs

---

# Backend Structure

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

feature.routes.ts
feature.controllers.ts
feature.validators.ts

---

# Backend Request Flow

Client request
↓
Route handler
↓
Controller
↓
Service logic
↓
Database
↓
Response

---

# AI Processing Overview

Journal entries are analyzed by OpenAI after submission.

Flow:

User submits journal
↓
Entry saved to database
↓
AI analysis job triggered
↓
Structured behavioral features extracted
↓
Features stored in database
↓
Insights APIs aggregate patterns

---

# Development Philosophy

Focus on building a working MVP quickly.

Avoid premature complexity.

Use OpenAI API for AI insights initially.

Add advanced AI architecture later if necessary.
