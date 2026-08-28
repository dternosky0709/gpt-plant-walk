# GPT Plant Walk 1.3.2

A mobile-first Progressive Web App for capturing plant-walk observations and photos and generating professional maintenance packets.

## Version 1.0 workflow

1. Start a plant walk.
2. Record and save issues with voice or typed observations and one or more photos.
3. Review saved issues and delete an incorrect issue when needed.
4. Finish the walk and generate the Maintenance Packet v2.0 PDF.
5. Return to the clean start screen or reopen a completed walk from Settings → Walk History.
6. Queue every completed-walk work order for authenticated Maintenance Planner intake and retry automatically when connectivity returns.

## Included

- Mobile and installable PWA experience
- Offline capture and IndexedDB persistence
- Voice-assisted observations
- Multiple-photo issue capture
- Clean operator-facing work-order numbers backed by globally unique internal IDs across phones, Safari, installed PWAs, and desktop browsers
- Offline Maintenance Planner outbound queue and visible sync status
- Saved-issue deletion
- Settings → Walk History with detailed recorded-item summaries and confirmed whole-walk deletion
- Automatic server-side AI analysis after a completed walk, with a review-required summary and per-issue priority, trade, and recommendation in Walk History
- On-demand AI summary generation for walks completed before this release
- Persistent Home and Settings navigation
- Bottom-navigation Photo Gallery for completed-walk photos, with direct issue work-order details when a photo is tapped
- Dark industrial interface aligned with Maintenance Planner
- Server-side PDFBolt Maintenance Packet generation
- Back-to-Start reset that preserves completed history

AI analysis uses a protected server-side OpenAI key and never blocks the baseline maintenance packet when unavailable. Original observations remain the source record, and unknown engineering details display “Field verification required.” See `PDFBOLT_SETUP.md` for packet deployment configuration.

## iPhone installation

Open the deployed app in Safari, tap Share, choose Add to Home Screen, and launch GPT Plant Walk from the installed icon.
