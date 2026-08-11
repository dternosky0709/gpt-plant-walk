# Project Context

## Product

GPT Plant Walk is a mobile-first, installable, offline-capable PWA for fast plant-walk observation capture and professional maintenance-packet generation.

The intended field loop is:

1. Start a walk.
2. Capture a concise observation by voice or typing.
3. Attach one or more photos.
4. Save independent issues in their original order.
5. Finish the walk.
6. Generate a professional Maintenance Packet v2.0 PDF.
7. Reopen completed walks from Previous Walks or return to a clean start screen.

## Product owner and operating environment

- Product owner: David Ternosky
- Primary use: industrial maintenance and engineering plant walks
- Primary device: iPhone, including Add to Home Screen PWA behavior
- Repository: `dternosky0709/gpt-plant-walk`

## Current architecture

- Static mobile-first frontend: `index.html`, `app.js`, `styles.css`, and supporting modules
- Offline/PWA: `manifest.webmanifest` and `sw.js`
- Durable local storage: IndexedDB through `storage.js`
- Immutable/versioned AI configuration: `ai-config.js`
- Versioned walk input contract: `walk-contract.js`
- Versioned analysis contract: `analysis-contract.js`
- Prompt construction: `prompt-builder.js`
- AI client pipeline: `ai-service.js`
- Server endpoint foundation: `api/analyze-walk.js` using strict request validation and mock output
- PDF generation: `api/generate-maintenance-packet.js`, `api/maintenance-packet-template.js`, and `pdfbolt.js`

## Current status

The source identifies the app as GPT Plant Walk 1.1.2 and includes cross-device work-order identity protection, clean operator-facing work-order numbers, and the Maintenance Planner synchronization foundation on top of the Phase 2 endpoint base. Production hosted AI is not active; baseline packet generation remains available without it.

Earlier product records described a release-candidate validation gate with critical iPhone/PWA checks still needing completion. Codex should verify the current release-validation evidence rather than assume production approval.

## Near-term direction

1. Reconcile documentation with actual source behavior.
2. Complete release regression validation on the target device.
3. Preserve the reliable PDFBolt Maintenance Packet v2.0 output.
4. Continue the server-side AI analysis phase only behind a safe fallback.
5. Configure and pilot the Plant Walk-to-Maintenance Planner server credentials, then verify offline-to-online delivery on iPhone.

## Later direction

- Shared canonical plant, area, and equipment identities
- Equipment maintenance history
- Repeat-failure tracking and reliability trends
- Management dashboards
- Database-backed collaboration and synchronization

These later capabilities must not compromise the fast field workflow.
