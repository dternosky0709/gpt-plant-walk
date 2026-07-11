# PDFBolt Integration Setup

## Architecture

The browser app sends a `PlantWalkPacketV1` JSON payload to `/api/generate-maintenance-packet`. The serverless endpoint adds the private PDFBolt API key and calls PDFBolt's direct template endpoint. The API key must never be placed in browser JavaScript, GitHub Pages, localStorage, IndexedDB, or committed files.

## Published template

- Template name: GPT Plant Walk Maintenance Packet v1.1
- Template ID: `408df28f-e62c-433e-aefe-ab600eca51a2`

## Recommended deployment

Deploy this repository to Vercel so the static PWA and `/api` endpoint share one origin.

1. Import `dternosky0709/gpt-plant-walk` into Vercel.
2. Select the `sprint-9-pdfbolt-integration` branch for the first test deployment.
3. Use the default framework setting (`Other`).
4. Add these environment variables in Vercel:
   - `PDFBOLT_API_KEY` — private key copied from PDFBolt.
   - `PDFBOLT_TEMPLATE_ID` — `408df28f-e62c-433e-aefe-ab600eca51a2`.
   - `ALLOWED_ORIGIN` — optional; use the exact Vercel production URL after deployment.
5. Deploy.
6. Open the Vercel URL, complete a test walk, open its report, and tap **Generate Maintenance Packet**.

## Important behavior

- Plant-walk capture and local storage continue to work offline.
- Final PDF generation requires an internet connection.
- The current integration creates a raw planning packet from the saved observation and photos.
- Automated AI maintenance analysis is intentionally deferred until PDF rendering is proven reliable.
- A PDFBolt failure does not alter or delete the locally saved walk.

## Phase 1 test cases

1. One issue with one photo.
2. One issue without a photo.
3. Multiple issues with mixed photo counts.
4. Long observation text.
5. Photo-only issue.
6. Portrait and landscape photos.
7. PDFBolt free-plan output-size failure.
8. Offline generation attempt.

## Acceptance checks

- One work-order page is created for every issue.
- Original observations are preserved verbatim.
- Work-order numbers follow app settings.
- Photos stay with the matching issue.
- No blank pages are created.
- Errors are understandable and saved walk data remains intact.
