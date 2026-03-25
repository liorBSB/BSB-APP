import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/serverAuth';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { fetchReceptionRows } from '@/lib/serverSheetsBridge';
import {
  takeRateLimit,
  applyRateLimitHeaders,
  resolveRateLimitClientId,
} from '@/lib/rateLimit';
import {
  getSyncRequestId,
  logSyncStep,
  toBridgeError,
  toErrorPayload,
} from '@/lib/sheetsSyncRuntime';

const VALID_STATUSES = ['Home', 'Out', 'In base', 'Abroad'];

export async function POST(request) {
  const requestId = getSyncRequestId('reception-status');
  const startedAt = Date.now();
  try {
    logSyncStep({ requestId, route: 'reception-status', step: 'request.start' });
    const authResult = await requireAuth(request);
    if (!authResult.ok) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }
    const limiterResult = takeRateLimit({
      key: `reception-status:${authResult.uid}:${resolveRateLimitClientId(request)}`,
      limit: 60,
      windowMs: 60 * 1000,
    });
    if (!limiterResult.allowed) {
      const limited = NextResponse.json({ error: 'Too many requests' }, { status: 429 });
      return applyRateLimitHeaders(limited, limiterResult);
    }
    const respond = (payload, status = 200) =>
      applyRateLimitHeaders(NextResponse.json(payload, { status }), limiterResult);

    const { roomNumber } = await request.json();
    const room = String(roomNumber || '').trim();
    if (!room) {
      return respond({ status: 'Home' });
    }

    const userDoc = await getAdminDb().collection('users').doc(authResult.uid).get();
    const userData = userDoc.exists ? userDoc.data() : {};
    const isAdmin = userData?.userType === 'admin';
    const ownRoom = String(userData?.roomNumber || '').trim();
    if (!isAdmin && ownRoom !== room) {
      return respond({ error: 'Forbidden room access' }, 403);
    }

    const rows = await fetchReceptionRows({ requestId });
    const match = rows.find((row) => String(row.room || '').trim() === room);
    const status = String(match?.status || '').trim();
    if (!status || status === 'Empty' || !VALID_STATUSES.includes(status)) {
      return respond({ status: 'Home' });
    }
    logSyncStep({
      requestId,
      route: 'reception-status',
      step: 'request.done',
      details: { durationMs: Date.now() - startedAt, found: Boolean(match) },
    });
    return respond({ status });
  } catch (error) {
    const bridgeError = toBridgeError(error, { message: 'Reception status lookup failed' });
    logSyncStep({
      requestId,
      route: 'reception-status',
      step: 'request.error',
      status: 'error',
      details: {
        durationMs: Date.now() - startedAt,
        ...toErrorPayload(bridgeError, 'Reception status lookup failed'),
      },
    });
    return NextResponse.json({ status: 'Home' });
  }
}
