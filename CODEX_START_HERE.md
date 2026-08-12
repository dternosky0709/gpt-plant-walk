# Start Here in Codex

This repository is the source code for **GPT Plant Walk 1.0**. The package adds concise project context distilled from the Plant Walk App Development conversations so a new Codex environment can continue without relying on chat history.

## Current repository checkpoint

- Repository: `dternosky0709/gpt-plant-walk`
- Default branch: `main`
- Packaged commit: `12bd03fd04e723383f0b9d0ff28146ce603979e0`
- App version in source: `1.2.0`
- Maintenance packet schema: `PlantWalkPacketV2`
- Walk/AI contract schema: `1.0`
- Current hosted-AI endpoint behavior: strict validation with mock analysis; no production AI provider call
- PDF path: server-side PDFBolt generation
- Storage path: IndexedDB for walks, issues, photos, and drafts
- Planner synchronization: IndexedDB outbound queue plus authenticated server proxy; deployment credentials still require configuration

## Important source-vs-documentation note

The current code supports arrays of photos per issue and renders multiple photos, while parts of `README.md` and `ROADMAP.md` still describe one photo per issue. Treat the code and tests as the current implementation; reconcile the documentation in a focused follow-up after confirming intended release behavior.

## Recommended first Codex task

Use `CODEX_FIRST_TASK.md`. It asks Codex to audit the repository against the packaged standards, run the test suite, identify documentation drift, and propose the smallest safe next sprint without changing production behavior.

## Companion application

Maintenance Planner is intentionally not included as source code in this repository. It is independently deployed at:

`https://maintenance-planner.dternosky0709.chatgpt.site`

Its relationship to Plant Walk is defined in `docs/MAINTENANCE_PLANNER_INTEGRATION.md`.

## What this package does not contain

This is not a verbatim export of every ChatGPT conversation. It contains a curated, project-only handoff that preserves decisions, constraints, milestones, and unresolved work while excluding unrelated personal conversations and superseded brainstorming.
