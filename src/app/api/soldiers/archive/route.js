import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/serverAuth';
import { archiveSoldierToSheet } from '@/lib/serverSheetsBridge';
import {
  getSyncRequestId,
  logSyncStep,
  toBridgeError,
  toErrorPayload,
} from '@/lib/sheetsSyncRuntime';
import {
  readIdempotencyKey,
  getIdempotentResult,
  getInFlightPromise,
  setInFlightPromise,
  clearInFlightPromise,
  storeIdempotentResult,
} from '@/lib/idempotencyStore';

export async function POST(request) {
  const requestId = getSyncRequestId('soldier-archive');
  const startedAt = Date.now();
  const idempotencyKey = readIdempotencyKey(request);
  try {
    if (idempotencyKey) {
      const cached = getIdempotentResult('soldiers-archive', idempotencyKey);
      if (cached) return NextResponse.json(cached.body, { status: cached.status });
      const inFlight = getInFlightPromise('soldiers-archive', idempotencyKey);
      if (inFlight) {
        const replayed = await inFlight;
        return NextResponse.json(replayed.body, { status: replayed.status });
      }
    }

    const authResult = await requireAdmin(request);
    if (!authResult.ok) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { exportData } = await request.json();
    if (!exportData || typeof exportData !== 'object') {
      return NextResponse.json({ error: 'Missing exportData' }, { status: 400 });
    }

    const execution = archiveSoldierToSheet(exportData, { requestId, idempotencyKey });
    if (idempotencyKey) setInFlightPromise('soldiers-archive', idempotencyKey, execution);
    const result = await execution;
    logSyncStep({
      requestId,
      route: 'soldiers-archive',
      step: 'request.done',
      details: { durationMs: Date.now() - startedAt },
    });
    if (idempotencyKey) {
      storeIdempotentResult('soldiers-archive', idempotencyKey, 200, result);
      clearInFlightPromise('soldiers-archive', idempotencyKey);
    }
    return NextResponse.json(result);
  } catch (error) {
    const bridgeError = toBridgeError(error, { message: 'Archive export failed' });
    const payload = toErrorPayload(bridgeError, 'Archive export failed');
    logSyncStep({
      requestId,
      route: 'soldiers-archive',
      step: 'request.error',
      status: 'error',
      details: { durationMs: Date.now() - startedAt, ...payload },
    });
    if (idempotencyKey) {
      clearInFlightPromise('soldiers-archive', idempotencyKey);
      storeIdempotentResult('soldiers-archive', idempotencyKey, bridgeError.status || 500, payload);
    }
    return NextResponse.json({ error: payload.message, ...payload }, { status: bridgeError.status || 500 });
  }
}
