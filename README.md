# GPT Plant Walk

A Progressive Web App for maintenance plant walks.

## MVP Features

- Start Plant Walk
- Record Issue
- Voice Dictation
- Multiple Photos
- Auto-save every issue
- Previous Walks
- Professional printable PDF report with embedded photos
- ChatGPT-ready report
- Installable on iPhone Home Screen
- Offline capable

## Sprint 1

Created the first working PWA foundation using plain HTML, CSS, and JavaScript.

## Sprint 2

Added voice dictation and professional printable PDF reporting with embedded photos.

## Sprint 3 / v0.1.1

Fixed photo handling and report verification.

- Compresses photos before saving so browser storage is less likely to fail.
- Shows a clear photo-ready message before saving an issue.
- Disables Save Issue while photos are processing.
- Copies selected photos into the issue record at save time.
- Shows photo counts in previous walks and professional reports.
- Adds captions to report photos.

## How to Run

Open `index.html` in a browser.

For full PWA install/offline testing, serve the project locally or through GitHub Pages.
