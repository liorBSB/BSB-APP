import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/serverAuth';
import { searchSoldiersInSheets } from '@/lib/serverSheetsBridge';
import { sheetRowToApp, FIELD_MAP } from '@/lib/sheetFieldMap';
import { takeRateLimit, applyRateLimitHeaders, resolveRateLimitClientId } from '@/lib/rateLimit';

const ALLOWED_SEARCH_FIELDS = FIELD_MAP.map((field) => field.app);

function toSafeSearchResult(row) {
  const appData = sheetRowToApp(row);
  const idValue = String(appData.idNumber || '').trim();
  const safeData = {};
  for (const fieldName of ALLOWED_SEARCH_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(appData, fieldName)) {
      safeData[fieldName] = appData[fieldName];
    }
  }
  return {
    ...safeData,
    idSuffix: idValue ? idValue.slice(-4) : '',
  };
}

export async function POST(request) {
  try {
    const authResult = await requireAuth(request);
    if (!authResult.ok) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const limiterResult = takeRateLimit({
      key: `soldier-search:${authResult.uid}:${resolveRateLimitClientId(request)}`,
      limit: 60,
      windowMs: 60 * 1000,
    });
    if (!limiterResult.allowed) {
      const limited = NextResponse.json({ error: 'Too many requests' }, { status: 429 });
      return applyRateLimitHeaders(limited, limiterResult);
    }

    const { searchTerm } = await request.json();
    const normalized = String(searchTerm || '').trim();
    if (normalized.length < 2) {
      return applyRateLimitHeaders(NextResponse.json({ soldiers: [] }), limiterResult);
    }

    const matches = await searchSoldiersInSheets(normalized);
    const response = NextResponse.json({
      soldiers: matches.slice(0, 20).map(toSafeSearchResult),
    });
    return applyRateLimitHeaders(response, limiterResult);
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Search failed' }, { status: 500 });
  }
}
