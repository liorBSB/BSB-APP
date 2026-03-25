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
      key: `soldiers-check-id:${authResult.uid}:${resolveRateLimitClientId(request)}`,
      limit: 30,
      windowMs: 60 * 1000,
    });
    if (!limiterResult.allowed) {
      const limited = NextResponse.json({ error: 'Too many requests' }, { status: 429 });
      return applyRateLimitHeaders(limited, limiterResult);
    }

    const { idNumber } = await request.json();
    if (!idNumber) {
      return NextResponse.json({ error: 'Missing idNumber' }, { status: 400 });
    }

    const normalized = String(idNumber).trim();
    const snapshot = await getAdminDb()
      .collection('users')
      .where('idNumber', '==', normalized)
      .get();

    const taken = snapshot.docs.some((doc) => doc.id !== authResult.uid);
    return applyRateLimitHeaders(NextResponse.json({ taken }), limiterResult);
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
