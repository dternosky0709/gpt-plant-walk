# GPT Plant Walk

Progressive Web App for maintenance and reliability plant walks.

## Current Release

**Version:** 0.4.1-rc1  
**Release:** Sprint 4.1 RC1

## Sprint 4.1 RC1 Release Notes

### Added

- Centralized app version display in the header and footer.
- Active walk recovery after closing or refreshing the browser.
- Draft autosave while typing.
- Selected photo autosave before the issue is saved.
- Photo compression before local storage to improve reliability on mobile.
- Online/offline status indicator.
- User-facing save/status messages.
- Previous Walks search.
- Previous Walk thumbnails.
- Improved printable report with embedded photos.
- Professional report sections aligned to maintenance and reliability review.

### Improved

- Saved issues are now persisted immediately to the active walk record.
- Finished walks are separated from the active walk state.
- Reports include app version, generated time, issue count, and photo count.
- Service worker cache name was updated to force deployment of the new build.

### Files Modified

- `index.html`
- `app.js`
- `styles.css`
- `manifest.webmanifest`
- `sw.js`
- `README.md`

## Test Checklist

1. Open the app and confirm it displays `v0.4.1-rc1`.
2. Start a plant walk.
3. Type an observation and confirm draft save status appears.
4. Attach one or more photos and confirm previews appear.
5. Close and reopen the browser/app before saving the issue.
6. Confirm the active walk, observation draft, and selected photos are restored.
7. Save the issue.
8. Add a second issue with photos.
9. Finish the walk and generate the report.
10. Confirm photos appear in the professional report.
11. Use Save / Print PDF and confirm photos print under the correct issue.
12. Open Previous Walks and confirm the walk appears with thumbnails.
13. Search Previous Walks by observation text.
14. Turn on airplane mode and confirm the app shell still opens after it has been loaded once.

## Future TODOs

- IronRock branding and logo.
- Equipment/location field.
- Severity field.
- Work order export.
- QR equipment scanning.
- CMMS integration.
