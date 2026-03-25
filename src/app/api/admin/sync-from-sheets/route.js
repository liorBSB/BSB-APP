import { NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { requireAdmin } from '@/lib/serverAuth';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { fetchAllSoldiersFromSheets } from '@/lib/serverSheetsBridge';
import { PRIMARY_KEY_APP, PRIMARY_KEY_SHEET, sheetRowToApp } from '@/lib/sheetFieldMap';
import {
  getSyncRequestId,
  logSyncStep,
  toBridgeError,
  toErrorPayload,
} from '@/lib/sheetsSyncRuntime';

async function ensureDepartureRequest(db, soldier) {
  const existing = await db
    .collection('departureRequests')
    .where('userId', '==', soldier.id)
    .where('status', '==', 'pending')
    .limit(1)
    .get();

  if (!existing.empty) return false;

  await db.collection('departureRequests').add({
    userId: soldier.id,
    soldierName: soldier.fullName || '',
    idNumber: soldier[PRIMARY_KEY_APP] || '',
    roomNumber: soldier.roomNumber || '',
    detectedAt: Timestamp.now(),
    status: 'pending',
    dismissedUntil: null,
  });
  return true;
}

export async function POST(request) {
  const requestId = getSyncRequestId('sync-from-sheets');
  const startedAt = Date.now();
  try {
    const authResult = await requireAdmin(request);
    if (!authResult.ok) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const db = getAdminDb();
    const sheetSoldiers = await fetchAllSoldiersFromSheets({ requestId });
    const usersSnap = await db.collection('users').where('userType', '==', 'user').get();
    const appSoldiers = usersSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    const appById = new Map(
      appSoldiers.map((soldier) => [String(soldier[PRIMARY_KEY_APP] || '').trim(), soldier]),
    );

    let updated = 0;
    let skipped = 0;
    let unmatchedRows = 0;
    for (const sheetRow of sheetSoldiers) {
      const sheetId = String(sheetRow[PRIMARY_KEY_SHEET] || '').trim();
      if (!sheetId) {
        skipped++;
        continue;
      }

      const match = appById.get(sheetId);
      if (!match) {
        unmatchedRows++;
        continue;
      }

      const mapped = sheetRowToApp(sheetRow);
      const nonEmpty = {};
      let hasChanges = false;
      for (const [key, value] of Object.entries(mapped)) {
        if (value === '' || value === null || value === undefined) continue;
        const appVal = String(match[key] || '').trim();
        const sheetVal = String(value).trim();
        if (appVal !== sheetVal) {
          nonEmpty[key] = value;
          hasChanges = true;
        }
      }

      if (hasChanges) {
        await db.collection('users').doc(match.id).update({
          ...nonEmpty,
          lastSyncFromSheets: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
        updated++;
      } else {
        skipped++;
      }
    }

    const sheetIdSet = new Set(
      sheetSoldiers
        .map((row) => String(row[PRIMARY_KEY_SHEET] || '').trim())
        .filter(Boolean),
    );

    let flagged = 0;
    for (const soldier of appSoldiers) {
      const appId = String(soldier[PRIMARY_KEY_APP] || '').trim();
      if (!appId || sheetIdSet.has(appId)) continue;
      if (await ensureDepartureRequest(db, soldier)) flagged++;
    }

    const payload = { success: true, updated, flagged, skipped, unmatchedRows };
    logSyncStep({
      requestId,
      route: 'admin-sync-from-sheets',
      step: 'request.done',
      details: {
        durationMs: Date.now() - startedAt,
        updated,
        flagged,
        skipped,
        unmatchedRows,
      },
    });
    return NextResponse.json(payload);
  } catch (error) {
    const bridgeError = toBridgeError(error, { message: 'Sync from sheets failed' });
    const payload = { success: false, ...toErrorPayload(bridgeError, 'Sync from sheets failed') };
    logSyncStep({
      requestId,
      route: 'admin-sync-from-sheets',
      step: 'request.error',
      status: 'error',
      details: { durationMs: Date.now() - startedAt, ...payload },
    });
    return NextResponse.json(payload, { status: bridgeError.status || 500 });
  }
}
