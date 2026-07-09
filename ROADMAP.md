# GPT Plant Walk Roadmap

GPT Plant Walk is a Progressive Web App for maintenance and reliability plant walks.

The project is being built in disciplined, production-focused sprints. The goal is to create a dependable tool that can be used on the plant floor to capture observations, photos, reports, work-order recommendations, and eventually equipment history and reliability trends.

## Current Foundation

### Completed through Sprint 4.2

- Mobile-first PWA workflow
- Start Plant Walk
- Record Issue
- Voice dictation
- Multiple photo-backed issues
- IndexedDB storage for photos and walk data
- Previous Walks
- ChatGPT-ready report output
- Printable professional PDF report
- Properly sized, uncropped report photos
- Improved PDF pagination
- GitHub + Codespaces development workflow
- Project changelog

## Sprint 5 - Richer Issue Capture

### Goal
Add structured maintenance data to each issue without slowing down the field workflow.

### Planned Features
- Equipment field
- Location field
- Priority field: Critical, High, Medium, Low
- Category field: Mechanical, Electrical, Controls, Safety, Reliability, Housekeeping, Other
- Work order required: Yes / No
- Better issue cards in the saved issue list
- Updated report sections using the structured issue data

### Acceptance Criteria
- A user can still save a quick observation with minimal taps.
- Structured fields are optional where practical.
- Reports show equipment, location, priority, and category clearly.
- Existing walks continue to display correctly.

## Sprint 6 - Professional Reporting and AI Workflow

### Goal
Make report output polished enough for management review and easier to send into ChatGPT for analysis.

### Planned Features
- Improved report cover/header
- Better action-item formatting
- Priority-based sorting or grouping
- Cleaner maintenance-manager style report layout
- One-tap copy for AI analysis
- Better report language and section structure
- Company-ready formatting hooks for future branding

### Acceptance Criteria
- PDF output is readable, professional, and consistent.
- Report photos remain uncropped and appropriately sized.
- ChatGPT-ready text includes all issue structure.
- Reports are useful without manual cleanup.

## Sprint 7 - Maintenance Intelligence

### Goal
Turn plant walk history into useful maintenance and reliability insight.

### Planned Features
- Equipment history view
- Repeat issue detection
- Search previous walks by equipment, location, category, or text
- Reliability trends
- Open issue / recurring issue summary
- Management dashboard concept

### Acceptance Criteria
- A user can find past issues by equipment or keyword.
- Repeat problems are easier to spot.
- Previous Walks becomes a useful plant history tool, not just an archive.

## Future Sprints

### Equipment and Asset Management
- Equipment list
- QR code scanning
- Asset tags
- Equipment timelines

### Work Order Support
- Suggested work order generation
- Exportable work-order text
- Assignment fields
- Due dates

### Advanced AI Features
- AI-generated executive summary
- Failure mode suggestions
- Safety concern detection
- Reliability ranking
- PM improvement recommendations

### Cloud and Collaboration
- Optional cloud sync
- Shared plant walk history
- User roles
- Email distribution

## Product Principle

Every feature must make plant walks faster, reports better, or maintenance decisions clearer. Avoid feature creep and preserve the simple field workflow.
