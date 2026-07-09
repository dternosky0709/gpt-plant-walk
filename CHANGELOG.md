# Changelog

All notable changes to GPT Plant Walk will be documented here.

This project follows milestone-based releases. Each release should include the sprint goal, files changed, key fixes, and remaining TODOs.

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

Next major work begins with Sprint 5: richer issue capture, including equipment, location, priority, and category fields.
