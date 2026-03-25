# Google Sheets Sync Contracts

This document maps the active request/response contracts for Google Sheets sync routes and shared bridge functions.

## API routes

### `POST /api/sync-to-sheet`
- Auth: signed-in user (`requireAuth`), room ownership unless admin.
- Input body:
  - `roomNumber` (string/number, required)
  - `newStatus` (`Home` | `Out` | `In base` | `Abroad`, required)
- Success response:
  - `200 { success: true }`
- Validation/auth responses:
  - `400` invalid payload
  - `403` forbidden room access
  - `404` room not found in reception sheet
  - `422` room row has no sheet id
  - `429` rate limited
- Failure responses:
  - `5xx { success: false, code, message, retryable, durationMs, requestId, operation }`

### `POST /api/reception/status`
- Auth: signed-in user (`requireAuth`), room ownership unless admin.
- Input body:
  - `roomNumber` (optional)
- Success response:
  - `200 { status }` where status is one of valid statuses, fallback `Home`.
- Validation/auth responses:
  - `403` forbidden room access
  - `429` rate limited
- Failure fallback:
  - `200 { status: 'Home' }` on upstream/read errors.

### `GET /api/reception/all`
- Auth: admin (`requireAdmin`)
- Success response:
  - `200 { rows: [...] }`
- Failure response:
  - `5xx { error, code?, retryable?, durationMs?, requestId? }`

### `POST /api/soldiers/search`
- Auth: signed-in user (`requireAuth`)
- Input body:
  - `searchTerm` (string)
- Success response:
  - `200 { soldiers: SafeSoldier[] }`
- Validation/auth responses:
  - `429` rate limited
- Failure response:
  - `5xx { error, code?, retryable?, durationMs?, requestId? }`

### `POST /api/soldiers/update-sheet`
- Auth: owner or admin (`requireOwnerOrAdmin`)
- Input body:
  - `userId` (required)
  - `updateData` (object, required)
- Idempotency:
  - optional `Idempotency-Key` header supported for replay-safe writes.
- Success response:
  - `200 { success: true, message }`
- Non-terminal response:
  - `200 { success: false, message }` when no ID number can be matched.
- Failure response:
  - `5xx { success: false, code, message, retryable, durationMs, requestId, operation }`

### `POST /api/soldiers/archive`
- Auth: admin (`requireAdmin`)
- Input body:
  - `exportData` (object, required)
- Idempotency:
  - optional `Idempotency-Key` header supported for replay-safe writes.
- Success response:
  - `200 { success: true, ... }` (bridge passthrough)
- Failure response:
  - `5xx { error, code, message, retryable, durationMs, requestId, operation }`

### `POST /api/admin/sync-from-sheets`
- Auth: admin (`requireAdmin`)
- Input body:
  - optional metadata (`reason`)
- Success response:
  - `200 { success: true, updated, flagged, skipped, unmatchedRows }`
- Failure response:
  - `5xx { success: false, code, message, retryable, durationMs, requestId, operation }`

### `POST /api/status-webhook`
- Auth:
  - signed webhook headers (preferred), or legacy shared secret header.
- Input body:
  - `room` (required)
  - `status` (`Home` | `Out` | `In base` | `Abroad` | `Empty`)
- Behavior:
  - `Empty` is ignored as sheet-only.
  - stale webhook updates are ignored when local `updatedAt` is newer than webhook event timestamp.
- Success response:
  - `200 { success: true, message }` or `202` for stale ignored.
- Failure response:
  - `4xx/5xx { error | message }`

## Shared bridge functions (`src/lib/serverSheetsBridge.js`)

- `fetchAllSoldiersFromSheets(context?) -> Promise<Array>`
- `searchSoldiersInSheets(searchTerm, context?) -> Promise<Array>`
- `updateSoldierInSheets(sheetPayload, context?) -> Promise<Object>`
- `fetchReceptionRows(context?) -> Promise<Array>`
- `updateReceptionStatusById(id, status, context?) -> Promise<Object>`
- `updateReceptionStatusByRoom(room, status, context?) -> Promise<Object>`
- `archiveSoldierToSheet(exportData, context?) -> Promise<Object>`

All bridge functions now throw a structured `SheetsBridgeError` on failure and support request-level context:
- `requestId`
- `operation`
- `allowWriteRetries`
- `idempotencyKey` (for write endpoints)
