import {
  fetchWithPolicy,
  getSyncConfig,
  logSyncStep,
  SheetsBridgeError,
} from '@/lib/sheetsSyncRuntime';

const SOLDIER_SCRIPT_URL = process.env.SOLDIER_SHEETS_SCRIPT_URL;
const RECEPTION_SCRIPT_URL = process.env.RECEPTION_SCRIPT_URL;
const LEFT_SOLDIERS_SCRIPT_URL = process.env.LEFT_SOLDIERS_SCRIPT_URL;
const SHEETS_BRIDGE_SECRET = process.env.SHEETS_BRIDGE_SECRET;

function withBridgeSecret(url) {
  if (!SHEETS_BRIDGE_SECRET) return url;
  const u = new URL(url);
  u.searchParams.set('secret', SHEETS_BRIDGE_SECRET);
  return u.toString();
}

export function ensureBridgeConfig(name, value) {
  if (!value) throw new SheetsBridgeError(`${name} is not configured`, {
    code: 'CONFIG_MISSING',
    retryable: false,
    status: 500,
    operation: 'ensureBridgeConfig',
  });
}

function parseJsonSafe(response, defaultValue = {}) {
  return response.json().catch(() => defaultValue);
}

function getPolicy(context = {}, operation = 'sheets-operation') {
  const config = getSyncConfig();
  return {
    timeoutMs: context.timeoutMs || config.timeoutMs,
    retries: context.retries ?? config.retries,
    retryBaseMs: context.retryBaseMs || config.retryBaseMs,
    enableRetries: context.enableRetries ?? config.enableRetries,
    requestId: context.requestId || '',
    operation,
    allowWriteRetries: context.allowWriteRetries ?? false,
  };
}

export async function fetchAllSoldiersFromSheets(context = {}) {
  const startedAt = Date.now();
  const operation = 'fetchAllSoldiersFromSheets';
  ensureBridgeConfig('SOLDIER_SHEETS_SCRIPT_URL', SOLDIER_SCRIPT_URL);
  const url = withBridgeSecret(`${SOLDIER_SCRIPT_URL}?action=getAllSoldiers`);
  const response = await fetchWithPolicy(url, { cache: 'no-store' }, getPolicy(context, operation));
  const data = await parseJsonSafe(response, {});
  if (!data.success) {
    throw new SheetsBridgeError(data.error || 'Sheets read failed', {
      code: 'UPSTREAM_PAYLOAD_ERROR',
      retryable: false,
      status: 502,
      durationMs: Date.now() - startedAt,
      requestId: context.requestId || '',
      operation,
    });
  }
  logSyncStep({
    requestId: context.requestId,
    route: 'serverSheetsBridge',
    step: operation,
    details: { durationMs: Date.now() - startedAt, rows: (data.soldiers || []).length },
  });
  return data.soldiers || [];
}

export async function searchSoldiersInSheets(searchTerm, context = {}) {
  const startedAt = Date.now();
  const operation = 'searchSoldiersInSheets';
  ensureBridgeConfig('SOLDIER_SHEETS_SCRIPT_URL', SOLDIER_SCRIPT_URL);
  const term = String(searchTerm || '').trim();
  if (term.length < 2) return [];
  const url = withBridgeSecret(
    `${SOLDIER_SCRIPT_URL}?action=searchSoldiers&searchTerm=${encodeURIComponent(term)}`
  );
  const response = await fetchWithPolicy(url, { cache: 'no-store' }, getPolicy(context, operation));
  const data = await parseJsonSafe(response, {});
  if (!data.success) {
    throw new SheetsBridgeError(data.error || 'Sheets search failed', {
      code: 'UPSTREAM_PAYLOAD_ERROR',
      retryable: false,
      status: 502,
      durationMs: Date.now() - startedAt,
      requestId: context.requestId || '',
      operation,
    });
  }
  logSyncStep({
    requestId: context.requestId,
    route: 'serverSheetsBridge',
    step: operation,
    details: { durationMs: Date.now() - startedAt, rows: (data.soldiers || []).length },
  });
  return data.soldiers || [];
}

export async function updateSoldierInSheets(sheetPayload, context = {}) {
  const startedAt = Date.now();
  const operation = 'updateSoldierInSheets';
  ensureBridgeConfig('SOLDIER_SHEETS_SCRIPT_URL', SOLDIER_SCRIPT_URL);
  const body = { action: 'updateSoldierData', data: sheetPayload };
  const url = withBridgeSecret(SOLDIER_SCRIPT_URL);
  const response = await fetchWithPolicy(
    url,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(context.idempotencyKey ? { 'Idempotency-Key': context.idempotencyKey } : {}),
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    },
    getPolicy({ ...context, allowWriteRetries: true }, operation),
  );
  const data = await parseJsonSafe(response, {});
  if (!data.success) {
    throw new SheetsBridgeError(data.error || data.message || 'Sheets update failed', {
      code: 'UPSTREAM_PAYLOAD_ERROR',
      retryable: false,
      status: 502,
      durationMs: Date.now() - startedAt,
      requestId: context.requestId || '',
      operation,
    });
  }
  logSyncStep({
    requestId: context.requestId,
    route: 'serverSheetsBridge',
    step: operation,
    details: { durationMs: Date.now() - startedAt },
  });
  return data;
}

export async function fetchReceptionRows(context = {}) {
  const startedAt = Date.now();
  const operation = 'fetchReceptionRows';
  ensureBridgeConfig('RECEPTION_SCRIPT_URL', RECEPTION_SCRIPT_URL);
  const url = withBridgeSecret(`${RECEPTION_SCRIPT_URL}?t=${Date.now()}`);
  const response = await fetchWithPolicy(url, { cache: 'no-store' }, getPolicy(context, operation));
  const rows = await parseJsonSafe(response, []);
  logSyncStep({
    requestId: context.requestId,
    route: 'serverSheetsBridge',
    step: operation,
    details: { durationMs: Date.now() - startedAt, rows: Array.isArray(rows) ? rows.length : 0 },
  });
  return rows;
}

export async function updateReceptionStatusById(id, status, context = {}) {
  const startedAt = Date.now();
  const operation = 'updateReceptionStatusById';
  ensureBridgeConfig('RECEPTION_SCRIPT_URL', RECEPTION_SCRIPT_URL);
  const url = withBridgeSecret(RECEPTION_SCRIPT_URL);
  const response = await fetchWithPolicy(
    url,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(context.idempotencyKey ? { 'Idempotency-Key': context.idempotencyKey } : {}),
      },
      body: JSON.stringify({ id, status }),
      cache: 'no-store',
    },
    getPolicy({ ...context, allowWriteRetries: true }, operation),
  );
  const data = await parseJsonSafe(response, {});
  if (data.status !== 'success') {
    throw new SheetsBridgeError(data.message || 'Reception update failed', {
      code: 'UPSTREAM_PAYLOAD_ERROR',
      retryable: false,
      status: 502,
      durationMs: Date.now() - startedAt,
      requestId: context.requestId || '',
      operation,
    });
  }
  logSyncStep({
    requestId: context.requestId,
    route: 'serverSheetsBridge',
    step: operation,
    details: { durationMs: Date.now() - startedAt },
  });
  return data;
}

export async function updateReceptionStatusByRoom(room, status, context = {}) {
  const startedAt = Date.now();
  const operation = 'updateReceptionStatusByRoom';
  ensureBridgeConfig('RECEPTION_SCRIPT_URL', RECEPTION_SCRIPT_URL);
  const url = withBridgeSecret(RECEPTION_SCRIPT_URL);
  const response = await fetchWithPolicy(
    url,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(context.idempotencyKey ? { 'Idempotency-Key': context.idempotencyKey } : {}),
      },
      body: JSON.stringify({ action: 'updateByRoom', room, status }),
      cache: 'no-store',
    },
    getPolicy({ ...context, allowWriteRetries: true }, operation),
  );
  const data = await parseJsonSafe(response, {});
  if (data.status !== 'success') {
    throw new SheetsBridgeError(data.message || 'Reception update by room failed', {
      code: data.code === 'NOT_SUPPORTED' ? 'UPSTREAM_NOT_SUPPORTED' : 'UPSTREAM_PAYLOAD_ERROR',
      retryable: false,
      status: 502,
      durationMs: Date.now() - startedAt,
      requestId: context.requestId || '',
      operation,
    });
  }
  logSyncStep({
    requestId: context.requestId,
    route: 'serverSheetsBridge',
    step: operation,
    details: { durationMs: Date.now() - startedAt },
  });
  return data;
}

export async function archiveSoldierToSheet(exportData, context = {}) {
  const startedAt = Date.now();
  const operation = 'archiveSoldierToSheet';
  ensureBridgeConfig('LEFT_SOLDIERS_SCRIPT_URL', LEFT_SOLDIERS_SCRIPT_URL);
  const url = withBridgeSecret(LEFT_SOLDIERS_SCRIPT_URL);
  const response = await fetchWithPolicy(
    url,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
        ...(context.idempotencyKey ? { 'Idempotency-Key': context.idempotencyKey } : {}),
      },
      body: JSON.stringify({ action: 'archiveSoldier', data: exportData }),
      cache: 'no-store',
    },
    getPolicy({ ...context, allowWriteRetries: true }, operation),
  );
  const text = await response.text();
  try {
    const parsed = JSON.parse(text);
    if (!parsed.success) {
      throw new SheetsBridgeError(parsed.error || 'Archive export failed', {
        code: 'UPSTREAM_PAYLOAD_ERROR',
        retryable: false,
        status: 502,
        durationMs: Date.now() - startedAt,
        requestId: context.requestId || '',
        operation,
      });
    }
    logSyncStep({
      requestId: context.requestId,
      route: 'serverSheetsBridge',
      step: operation,
      details: { durationMs: Date.now() - startedAt },
    });
    return parsed;
  } catch (error) {
    if (error instanceof SheetsBridgeError) throw error;
    throw new SheetsBridgeError(error.message || 'Archive export returned invalid response', {
      code: 'UPSTREAM_INVALID_RESPONSE',
      retryable: false,
      status: 502,
      durationMs: Date.now() - startedAt,
      requestId: context.requestId || '',
      operation,
      cause: error,
    });
  }
}
