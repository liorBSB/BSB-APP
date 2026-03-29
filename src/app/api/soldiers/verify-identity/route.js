import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/serverAuth';
import { searchSoldiersInSheets } from '@/lib/serverSheetsBridge';
import { sheetRowToApp } from '@/lib/sheetFieldMap';
import { takeRateLimit, applyRateLimitHeaders, resolveRateLimitClientId } from '@/lib/rateLimit';

function normalizeForComparison(value) {
  return String(value ?? '')
    .replace(/\D/g, '')
    .trim();
}

export async function POST(request) {
  try {
    const authResult = await requireAuth(request);
    if (!authResult.ok) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const limiterResult = takeRateLimit({
      key: `verify-identity:${authResult.uid}:${resolveRateLimitClientId(request)}`,
      limit: 10,
      windowMs: 60 * 1000,
    });
    if (!limiterResult.allowed) {
      const limited = NextResponse.json({ error: 'Too many attempts' }, { status: 429 });
      return applyRateLimitHeaders(limited, limiterResult);
    }

    const { idNumber, personalNumber } = await request.json();
    if (!idNumber || !personalNumber) {
      return applyRateLimitHeaders(
        NextResponse.json({ error: 'Missing required fields' }, { status: 400 }),
        limiterResult
      );
    }

    const normalizedId = String(idNumber).trim();
    const matches = await searchSoldiersInSheets(normalizedId, {
      requestId: `verify-${authResult.uid}`,
    });

    const target = matches.find((row) => {
      const appData = sheetRowToApp(row);
      return String(appData.idNumber ?? '').trim() === normalizedId;
    });

    if (!target) {
      return applyRateLimitHeaders(
        NextResponse.json({ verified: false }),
        limiterResult
      );
    }

    const appData = sheetRowToApp(target);
    const sheetValue = normalizeForComparison(appData.personalNumber);
    const userValue = normalizeForComparison(personalNumber);

    const verified = sheetValue.length > 0 && sheetValue === userValue;

    return applyRateLimitHeaders(
      NextResponse.json({ verified }),
      limiterResult
    );
  } catch (error) {
    console.error('verify-identity error:', error);
    return NextResponse.json({ error: 'Verification service unavailable' }, { status: 500 });
  }
}
