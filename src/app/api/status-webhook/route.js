import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';
import {
  takeRateLimit,
  resolveRateLimitClientId,
  applyRateLimitHeaders,
} from '@/lib/rateLimit';
import { verifyStatusWebhookAuth } from '@/lib/webhookSecurity';
import { getSyncRequestId, logSyncStep } from '@/lib/sheetsSyncRuntime';

const VALID_STATUSES = ['Home', 'Out', 'In base', 'Abroad', 'Empty'];

function parseEventTimestampMs(request) {
  const raw = request.headers.get('x-webhook-timestamp');
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return Date.now();
  return parsed > 1e12 ? parsed : parsed * 1000;
}

function parseStoredUpdatedAtMs(updatedAt) {
  if (!updatedAt) return 0;
  if (typeof updatedAt?.toMillis === 'function') return updatedAt.toMillis();
  const parsed = Date.parse(String(updatedAt));
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function POST(request) {
  const requestId = getSyncRequestId('status-webhook');
  const startedAt = Date.now();
  try {
    logSyncStep({ requestId, route: 'status-webhook', step: 'request.start' });
    const limiterResult = takeRateLimit({
      key: `status-webhook:${resolveRateLimitClientId(request, 'unknown')}`,
      limit: 180,
      windowMs: 60 * 1000,
    });
    if (!limiterResult.allowed) {
      const limited = NextResponse.json({ error: 'Too many requests' }, { status: 429 });
      return applyRateLimitHeaders(limited, limiterResult);
    }

    const respond = (payload, statusCode = 200) =>
      applyRateLimitHeaders(NextResponse.json(payload, { status: statusCode }), limiterResult);

    const rawBody = await request.text();
    const authResult = verifyStatusWebhookAuth(
      request,
      rawBody,
      process.env.STATUS_WEBHOOK_SECRET,
    );
    if (!authResult.ok) {
      return respond({ error: authResult.error }, authResult.status);
    }

    let parsedBody = {};
    try {
      parsedBody = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      return respond({ error: 'Invalid JSON body' }, 400);
    }
    const { room, status } = parsedBody;

    if (!room || !status) {
      return respond({ error: 'Missing room or status' }, 400);
    }

    if (!VALID_STATUSES.includes(status)) {
      return respond({ error: `Invalid status: ${status}` }, 400);
    }

    if (status === 'Empty') {
      return respond({ success: true, message: 'Empty status ignored (sheet-only)' });
    }

    const roomTrimmed = String(room).trim();
    const eventTimestampMs = parseEventTimestampMs(request);
    const snapshot = await getAdminDb()
      .collection('users')
      .where('roomNumber', '==', roomTrimmed)
      .where('userType', '==', 'user')
      .limit(1)
      .get();

    if (snapshot.empty) {
      return respond(
        { success: false, message: `No user found for room ${roomTrimmed}` },
        404
      );
    }

    const userDoc = snapshot.docs[0];
    const current = typeof userDoc.data === 'function' ? userDoc.data() : {};
    const currentUpdatedAtMs = parseStoredUpdatedAtMs(current?.updatedAt);
    if (currentUpdatedAtMs && eventTimestampMs < currentUpdatedAtMs) {
      logSyncStep({
        requestId,
        route: 'status-webhook',
        step: 'request.ignored-stale',
        details: {
          durationMs: Date.now() - startedAt,
          room: roomTrimmed,
          eventTimestampMs,
          currentUpdatedAtMs,
        },
      });
      return respond({
        success: true,
        staleIgnored: true,
        message: `Ignored stale status update for room ${roomTrimmed}`,
      }, 202);
    }

    await userDoc.ref.update({
      status,
      updatedAt: new Date(eventTimestampMs).toISOString(),
    });

    logSyncStep({
      requestId,
      route: 'status-webhook',
      step: 'request.done',
      details: { durationMs: Date.now() - startedAt, room: roomTrimmed, status },
    });
    return respond({
      success: true,
      message: `Status updated to ${status} for room ${roomTrimmed}`,
    });
  } catch (error) {
    logSyncStep({
      requestId,
      route: 'status-webhook',
      step: 'request.error',
      status: 'error',
      details: { durationMs: Date.now() - startedAt, message: error.message || 'Internal server error' },
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
