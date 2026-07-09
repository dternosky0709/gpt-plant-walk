# Contributing to GPT Plant Walk

GPT Plant Walk is being developed as a real production software project. Changes should be planned, reviewed, tested, and released in small, reliable increments.

## Roles

- Product Owner: David Ternosky
- Engineering Assistant: ChatGPT
- Repository: `dternosky0709/gpt-plant-walk`

## Development Principles

1. Do not redesign the architecture unless explicitly approved.
2. Treat every change as production software.
3. Prefer small, focused releases over large rewrites.
4. Preserve the mobile field workflow.
5. Do not add features that slow down issue capture without clear value.
6. Every release should have a version number and release notes.
7. Every change should be testable.

## Sprint Format

Each sprint should define:

- Sprint goal
- Files expected to change
- Why those files are changing
- Acceptance criteria
- Release notes
- Files added
- Files modified
- Future TODOs

## Preferred Workflow

1. Start from the current `main` branch.
2. Define the sprint or bug fix.
3. Make the smallest safe change.
4. Test on iPhone/iPad, especially Safari/PWA behavior.
5. Update `CHANGELOG.md` for meaningful releases.
6. Commit with a clear message.

## Commit Message Style

Use practical sprint-based messages:

- `Sprint 4.2 alpha7 - Resize report photos for print`
- `Sprint 5 - Add equipment and priority fields`
- `Fix photo draft persistence after save`

## Manual Regression Checklist

Before calling a release stable, test:

1. Start Plant Walk
2. Verify observation field starts blank
3. Start Voice Dictation and confirm cursor focuses the observation box
4. Save an issue without a photo
5. Save multiple issues with photos
6. Finish the walk
7. Generate report
8. Print / Save PDF
9. Confirm photos are not cropped
10. Confirm photos do not split awkwardly across pages
11. Open Previous Walks
12. Confirm saved walks and photos persist after refresh
13. Test with the version query string, for example `?v=alpha7`, during active development

## Storage Notes

Photos must not be stored directly in `localStorage`. The app uses IndexedDB for photo-backed walk data because iPhone Safari can exceed `localStorage` limits with base64 images.

## PWA Cache Notes

During active development, use query strings like `?v=alpha7` to bypass stale Safari/PWA cache. A future sprint should add explicit service worker update handling.

## Definition of Done

A sprint is done when:

- The feature works on the target mobile device.
- Existing core workflows still work.
- Version text is updated.
- Changelog or roadmap is updated when appropriate.
- The app can still generate a useful plant walk report.
