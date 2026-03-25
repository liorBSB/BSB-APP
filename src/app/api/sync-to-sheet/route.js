import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/serverAuth';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { fetchReceptionRows, updateReceptionStatusById } from '@/lib/serverSheetsBridge';
import {
  takeRateLimit,
  applyRateLimitHeaders,
  resolveRateLimitClientId,
} from '@/lib/rateLimit';

const VALID_STATUSES = ['Home', 'Out', 'In base', 'Abroad'];

export async function POST(request) {
  try {
    const authResult = await requireAuth(request);
    if (!authResult.ok) {
      return NextResponse.json({ success: false, message: authResult.error }, { status: authResult.status });
    }
    const limiterResult = takeRateLimit({
      key: `sync-to-sheet:${authResult.uid}:${resolveRateLimitClientId(request)}`,
      limit: 40,
      windowMs: 60 * 1000,
    });
    if (!limiterResult.allowed) {
      const limited = NextResponse.json({ success: false, message: 'Too many requests' }, { status: 429 });
      return applyRateLimitHeaders(limited, limiterResult);
    }
    const respond = (payload, status = 200) =>
      applyRateLimitHeaders(NextResponse.json(payload, { status }), limiterResult);

    const { roomNumber, newStatus } = await request.json();
    const requestedRoom = String(roomNumber || '').trim();

    if (!requestedRoom) {
      return respond({ success: false, message: 'No room number' }, 400);
    }
    if (!VALID_STATUSES.includes(newStatus)) {
      return respond({ success: false, message: 'Invalid status' }, 400);
    }

    const userDoc = await getAdminDb().collection('users').doc(authResult.uid).get();
    const userData = userDoc.exists ? userDoc.data() : {};
    const isAdmin = userData?.userType === 'admin';
    const ownRoom = String(userData?.roomNumber || '').trim();
    if (!isAdmin && ownRoom !== requestedRoom) {
      return respond({ success: false, message: 'Forbidden room access' }, 403);
    }

    const soldiers = await fetchReceptionRows();
    const match = soldiers.find(
      (s) => String(s.room || '').trim() === requestedRoom
    );

    if (!match) {
      return respond({ success: false, message: `Room ${requestedRoom} not found in reception sheet` }, 404);
    }

    if (!match.id) {
      return respond({ success: false, message: `Row for room ${requestedRoom} has no id` }, 422);
    }

    await updateReceptionStatusById(match.id, newStatus);
    return respond({ success: true });
  } catch (err) {
    console.error('[sync-to-sheet] Failed:', err.message);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
