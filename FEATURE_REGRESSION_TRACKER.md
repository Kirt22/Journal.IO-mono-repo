# Feature Regression Tracker

This file is a lightweight guardrail for future feature work.

## Rule

When a feature is added or changed:

1. identify adjacent flows that could regress
2. re-open or re-run those flows after the new change
3. add or update focused tests for both the new feature and the touched old feature
4. record the validation results here before marking the task complete

## Current Watchlist

| Area | Adjacent flows to re-check | Last checked |
| --- | --- | --- |
| Home mood card | selection highlight, save confirmation, quick thought card, recent entries | 2026-03-30 |
| Quick thought | save as journal entry, recent entries hydrate, open full editor | 2026-03-30 |
| Calendar entries | shared dummy data source, recent entries seed, calendar list rendering | 2026-03-30 |
| Journal detail | Home/card tap opens detail, edit action opens journal edit, delete/favorite syncs store | 2026-03-30 |

## Update Template

Use this format when adding a new entry:

| Area | Adjacent flows to re-check | Last checked |
| --- | --- | --- |
| Feature name | Old feature 1, old feature 2 | YYYY-MM-DD |
