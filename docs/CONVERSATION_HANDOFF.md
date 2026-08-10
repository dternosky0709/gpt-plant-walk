# Conversation Handoff

This is the project-only history needed to continue development. It summarizes decisions and outcomes rather than reproducing raw chats.

## What the product owner values

- Fast capture with minimal typing during a walk
- Reliable iPhone/PWA behavior and offline operation
- Professional, readable PDF output
- Original observations and photos preserved without AI invention
- Practical maintenance guidance rather than generic executive boilerplate
- Small, testable engineering increments
- Less narration while work is underway; stop only for real product decisions or blockers

## How the product evolved

The project began as a simple iPhone workflow for recording observations and photos. Early iterations improved dictation focus, draft clearing, photo persistence, multiple-photo handling, and printable photo layout. A richer capture form was tested and then intentionally removed because it added too much field-entry friction.

The report evolved from a generic AI-oriented summary into a maintenance-focused packet that answers what was observed, how urgent it is, what work should be planned, what must be field-verified, and how the technician closes the work order. PDFBolt became the reliable server-side rendering path.

The AI phase then introduced immutable configuration, versioned walk and analysis contracts, a prompt builder, a mock client pipeline, and a strict server endpoint foundation. Production AI remains intentionally unconnected until the release baseline is safe.

## Maintenance Planner origin

During field demonstration, Maintenance Supervisor Mike suggested capturing corrective actions after technicians complete work. That led to the Maintenance Planner concept: a separate companion application that receives every work order from a completed Plant Walk, provides manager assignment or documented dismissal and workflow tracking, records corrective-action closeout, and builds equipment history.

The planner prototype uses a dark industrial design with compact but readable typography. It currently uses sample records. Its next implementation phase is persistent plant data, accounts/roles, and reliable Plant Walk synchronization.

## Current unresolved work

- Confirm the authoritative release-validation state on iPhone/PWA.
- Reconcile single-photo wording with multi-photo source behavior.
- Decide when to move the AI endpoint from mock to a production provider and how to retain fallback behavior.
- Implement durable Maintenance Planner persistence and authenticated work-order intake.
- Establish shared plant/area/equipment IDs without sharing application databases.

## Historical caution

Older conversation proposals and prototypes may conflict with the current source or locked standards. Use them as design history only. Never treat a brainstorming idea as approved product behavior unless it appears in the current standards or receives explicit product-owner approval.
