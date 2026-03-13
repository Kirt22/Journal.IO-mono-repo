# Coding Standards

This document defines the coding conventions used in journal.io.

The goal is to maintain a clean, scalable, and consistent codebase.

---

# Backend Standards

Backend uses Node.js with Express and MongoDB.

---

# Feature-Based Structure

Each feature lives in its own module.

Example

src/services/auth

auth.routes.ts
auth.controllers.ts
auth.validators.ts

---

# Controller Responsibilities

Controllers must:

validate input
call service logic
return formatted response

Controllers should not contain heavy business logic.

---

# Validation

All incoming requests must be validated.

Validation should use schema validation libraries.

Example

Zod
Joi

---

# Error Handling

All errors must follow standard format.

{
success: false,
message: string
}

---

# Logging

All server errors must be logged.

Important logs include

authentication events
security events
AI analysis failures

---

# Database Standards

MongoDB used with Mongoose.

Schemas stored in

src/schema

Example

user.schema.ts
journal.schema.ts
entry_features.schema.ts

---

# Naming Conventions

Variables

camelCase

Files

featureName.type.ts

Examples

journal.routes.ts
journal.controllers.ts

---

# Frontend Standards

React Native + TypeScript.

---

# Frontend Structure

frontend/src

screens
components
services
hooks
store
navigation

---

# Screen Organization

Each screen lives in

src/screens

Example

LoginScreen.tsx
JournalScreen.tsx
InsightsScreen.tsx

---

# API Services

All API calls live in

src/services

Example

authService.ts
journalService.ts

---

# State Management

Use Zustand or Redux Toolkit.

State should not be tightly coupled to UI components.

---

# Reusable Components

Components live in

src/components

Example

Button
Card
Slider
Chart

---

# Code Quality Rules

Avoid large functions.

Prefer small reusable functions.

Use clear variable names.

Add comments where logic is complex.

---

# AI Development Guidelines

When generating code with AI tools:

follow existing structure
do not introduce new architecture patterns
keep feature modules consistent

All AI-generated code must be reviewed before merging.
