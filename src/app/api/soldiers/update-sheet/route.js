import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { requireOwnerOrAdmin } from '@/lib/serverAuth';
import { appToSheetRow, PRIMARY_KEY_APP, PRIMARY_KEY_SHEET } from '@/lib/sheetFieldMap';
import { updateSoldierInSheets } from '@/lib/serverSheetsBridge';
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
  const requestId = getSyncRequestId('soldier-update');
  const startedAt = Date.now();
  const idempotencyKey = readIdempotencyKey(request);
  try {
    if (idempotencyKey) {
      const cached = getIdempotentResult('soldiers-update-sheet', idempotencyKey);
      if (cached) return NextResponse.json(cached.body, { status: cached.status });
      const inFlight = getInFlightPromise('soldiers-update-sheet', idempotencyKey);
      if (inFlight) {
        const replayed = await inFlight;
        return NextResponse.json(replayed.body, { status: replayed.status });
      }
    }

    const { userId, updateData } = await request.json();
    if (!userId || !updateData || typeof updateData !== 'object') {
      return NextResponse.json({ error: 'Missing userId or updateData' }, { status: 400 });
    }

    const authResult = await requireOwnerOrAdmin(request, userId);
    if (!authResult.ok) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const userDoc = await getAdminDb().collection('users').doc(userId).get();
    const currentData = userDoc.exists ? userDoc.data() : {};
    const merged = { ...currentData, ...updateData };
    const idNumber = String(
      merged[PRIMARY_KEY_APP] || merged.personalNumber || currentData?.[PRIMARY_KEY_APP] || ''
    ).trim();
    if (!idNumber) {
      return NextResponse.json({ success: false, message: 'No ID number — cannot match to sheet row' });
    }

    const sheetPayload = appToSheetRow(merged);
    sheetPayload[PRIMARY_KEY_SHEET] = idNumber;

    const execution = updateSoldierInSheets(sheetPayload, { requestId, idempotencyKey });
    if (idempotencyKey) setInFlightPromise('soldiers-update-sheet', idempotencyKey, execution);
    const result = await execution;
    const payload = { success: true, message: result.message || 'Synced to sheets' };
    logSyncStep({
      requestId,
      route: 'soldiers-update-sheet',
      step: 'request.done',
      details: { durationMs: Date.now() - startedAt },
    });
    if (idempotencyKey) {
      storeIdempotentResult('soldiers-update-sheet', idempotencyKey, 200, payload);
      clearInFlightPromise('soldiers-update-sheet', idempotencyKey);
    }
    return NextResponse.json(payload);
  } catch (error) {
    const bridgeError = toBridgeError(error, { message: 'Sync to sheets failed' });
    const payload = { success: false, ...toErrorPayload(bridgeError, 'Sync to sheets failed') };
    logSyncStep({
      requestId,
      route: 'soldiers-update-sheet',
      step: 'request.error',
      status: 'error',
      details: { durationMs: Date.now() - startedAt, ...payload },
    });
    if (idempotencyKey) {
      clearInFlightPromise('soldiers-update-sheet', idempotencyKey);
      storeIdempotentResult('soldiers-update-sheet', idempotencyKey, bridgeError.status || 500, payload);
    }
    return NextResponse.json(payload, { status: bridgeError.status || 500 });
  }
}
