---
name: figma-screen-build
description: Build or update a Journal.IO mobile screen from a Figma design when the task includes a Figma URL, node ID, screenshot, or explicit design-to-code request. Use for translating Figma frames into React Native screens and components that fit Journal.IO's calm visual system, existing frontend structure, and repo-specific UX rules.
---

# Figma Screen Build

Use this skill when a task starts from design artifacts and the target output is Journal.IO frontend code.

## Fixed design source

Unless the user explicitly overrides it, always fetch screens from this Figma Make project:

- `https://www.figma.com/make/TwIHpnGcuQiWooDwPDbOER/Design-Journal.IO-Mobile-App?p=f&t=g4PDg1lIppYHD3Sh-0`

Treat this as the default source of truth for screen implementation work in this repo.

## Read first

Open these only as needed:

1. `AGENTS.md`
2. `AI_UI_UX_CONTEXT.md`
3. `CODING_STANDARDS.md`
4. `SCREEN_IMPLEMENTATION_STATUS.md`
5. The relevant frontend files under `frontend/src`

If a Figma MCP server is configured, use it. If not, fall back to the design artifact the user provided and state that limitation.

## Preferred workflow

1. Fetch the latest screen data from the fixed Figma Make source before implementation.
2. Inspect the target node, frame, or generated source with Figma tooling if available.
3. Extract structure, spacing, copy, states, and reusable component opportunities.
4. Map the design into the existing React Native app structure instead of generating a parallel UI system.
5. Implement the smallest complete screen slice, including service integration or local state only if the screen requires it.
6. Update `SCREEN_IMPLEMENTATION_STATUS.md` with the new status, notes, and affected target files.
7. Preserve calm, reflective UX and subtle motion.
8. Verify the screen for both mobile layout sanity and repo consistency.

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
- `SCREEN_IMPLEMENTATION_STATUS.md` is updated for the touched screen.
- Verification steps are recorded honestly.
