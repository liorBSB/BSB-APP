import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { requireAuth } from '@/lib/serverAuth';
import { takeRateLimit, applyRateLimitHeaders, resolveRateLimitClientId } from '@/lib/rateLimit';

export async function POST(request) {
  try {
    const authResult = await requireAuth(request);
    if (!authResult.ok) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }
    const limiterResult = takeRateLimit({
      key: `check-id:${authResult.uid}:${resolveRateLimitClientId(request)}`,
      limit: 30,
      windowMs: 60 * 1000,
    });
    if (!limiterResult.allowed) {
      const limited = NextResponse.json({ error: 'Too many requests' }, { status: 429 });
      return applyRateLimitHeaders(limited, limiterResult);
    }

    const { idNumber } = await request.json();
    const uid = authResult.uid;

    if (!idNumber) {
      return NextResponse.json(
        { error: 'Missing idNumber' },
        { status: 400 }
      );
    }

    const normalized = String(idNumber).trim();
    const snapshot = await getAdminDb()
      .collection('users')
      .where('idNumber', '==', normalized)
      .get();

    const claimedByOther = snapshot.docs.some((doc) => doc.id !== uid);

    return applyRateLimitHeaders(NextResponse.json({ taken: claimedByOther }), limiterResult);
  } catch (error) {
    console.error('check-id error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
