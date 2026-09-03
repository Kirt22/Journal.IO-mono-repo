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

Insight language must be direct and evidence-led. State what the entries show
and cite the evidence, rather than hedging a supported conclusion:

- "you logged working late on nine of those fourteen days"
- "this is avoidance, and it shows up every time plans get difficult"
- "you cancelled twice in March and never rescheduled"

Reserve tentative phrasing ("may", "appears to") for claims that are genuinely
uncertain, and say plainly which is which. Hedging a conclusion the writing
supports reads as evasion, not care.

---

# Current Experience Flow

Primary user journey represented by the latest design context:

1. Auth entry (email, Google, or Apple)
2. Onboarding v2 (12 steps) for authenticated users who still need it
3. Create account (email path)
4. Verify email (email path)
5. Sign in (returning email users)
6. First-reflection completion journey: session Mind Map, optional share card, streak, and optional reminders
7. Post-auth paywall for eligible non-premium users after onboarding is complete; first-run profile defaults are completed automatically
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
- optional image sharing for personalized all-time, per-session, and first-reflection Mind Map signals
- focused iOS Home Screen widgets for free streak tracking, Premium Quick Thought launch, and a privacy-minimal Premium daily mood check-in

## Revamp Implementation Note

The approved post-entry chooser, generic Free previews, paid guided-entry gate, per-entry map contexts, historical backfill, and purchase-resume flow remain target work. The current implementation provides the foundations documented in `APP_EXPERIENCE_FLOW.md`: normalized entry modes, manual Goals, Pro-only suggestion retrieval, an iOS Mind Map tab, and Free educational rendering.

---

# Product Philosophy

The UX should feel:

- calm
- reflective
- emotionally safe
- practical
- easy to understand

The app should help users take small, repeatable actions instead of overwhelming them.

Home Screen widgets follow the same principle: Streak gives every user a compact progress view, Quick Thought opens Premium users directly into focused writing, and Mood Check-in gives Premium users one clear once-daily action. Users activate their chosen widgets from Settings, and each habit remains a separate widget rather than crowding multiple interactions into one surface.

---

# MVP Success Signals

- daily journaling rate
- 7-day and 30-day retention
- mood check-in completion rate
- weekly action plan completion rate
- user-rated helpfulness of insights
