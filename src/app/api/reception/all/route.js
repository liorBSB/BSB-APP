import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/serverAuth';
import { fetchReceptionRows } from '@/lib/serverSheetsBridge';
import {
  getSyncRequestId,
  logSyncStep,
  toBridgeError,
  toErrorPayload,
} from '@/lib/sheetsSyncRuntime';

export async function GET(request) {
  const requestId = getSyncRequestId('reception-all');
  const startedAt = Date.now();
  try {
    const authResult = await requireAdmin(request);
    if (!authResult.ok) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }
    const rows = await fetchReceptionRows({ requestId });
    logSyncStep({
      requestId,
      route: 'reception-all',
      step: 'request.done',
      details: { durationMs: Date.now() - startedAt, rows: rows.length },
    });
    return NextResponse.json({ rows });
  } catch (error) {
    const bridgeError = toBridgeError(error, { message: 'Failed to fetch reception rows' });
    const payload = toErrorPayload(bridgeError, 'Failed to fetch reception rows');
    logSyncStep({
      requestId,
      route: 'reception-all',
      step: 'request.error',
      status: 'error',
      details: { durationMs: Date.now() - startedAt, ...payload },
    });
    return NextResponse.json({ error: payload.message, ...payload }, { status: bridgeError.status || 500 });
  }
}
