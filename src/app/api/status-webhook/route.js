import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';
import {
  takeRateLimit,
  resolveRateLimitClientId,
  applyRateLimitHeaders,
} from '@/lib/rateLimit';
import { verifyStatusWebhookAuth } from '@/lib/webhookSecurity';

const VALID_STATUSES = ['Home', 'Out', 'In base', 'Abroad', 'Empty'];

export async function POST(request) {
  try {
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
    await userDoc.ref.update({
      status,
      updatedAt: new Date().toISOString(),
    });

    return respond({
      success: true,
      message: `Status updated to ${status} for room ${roomTrimmed}`,
    });
  } catch (error) {
    console.error('[status-webhook] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
