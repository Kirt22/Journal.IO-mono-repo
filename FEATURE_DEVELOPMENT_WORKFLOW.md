# Feature Development Workflow

journal.io development follows **vertical feature slices**.

Each feature must be implemented completely before moving to the next feature.

---

# Implementation Steps For Each Feature

Step 1
Design backend API endpoints.

Step 2
Create database schemas.

Step 3
Implement backend routes.

Step 4
Implement controllers.

Step 5
Implement validators.

Step 6
Test backend endpoints.

Step 7
Create frontend screens.

Step 8
Create frontend API service functions.

Step 9
Integrate frontend with backend.

Step 10
Test full feature end-to-end.

Only after completing these steps should development proceed to the next feature.

---

# Example Feature Workflow

Example: Authentication

Backend APIs

POST /auth/signup
POST /auth/login
POST /auth/logout
POST /auth/refresh

Frontend screens

Signup screen
Login screen
Authentication state management

After integration and testing, development proceeds to the next feature.

---

# Development Rules

Work on only **one feature at a time**.

Avoid partially implemented features.

Each feature must include:

backend
frontend
integration
testing

---

# Backend Feature Modules

Backend modules live in:

src/services/{feature}

Example modules

src/services/auth
src/services/journal
src/services/insights

---

# Frontend Modules

frontend/src

screens
components
services
hooks
store
navigation
