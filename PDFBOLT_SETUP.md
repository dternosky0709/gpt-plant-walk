# PDFBolt Integration Setup

## Architecture

The browser sends a `PlantWalkPacketV2` JSON payload to `/api/generate-maintenance-packet`. The serverless endpoint renders the version-controlled Maintenance Packet v2.0 HTML and sends Base64-encoded HTML to PDFBolt's `/v1/direct` endpoint.

The private API key must never be placed in browser JavaScript, localStorage, IndexedDB, GitHub Pages, or committed files.

## Authoritative production layout

- Template source: `api/maintenance-packet-template.js`
- Rendering engine: PDFBolt Direct HTML conversion
- Paper: US Letter, portrait
- Packet order: one executive cover followed by exactly one page per issue
- Work-order layout: Work Order Standard v2.0

A PDFBolt dashboard template ID is not required. The repository controls the production layout and its version history.

## Deployment

Deploy the repository to Vercel so the PWA and `/api` endpoint share one origin.

1. Import `dternosky0709/gpt-plant-walk` into Vercel.
2. Use the default framework setting (`Other`).
3. Add `PDFBOLT_API_KEY` to the deployment environment.
4. Optionally set `ALLOWED_ORIGIN` to the exact production URL.
5. Deploy.
6. Complete a test walk, open its report, and select **Generate Maintenance Packet**.

## Exact API-key configuration

For the deployed application, configure the key in the Vercel project:

1. Open the GPT Plant Walk project in Vercel.
2. Open **Settings** -> **Environment Variables**.
3. Add a variable named exactly `PDFBOLT_API_KEY`.
4. Paste the private PDFBolt API key as its value.
5. Enable it for **Production**. Enable **Preview** only if preview deployments must generate test packets.
6. Redeploy after saving the variable.

For local serverless testing with `vercel dev`, place the same variable in an uncommitted `.env.local` file:

```text
PDFBOLT_API_KEY=replace-with-your-private-pdfbolt-api-key
```

Do not put the key in `pdfbolt.js`, `index.html`, Obsidian, GitHub, or any browser-accessible setting.

## Governed behavior

- Observations are preserved verbatim.
- Photos remain associated with the matching issue.
- Missing facts print as `Field verification required`.
- The renderer does not invent priorities, equipment, causes, impacts, or repair actions.
- Reliability recommendations do not appear in the maintenance packet.
- Hosted AI analysis is intentionally deferred to v1.1. Version 1.0 does not require an OpenAI key or an AI-analysis service.
- When analysis fields are unavailable, the packet displays `Field verification required` and remains usable as a field-verification work order.
- Technician notes, actual repair time, completion date, and parts used remain blank for manual completion.
- Final PDF generation requires an internet connection.
- A PDFBolt failure does not alter or delete the locally saved walk.

## Acceptance tests

1. One issue with one photo.
2. One issue without a photo.
3. Multiple issues with mixed photo counts.
4. Long observation text.
5. Photo-only issue.
6. Portrait and landscape photos.
7. PDFBolt request-size or quota failure.
8. Offline generation attempt.

## Acceptance checks

- The cover is exactly one page.
- One work-order page is created for every issue.
- Original observations remain verbatim.
- Work-order numbers follow app settings.
- The primary photo appears beside the matching observation.
- No reliability-recommendation page or section is present.
- No blank pages or fake company names are created.
- Manual technician and parts-used areas remain blank.
