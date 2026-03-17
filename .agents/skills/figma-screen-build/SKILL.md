---
name: figma-screen-build
description: Build or update a Journal.IO mobile screen from a Figma design when the task includes a Figma URL, node ID, screenshot, or explicit design-to-code request. Use for translating Figma frames into React Native screens and components that fit Journal.IO's calm visual system, existing frontend structure, and repo-specific UX rules.
---

# Figma Screen Build

Use this skill when a task starts from design artifacts and the target output is Journal.IO frontend code.

## Read first

Open these only as needed:

1. `AGENTS.md`
2. `AI_UI_UX_CONTEXT.md`
3. `CODING_STANDARDS.md`
4. The relevant frontend files under `frontend/src`

If a Figma MCP server is configured, use it. If not, fall back to the design artifact the user provided and state that limitation.

## Preferred workflow

1. Inspect the target node or frame with Figma tooling if available.
2. Extract structure, spacing, copy, states, and reusable component opportunities.
3. Map the design into the existing React Native app structure instead of generating a parallel UI system.
4. Implement the smallest complete screen slice, including service integration or local state only if the screen requires it.
5. Preserve calm, reflective UX and subtle motion.
6. Verify the screen for both mobile layout sanity and repo consistency.

## Journal.IO-specific design rules

- Favor Manrope for headlines and DM Sans for body text when the repo styling supports it.
- Match the documented colors and emotionally safe tone.
- Keep cards and flows simple, readable, and low-noise.
- Avoid flashy motion, harsh alerts, or copy that sounds clinical or diagnostic.

## Implementation rules

- Put reusable pieces in `frontend/src/components`.
- Keep screen-level composition in `frontend/src/screens`.
- Put API access in `frontend/src/services`.
- When backend data is needed, verify the contract before wiring UI.
- Include loading, empty, and error states when the design implies real data.

## Done criteria

- The result feels like Journal.IO, not a generic generated UI.
- The code follows existing frontend structure.
- States and data hooks are not left as placeholders.
- Verification steps are recorded honestly.

