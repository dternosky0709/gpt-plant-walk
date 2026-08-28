# Changelog

All notable changes to GPT Plant Walk will be documented here.

This project follows milestone-based releases. Each release should include the sprint goal, files changed, key fixes, and remaining TODOs.

## v1.3.2 - Vercel Planner Cutover

### Changed
- Routes authenticated work-order intake to the protected Vercel Maintenance Planner.
- Preserves stable queued event and work-order IDs so previously unsent walks can be retried without duplicate creation.
- Refreshes the installed PWA cache while preserving IndexedDB walks, photos, and pending synchronization records.

### Operator action
- Reopen Plant Walk once while online, open the affected completed walk, and tap **Retry Sync**.

## v1.3.1 - Maintenance Packet Photo Payload Repair

### Fixed
- Creates print-optimized photo copies only while generating the Maintenance Packet, preventing multi-work-order photo packets from being rejected before PDFBolt conversion.
- Preserves every original IndexedDB photo unchanged.
- Checks request size before transmission and displays the specific server or PDFBolt error instead of replacing it with a generic message.

### Preserved
- One issue still produces exactly one work-order page in original order.
- Original observations, work-order IDs, Planner synchronization, and saved walk data remain unchanged.

## v1.3.0 - Photo Gallery and Direct Work-order Review

### Added
- Persistent Gallery icon in the bottom navigation.
- Newest-first gallery of photos from completed walks stored on the current device.
- Direct work-order detail view when a gallery photo is tapped, including the original observation, selected photo, clean work-order number, AI assessment when available, Planner sync status, and technician closeout fields.

### Preserved
- Gallery browsing does not generate a PDF or require a network request.
- Original observations and locally stored photos remain unchanged.
- Maintenance Planner remains a separate application and source of downstream workflow status.

## v1.2.1 - AI Walk History Analysis

### Added
- Automatic server-side AI analysis after each completed walk.
- Review-required narrative summaries and per-issue priority, trade, and recommendation in Settings → Walk History.
- On-demand AI summary generation for previously completed walks.
- Structured OpenAI Responses API output with strict validation before local persistence.

### Safety and reliability
- Keeps the OpenAI API key exclusively in the server environment.
- Preserves original field observations as the source record and requires “Field verification required” for unsupported details.
- Leaves Maintenance Planner status, assignment, and work orders unchanged.
- Keeps baseline maintenance packet generation available when AI is unavailable.

### Deferred
- Photo analysis and AI-authored maintenance packet sections remain disabled during the text-only pilot.

## v1.2.0 - Industrial Interface and Walk History

### Added
- Dark industrial visual system aligned with Maintenance Planner.
- Persistent Home and Settings navigation throughout the application.
- Resume Current Walk status and action on the home screen.
- Settings-based Walk History with detailed recorded-item summaries.
- Confirmed local deletion for completed walks.
- Service-worker update detection that reloads once when a new app version takes control.

### Changed
- Removed Previous Walks from the main screen and renamed it Walk History.
- Made enabled buttons solid and high-contrast so they no longer appear unavailable.
- Preserved IndexedDB walks, photos, drafts, and Planner synchronization data during the interface update.

### Deferred
- AI-written Walk History descriptions remain dependent on the production AI analysis service; this release shows the complete recorded observations without pretending they are AI-generated.

## v1.1.2 - Clean Work-order Display

### Changed
- Plant Walk and generated maintenance packets show the clean configured work-order number without the observation-derived uniqueness suffix.
- The globally unique permanent ID remains stored and synchronized internally, preserving collision protection and idempotent retries.
- Previously accepted v1.1.1 work orders display cleanly without changing their stored identity or Planner history.

## v1.1.1 - Cross-device Work-order Identity Repair

### Fixed
- Work-order IDs now include a stable observation-derived suffix, preventing collisions between phones, installed PWAs, Safari, and desktop browsers.
- Completed unsynced work orders created by v1.1 are automatically re-keyed and retried without losing their observations or photos.
- Finish Walk now waits for the first Planner synchronization attempt and displays the actual rejection message when attention is required.

### Compatibility
- Already accepted work orders keep their original permanent IDs.
- Retries keep the same event ID and globally unique work-order ID.

## v1.1.0 - Maintenance Planner Synchronization Foundation

### Added
- Permanent Plant Walk work-order IDs assigned when observations are saved.
- IndexedDB-backed outbound intake event queue with stable retry event IDs.
- Automatic retry after reconnect and manual retry from the completed-walk screen.
- Visible pending, failed, and accepted synchronization status.
- Server-side authenticated proxy to the Maintenance Planner v1 intake endpoint.
- Automated contract, retry, and proxy validation tests.

### Changed
- Maintenance packets now use the same permanent work-order IDs sent to Maintenance Planner.
- Product documentation now reflects Engineering OS Decision 014.

### Remaining
- Deployment secrets must be configured on the Plant Walk host before live synchronization can succeed.
- Photo bytes remain device-local; v1 sends durable photo identity metadata only.

## v0.7.0-alpha1 - Sprint 6 Practical Maintenance Report Format

### Added
- New practical maintenance-planner report format.
- Maintenance Summary section to replace generic executive/safety boilerplate.
- Prioritized Action List with suggested work order numbers.
- Suggested Work Orders section with repair steps, parts/materials, craft, verification, and confidence prompts.
- Mechanical / Maintenance Repair Notes section.
- Reliability / Engineering Notes section.
- Issue Details With Original Notes section for traceability.

### Changed
- Removed generic final report structure from the ChatGPT-ready prompt.
- Reduced emphasis on standalone safety/executive summary sections unless actual safety concerns are present.
- Updated the printable report preview to align with a maintenance planning workflow.
- Kept the fast single-observation field workflow unchanged.

### Product Decision
- Reports should answer: what is broken, how serious is it, how should it be repaired, what work orders should be created, and what reliability improvements should be considered.

## v0.6.1-alpha4 - Sprint 5.1 AI Report Engine

### Added
- Expanded ChatGPT-ready AI analysis request.
- Stronger role definition for Maintenance Manager, Reliability Engineer, Controls Engineer, Safety Coordinator, and Engineering Director perspectives.
- Issue-by-issue AI analysis requirements for equipment, area, discipline, failure mode, probable cause, safety risk, production risk, reliability impact, priority, corrective action, work order, PM improvement, engineering improvement, confidence, and field verification.
- Professional report section explaining that categorization happens after capture during AI analysis.

### Changed
- Kept the fast single-observation field workflow.
- Improved generated prompt consistency so ChatGPT returns more structured maintenance reports.
- Updated cache-busting script references for this release.

### Product Decision
- GPT Plant Walk should capture fast in the field and let AI perform classification, prioritization, and work-order planning after the walk.

## v0.6.0-alpha2 - Sprint 5 Fast Capture Workflow Restored

### Changed
- Restored the issue capture screen to the fast single-observation workflow.
- Removed equipment, location, priority, category, and work-order selection fields from the field-entry screen.
- Updated ChatGPT-ready report instructions so AI categorizes equipment, area, priority, category, safety impact, reliability impact, and suggested work orders from the observation notes and photos.
- Treats every saved issue as requiring a suggested work order during report analysis.

### Product Decision
- Field capture must stay fast. Categorization should happen after the walk during report generation and ChatGPT analysis, not during issue entry.

## v0.6.0-alpha1 - Sprint 5 Richer Issue Capture

### Added
- Equipment field for each issue.
- Location field for each issue.
- Priority field: Critical, High, Medium, Low.
- Category field: Mechanical, Electrical, Controls, Safety, Reliability, Housekeeping, Other.
- Work order required checkbox.
- Structured metadata display on saved issue cards.
- Structured metadata in ChatGPT-ready reports.
- Structured metadata in the professional printable report.

### Changed
- Draft recovery now includes structured issue fields.
- New issues default to Medium priority and Reliability category.
- Report issue cards now show priority badges and maintenance metadata.

### Notes
- Existing walks remain compatible. Older issues without structured fields will display safe default values where needed.
- Superseded by v0.6.0-alpha2 after field testing showed the extra input fields slowed the plant walk workflow.

## v0.5.0-alpha7 - Sprint 4.2 Report Photo Polish

### Added
- Professional report photo sizing for printable PDF output.
- Print rules that help keep each issue and its photos together.

### Changed
- Report photos now preserve full image aspect ratio without cropping.
- Report photos are no longer full-page by default.
- PDF output is cleaner and more management-ready.

### Fixed
- Photos split across PDF pages.
- Cropped report photos.

## v0.5.0-alpha4 - Sprint 4.2 IndexedDB Stability

### Added
- IndexedDB-backed storage path for photo-backed issues.

### Changed
- Save Issue flow waits for persistence before clearing the form.
- Draft handling no longer corrupts the next photo-backed issue.

### Fixed
- Multiple issues with photos now save successfully.
- LocalStorage quota failures caused by base64 photo storage.

## v0.4.1 - Sprint 4.1 Reliability Improvements

### Added
- Better version visibility.
- Improved photo-processing feedback.

### Changed
- Start Voice Dictation now focuses the Observation field automatically.
- New Plant Walk starts with a clean observation box.

### Fixed
- Previous observation text appearing at the start of a new walk.
- Silent photo-save failures replaced by visible errors during debugging.

## Project Direction

Next major work: continue improving AI/report-side categorization while keeping field capture simple.
