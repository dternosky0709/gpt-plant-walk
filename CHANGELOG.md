# Changelog

All notable changes to GPT Plant Walk will be documented here.

This project follows milestone-based releases. Each release should include the sprint goal, files changed, key fixes, and remaining TODOs.

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
