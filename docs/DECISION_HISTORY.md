# Decision and Standards History

This file is a curated record of consequential Plant Walk decisions from prior development conversations. Current source and locked standards take precedence over older experiments.

## Locked product decisions

### Fast capture stays minimal

Field capture is for observations and photos. A previous experiment added equipment, location, priority, category, and work-order selection to the capture screen; it was reversed because it slowed the walk. Classification and planning belong after capture.

### Original observations are immutable

Reports, AI requests, and downstream integrations must preserve the original observation verbatim and must not invent missing facts.

### Maintenance Packet v2.0

- One issue equals one work-order page.
- Preserve issue order and numbering.
- Do not combine, split, omit, or renumber issues.
- Include the original observation and related photos.
- Include engineering assessment and issue-specific corrective work.
- Include technician closeout, repair time/completion date, and parts used.
- Use `Field verification required` where facts are unknown.
- Priority names are `Immediate`, `Urgent`, `Planned`, and `Monitor`.

### PDFBolt is the authoritative generation path

The server-side PDFBolt path replaced unreliable browser/ChatGPT-only report formatting. The packet must continue to conform to the locked visual and work-order standards.

### Offline and photo reliability

Photo-backed data belongs in IndexedDB, not `localStorage`. Save operations must finish before capture fields are cleared. Report photos should preserve aspect ratio, avoid cropping, and avoid awkward page splits.

### AI is additive, not blocking

The AI pipeline uses versioned contracts and strict validation. AI failure must not prevent baseline maintenance-packet generation. The server endpoint calls OpenAI only when the protected production key is configured and retains a validated mock fallback when it is absent.

### Maintenance Planner remains separate

Maintenance Planner is an add-on companion, not a Plant Walk replacement and not a module in this repository. The applications remain independently deployable and communicate only through an explicit integration boundary.

### Decision 014 — Plant Walk creates every work order

- Every observation remaining in a completed walk creates exactly one work order.
- Plant Walk assigns and owns the permanent work-order ID and original evidence.
- Maintenance Planner accepts that ID idempotently and owns all downstream maintenance workflow.
- Managers assign accepted work orders or dismiss them with a recorded reason; accepted Plant Walk work orders are not hard-deleted.

## Recorded milestones

- Sprint 4.1: voice-dictation focus, clean observation state, photo-save diagnostics
- Sprint 4.2: IndexedDB photo stability and professional report-photo behavior
- Phase 1 release hardening: delete saved issue, Back to Start, cleanup, version wording, regression focus
- PDFBolt v2.0: executive cover and one-page-per-issue packet generation
- Phase 2 Sprint 2.1: immutable AI config, versioned walk contract, prompt builder, response schema, mock pipeline
- Phase 2 Sprint 2.2: strict Vercel `POST /api/analyze-walk` endpoint foundation with mock results
- v1.2.1: protected server-side text AI analysis and review-required Walk History summaries
- v1.3.0: bottom-navigation local Photo Gallery with direct work-order detail review

## Known documentation drift

The current source accepts multiple selected photos and persists/render arrays of photos. Some current repository prose still says one photo per issue. Resolve this deliberately; do not silently remove multi-photo capability to make the prose match.
