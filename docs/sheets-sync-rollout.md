# Sheets Sync Hardening Rollout

This rollout is designed to be reversible by environment flags only.

## Feature flags and defaults

- `SHEETS_FETCH_TIMEOUT_MS` (default: `8000`)
- `SHEETS_FETCH_RETRIES_ENABLED` (default: `true`)
- `SHEETS_FETCH_RETRIES` (default: `1`)
- `SHEETS_FETCH_RETRY_BASE_MS` (default: `250`)
- `SHEETS_RECEPTION_DIRECT_ROOM_UPDATE_ENABLED` (default: `false`)
- `SHEETS_RECEPTION_ROOM_CACHE_TTL_MS` (default: `60000`)

## Deployment sequence

1. Deploy with defaults and keep `SHEETS_RECEPTION_DIRECT_ROOM_UPDATE_ENABLED=false`.
2. Monitor logs for one day:
   - `sync-to-sheet` error code distribution
   - timeout rate (`UPSTREAM_TIMEOUT`)
   - 502 rate (`UPSTREAM_5XX`, `UPSTREAM_NETWORK`)
3. If stable, increase timeout and/or retries only through env vars.
4. Enable direct room update only after Apps Script confirms support for `action=updateByRoom`.

## Success criteria

- `sync-to-sheet` 504 rate drops materially.
- p95 latency is stable or improved.
- No increase in data mismatch between Firestore status and reception sheet status.
- Admin sync summary (`updated`, `flagged`, `skipped`, `unmatchedRows`) remains consistent with historical behavior.

## Fast rollback

- Set `SHEETS_FETCH_RETRIES_ENABLED=false`.
- Set `SHEETS_FETCH_RETRIES=0`.
- Set `SHEETS_RECEPTION_DIRECT_ROOM_UPDATE_ENABLED=false`.
- Increase `SHEETS_FETCH_TIMEOUT_MS` temporarily if upstream is slow.
