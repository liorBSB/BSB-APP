# Localhost QA, Security, and Stress Report

Date: 2026-03-25  
Environment: localhost (`http://localhost:3000`) with `npm run dev`

## What Was Executed

- Full test suite: `npm run test`
- Security probes:
  - Auth gating and unauthenticated endpoint behavior
  - Route auth coverage review across `src/app/api`
  - Dependency audit: `npm audit --omit=dev --json`
- Stress tests (autocannon):
  - `GET /` at 10, 25, 50 concurrent users
  - `POST /api/status-webhook` (unauthorized traffic) at 50 concurrent users

## Automated Test Results

- Total test files: 10
- Total tests: 71
- Passing: 71
- Failing: 0

New coverage added for:

- `src/lib/serverAuth.js`
- `src/app/api/soldiers/search/route.js`
- `src/app/api/reception/all/route.js`
- `src/app/api/proxy-image/route.js`
- `src/app/api/soldiers/update-sheet/route.js`
- Guard tests for `firestore.rules` and `storage.rules`
- 200-record service behavior in `src/lib/soldierDataService.js`

## Stress Test Metrics

### Homepage (`GET /`)

| Concurrency | Avg Latency | p50 Latency | p99 Latency | Avg Req/sec | Total Requests | Errors |
|---|---:|---:|---:|---:|---:|---:|
| 10 | 278.82 ms | 256 ms | 858 ms | 35.47 | 542 | 0 |
| 25 | 670.91 ms | 620 ms | 966 ms | 36.67 | 575 | 0 |
| 50 | 1491.31 ms | 1490 ms | 1924 ms | 33.27 | 549 | 0 |

Observations:

- Throughput plateaus around 33-37 req/sec in local dev mode.
- Latency grows significantly between 25 and 50 concurrency.
- No 5xx spikes were observed in this profile.

### Unauthorized Flood (`POST /api/status-webhook`, no secret)

| Concurrency | Avg Latency | p50 Latency | p99 Latency | Avg Req/sec | Total Requests | Status Codes |
|---|---:|---:|---:|---:|---:|---|
| 50 | 225 ms | 196 ms | 736 ms | 220.34 | 3305 | `401` only |

Observations:

- Endpoint consistently rejected unauthorized requests.
- No bypass observed under burst load.
- This pattern can still be used for request amplification without rate limiting.

## Security Findings

### High

1. Sensitive roster data overexposure from soldier search response  
   - Area: `src/app/api/soldiers/search/route.js`
   - Risk: Response includes `raw` sheet rows for every match. Any authenticated user can query and receive broad data fields from the sheet, potentially including sensitive PII.
   - Recommendation:
     - Return a least-privilege shape by default (name, room, masked id only).
     - Move full-row access behind admin-only gate or a separate privileged endpoint.
     - Add query throttling and audit logging for this route.

### Medium

2. No request-rate controls on abuse-prone endpoints  
   - Areas: `send-feedback`, `check-id`, `soldiers/search`, `status-webhook`
   - Risk: Brute-force enumeration and spam potential (ID probing, feedback email abuse, webhook hammering).
   - Recommendation:
     - Add IP and UID rate limiting (token bucket/sliding window).
     - Add short-term ban/slowdown on repeated failures.

3. Webhook replay protection is weak  
   - Area: `src/app/api/status-webhook/route.js`
   - Risk: Static shared secret prevents unauthenticated access, but does not prevent replay of captured valid payloads.
   - Recommendation:
     - Add timestamp + HMAC signature verification.
     - Reject old timestamps and duplicate nonces.

### Low

4. Dependency audit reports low-severity vulnerabilities in transitive Firebase Admin chain  
   - Source: `npm audit --omit=dev`
   - Result: 8 low-severity issues, no moderate/high/critical in production dependencies.
   - Recommendation:
     - Track advisories and update `firebase-admin` when a compatible patched path is available.

## Edge-Case Matrix (Executed)

| Category | Result | Notes |
|---|---|---|
| Missing/invalid auth headers | Pass | `serverAuth` and route tests cover 401/403 behavior |
| Malformed JSON payload shape | Pass | Route tests cover missing required fields and invalid status values |
| Duplicate/ambiguous sheet data | Pass | Existing tests validate deterministic selection behavior |
| Invalid URL/host/content in image proxy | Pass | Missing URL, invalid URL, blocked host, non-image response covered |
| Rules guardrails | Pass | Firestore/Storage guard assertions verified |
| 200-record scale behavior | Pass | Service test confirms 200-result handling path |
| Role transitions (owner vs admin vs user) | Partial | API auth behavior tested; full UI flow transitions still require browser E2E |
| EN/HE and RTL behavior | Partial | Not fully E2E validated in browser automation in this pass |

## Prioritized Remediation Plan

1. Lock down `soldiers/search` response shape for non-admin callers.
2. Add rate limiting and abuse telemetry on high-risk routes.
3. Upgrade webhook auth to signed/timestamped payload model.
4. Add browser E2E checks for role transitions and EN/HE RTL rendering.

## Round 1 Hardening Update

### Implemented

- Removed `raw` sheet row exposure from `soldiers/search` API responses.
- Normalized search results to app field mapping only (via `sheetRowToApp`).
- Added moderate in-memory rate limiting to:
  - `POST /api/soldiers/search`
  - `POST /api/check-id`
  - `POST /api/soldiers/check-id`
  - `POST /api/send-feedback`
  - `POST /api/status-webhook`
- Added webhook hardening:
  - HMAC signature verification (`x-webhook-signature`)
  - Timestamp validation (`x-webhook-timestamp`)
  - Replay rejection with nonce/signature window (`x-webhook-nonce`)
  - Backward-compatible legacy secret mode retained (`x-webhook-secret`)

### Verification Results

- Full suite after hardening: 12 test files, 81 tests, all passing.
- Unauthorized webhook probe still rejected: `401`.
- Repeated webhook abuse probe now hit limiter and returned `429`.
- Load sanity after hardening (`GET /`, 10s runs):
  - 10 users: avg ~279.95ms, avg ~35 req/s
  - 25 users: avg ~703.12ms, avg ~32.3 req/s
  - 50 users: avg ~1549.65ms, avg ~30 req/s

### Residual Risk

- Because profile setup currently depends on search-derived profile fields, non-admin search still returns mapped profile data needed for onboarding.
- This is safer than returning full raw rows, but not full least-privilege yet.
- Next secure step (without breaking UX): return minimal search list + fetch full profile only after explicit selection in a protected follow-up call.

## Misuse-Focused Round (Bored User Scenarios)

### Coverage Added

- New route misuse tests:
  - `src/app/api/check-id/__tests__/route.test.js`
  - `src/app/api/soldiers/check-id/__tests__/route.test.js`
  - `src/app/api/send-feedback/__tests__/route.test.js`
  - `src/app/api/reception/status/__tests__/route.test.js`
  - `src/app/api/soldiers/archive/__tests__/route.test.js`
  - `src/app/api/admin/sync-from-sheets/__tests__/route.test.js`
- Extended existing route tests:
  - `src/app/api/sync-to-sheet/__tests__/route.test.js`
  - `src/app/api/proxy-image/__tests__/route.test.js`
- Rapid-action service edge tests:
  - `src/lib/__tests__/receptionSync.test.js`

### Validation Result

- Test suite after misuse round: 18 files, 109 tests, all passing.
- Targeted abuse probes on localhost:
  - Unauthorized webhook update attempt -> `401`.
  - Repeated webhook abuse attempt -> `429`.
  - Proxy request to non-allowlisted host -> `403`.

### Highest-Likelihood Misuse Risks (Practical)

1. Room status misuse via authenticated room updates  
   - Route: `src/app/api/sync-to-sheet/route.js`
   - Why it matters: an authenticated user can request updates for arbitrary room numbers (current behavior does not bind room to caller identity).
   - Priority: high for misuse prevention.

2. ID probing through check endpoints  
   - Routes: `src/app/api/check-id/route.js`, `src/app/api/soldiers/check-id/route.js`
   - Why it matters: repeated checks can still be used to probe claim state, though rate limiting helps.
   - Priority: medium.

3. Reception status probing by room number  
   - Route: `src/app/api/reception/status/route.js`
   - Why it matters: authenticated user can query many rooms and infer occupancy status patterns.
   - Priority: medium.

### Recommended Next Mitigations (Balanced UX)

1. Bind `sync-to-sheet` room updates to owner room (except admins).
2. Add stricter per-UID + per-IP limits on `check-id` and reception status lookup.
3. Consider reducing detail in reception status responses for non-admin paths.
4. Add basic server-side input size caps for feedback payload to reduce spam/noise overhead.

## Full Misuse Fix Round

### Implemented in this round

- Enforced room ownership in reception/sync APIs:
  - `src/app/api/sync-to-sheet/route.js`
  - `src/app/api/reception/status/route.js`
  - Non-admin users are restricted to their own `roomNumber`; admins can access any room.
- Tightened abuse controls:
  - Added/updated rate-limit keys with UID + client IP context on noisy endpoints.
  - Added payload bounds to `send-feedback` (subject/body length, screenshot count/URL filtering).
- Kept search flow compatible but safer:
  - `src/app/api/soldiers/search/route.js` now uses explicit allowlisted output fields (no accidental broad row pass-through).
- Reduced duplicate-action risk in UI:
  - `src/app/profile-setup/page.js` loading-state lock fix for unauthenticated save attempt.
  - `src/app/home/page.js` rapid-click guards for status update and event response.
  - `src/app/admin/expenses/page.js` in-flight guard for refund approval/status modal actions.

### Test coverage added/adjusted

- Ownership/rate-limit behavior:
  - `src/app/api/reception/status/__tests__/route.test.js`
  - `src/app/api/sync-to-sheet/__tests__/route.test.js`
- Abuse controls and bounds:
  - `src/app/api/send-feedback/__tests__/route.test.js`
  - `src/app/api/check-id/__tests__/route.test.js`
  - `src/app/api/soldiers/check-id/__tests__/route.test.js`
  - `src/app/api/soldiers/search/__tests__/route.test.js`

### Verification

- Full test suite after full fix round: 18 files, 115 tests, all passing.
- No linter errors introduced in changed files.

### Residual risk (non-critical)

- Event RSVP updates on `home/page.js` still use read-modify-write arrays, so simultaneous multi-device responses may race in rare cases.
- For stronger consistency later, move event response writes to atomic server-side mutation patterns.

