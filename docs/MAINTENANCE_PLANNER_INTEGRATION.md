# Plant Walk → Maintenance Planner Integration

## Relationship

Maintenance Planner is a separate, independently deployable companion application. It does not replace Plant Walk and does not share this codebase.

- Plant Walk owns walks, field observations, photos, issue order, and the permanent work-order ID. Every observation remaining when a walk is completed creates one work order.
- Maintenance Planner preserves the Plant Walk ID and owns manager assignment or documented dismissal, planning priority, due date, status/progress, open backlog, corrective-action closeout, completed history, and equipment maintenance history after intake.
- Neither application directly reads or writes the other application's database.

## Proposed v1 boundary

Target operation: `POST /api/v1/work-orders/intake`

Minimum request identity:

```json
{
  "contractVersion": "1.0",
  "eventId": "evt_01J5PW7B82Q6W9GX4T7Z9Z0MFW",
  "sentAt": "2026-08-07T12:30:00Z",
  "source": {
    "application": "plant-walk",
    "deployment": "production",
    "plantWalkId": "PW-2026-0087",
    "observationId": "OBS-2026-0087-003"
  },
  "workOrder": {
    "id": "WO-2026-0142",
    "title": "Requested work-order title",
    "initialPriority": "Planned"
  },
  "observation": {
    "text": "Original observation preserved verbatim",
    "observedAt": "2026-08-07T12:22:15Z",
    "photoReferences": []
  }
}
```

Minimum acceptance response:

```json
{
  "contractVersion": "1.0",
  "eventId": "evt_01J5PW7B82Q6W9GX4T7Z9Z0MFW",
  "intakeStatus": "accepted",
  "workOrderId": "WO-2026-0142",
  "plantWalkObservationId": "OBS-2026-0087-003",
  "acceptedAt": "2026-08-07T12:30:01Z"
}
```

## Synchronization rules

1. `eventId` is the idempotency key and must remain unchanged for retries.
2. `plantWalkObservationId` is stable for the lifetime of the source observation.
3. `workOrderId` is created by Plant Walk, is permanent, and is never reused.
4. Retrying an accepted event returns the same work-order ID and creates no duplicate.
5. Plant Walk stores the event in IndexedDB and marks the work order `pending_sync` until it receives acceptance.
6. Plant Walk is authoritative for identity and source evidence but not for downstream Planner status.
7. Maintenance Planner stores the source walk ID, observation ID, event ID, contract version, received timestamp, and payload fingerprint.
8. Updates to an accepted observation require a future explicit amendment contract; v1 never silently overwrites the original observation.

## Production requirements

- Application-to-application authentication limited to intake
- Transport encryption and strict schema/version validation
- Stable error codes and no partial work-order creation
- Durable photo references or controlled copies, not expiring client URLs
- Monitoring for rejected events, exhausted retries, duplicate attempts, and broken source links
- Shared canonical area/equipment IDs when available; display names are snapshots, not identity
