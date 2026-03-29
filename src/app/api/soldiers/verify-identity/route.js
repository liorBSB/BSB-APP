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

    const { idNumber, personalNumber, fullName } = await request.json();
    if (!personalNumber || !idNumber) {
      return applyRateLimitHeaders(
        NextResponse.json({ error: 'Missing required fields' }, { status: 400 }),
        limiterResult
      );
    }

    const normalizedId = String(idNumber).trim();

    // Search by name first (the sheets search is optimised for name/text lookup).
    // Fall back to searching by ID if no name was provided.
    const searchTerm = fullName ? String(fullName).trim() : normalizedId;
    const matches = await searchSoldiersInSheets(searchTerm, {
      requestId: `verify-${authResult.uid}`,
    });

    // Always match by idNumber to handle duplicate names.
    const target = matches.find((row) => {
      const appData = sheetRowToApp(row);
      const rowId = String(appData.idNumber ?? '').trim();
      return rowId === normalizedId;
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
