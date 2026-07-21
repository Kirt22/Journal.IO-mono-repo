# Journal.IO Product Blueprint

Journal.IO is a behavioral journaling app focused on reflection, pattern awareness, and practical weekly improvement.

The product is supportive, non-clinical, and privacy-conscious.

---

# Core Goal

Enable users to:

- journal consistently
- quickly log mood and context
- identify recurring behavioral patterns
- track trends over time
- follow realistic weekly action steps

---

# Non-Goals

Journal.IO does not:

- diagnose mental health conditions
- present medical conclusions
- position AI output as clinical advice

Insight language must remain uncertainty-aware, for example:

- "journal entries suggest"
- "a recurring pattern may be"
- "appears associated with"

---

# Current Experience Flow

Primary user journey represented by the latest design context:

1. Auth entry (email, Google, or Apple)
2. Onboarding v2 (12 steps) for authenticated users who still need it
3. Create account (email path)
4. Verify email (email path)
5. Sign in (returning email users)
6. Post-auth paywall for eligible non-premium users after onboarding is complete
7. Profile setup where still needed
8. Home dashboard
9. Core journaling loops (new entry, history/calendar, manual Goals, insights, Mind Map, profile/settings/privacy)
10. Supporting monetization entry surfaces such as the premium paywall

---

# Core Product Areas

- onboarding and trust education
- authentication and profile setup
- premium upsell / paywall entry
- quick mood check-in
- daily journaling and history
- AI-assisted insights
- streak and habit reinforcement
- reminders and weekly action plans
- privacy and safety controls
- user-owned manual goals available without Premium
- an educational iOS Mind Map that never presents personal data without Premium and AI consent

## Revamp Implementation Note

The approved post-entry chooser, generic Free previews, paid guided-entry gate, per-entry map contexts, historical backfill, and purchase-resume flow remain target work. The current implementation provides the foundations documented in `APP_EXPERIENCE_FLOW.md`: normalized entry modes, manual Goals, Pro-only suggestion retrieval, an iOS Mind Map tab, and Free/AI-off educational rendering.

---

# Product Philosophy

The UX should feel:

- calm
- reflective
- emotionally safe
- practical
- easy to understand

The app should help users take small, repeatable actions instead of overwhelming them.

---

# MVP Success Signals

- daily journaling rate
- 7-day and 30-day retention
- mood check-in completion rate
- weekly action plan completion rate
- user-rated helpfulness of insights
