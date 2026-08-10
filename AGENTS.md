# GPT Plant Walk — Codex Project Instructions

## Read first

Before changing code, read these files in order:

1. `CODEX_START_HERE.md`
2. `docs/PROJECT_CONTEXT.md`
3. `docs/DECISION_HISTORY.md`
4. `docs/MAINTENANCE_PLANNER_INTEGRATION.md`
5. `README.md`, `ROADMAP.md`, and `CONTRIBUTING.md`

Current source and tests override historical conversation summaries when they conflict. Locked product standards override older prototypes and superseded experiments.

## Product mission

GPT Plant Walk is a mobile-first field-observation application that lets a user quickly capture maintenance findings with voice notes and photos, preserve the original observations, and generate a professional maintenance packet that turns field findings into clear maintenance action.

## Product boundary

- Plant Walk owns field capture: walks, observations, photos, issue order, and source timestamps.
- Maintenance Planner is a separate companion application with its own codebase and deployment.
- Every saved observation becomes one Plant Walk work order when the walk is completed.
- Plant Walk owns the permanent work-order ID and sends it to Maintenance Planner through a versioned API contract.
- Maintenance Planner owns assignment or documented dismissal, planning priority, due date, workflow status, corrective-action closeout, backlog, completed history, and equipment maintenance history after intake.
- Never merge the applications into one codebase or let either application write directly to the other's database.

## Locked behavior

- Preserve the fast field workflow. Do not add required equipment, location, priority, category, or assignment fields to issue capture without explicit product-owner approval.
- Preserve the original observation verbatim in reports and integrations.
- Never invent equipment identity, measurements, failure causes, repair details, parts, labor, or verification results.
- Use `Field verification required` when information is not known.
- Priority names are `Immediate`, `Urgent`, `Planned`, and `Monitor` in the maintenance-packet/planner workflow.
- One issue maps to one work-order page. Do not combine, split, omit, or renumber issues.
- Work Order Standard v2.0 requires the original observation, associated photos, engineering assessment, issue-specific corrective work, and technician closeout fields.
- AI failure must not block baseline packet generation.

## Engineering constraints

- Target iPhone Safari and installed PWA behavior first.
- Preserve offline capture and IndexedDB-backed photo persistence.
- Do not store photo payloads directly in `localStorage`.
- Prefer small, focused changes over rewrites.
- Do not redesign architecture, add production dependencies, change external services, or alter locked report standards without explicit approval.
- Keep source contracts versioned and validate external input strictly.
- Maintain backward compatibility for previously saved walks unless a migration is deliberately approved.

## Validation

- Run the existing Node test suite after JavaScript changes.
- Test the manual regression checklist in `CONTRIBUTING.md` for release work.
- Treat iPhone/PWA validation and PDF page fidelity as release gates, not optional polish.
- Update `CHANGELOG.md` and relevant project context for meaningful product changes.

## Working style

- David Ternosky is the product owner.
- Lead with the implemented result and evidence.
- Do not stop repeatedly to narrate plans. Work independently until a product decision, credential, external cost, or destructive action requires input.
- Preserve unrelated changes and never push, deploy, tag, or edit the Engineering OS unless the task explicitly authorizes it.

## Code review rules

- Flag any change that slows field capture, mutates original observations, breaks issue ordering, weakens input validation, risks photo persistence, or couples Plant Walk directly to Maintenance Planner storage.
- Flag report changes that can combine issues, split a work order across pages, crop photos, invent facts, or omit technician closeout fields.
