import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/serverAuth';
import { searchSoldiersInSheets } from '@/lib/serverSheetsBridge';
import { sheetRowToApp, FIELD_MAP } from '@/lib/sheetFieldMap';
import { takeRateLimit, applyRateLimitHeaders, resolveRateLimitClientId } from '@/lib/rateLimit';
import {
  getSyncRequestId,
  logSyncStep,
  toBridgeError,
  toErrorPayload,
} from '@/lib/sheetsSyncRuntime';

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
  const requestId = getSyncRequestId('soldier-search');
  const startedAt = Date.now();
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

    const matches = await searchSoldiersInSheets(normalized, { requestId });
    logSyncStep({
      requestId,
      route: 'soldiers-search',
      step: 'request.done',
      details: { durationMs: Date.now() - startedAt, matches: matches.length },
    });
    const response = NextResponse.json({
      soldiers: matches.slice(0, 20).map(toSafeSearchResult),
    });
    return applyRateLimitHeaders(response, limiterResult);
  } catch (error) {
    const bridgeError = toBridgeError(error, { message: 'Search failed' });
    const payload = toErrorPayload(bridgeError, 'Search failed');
    logSyncStep({
      requestId,
      route: 'soldiers-search',
      step: 'request.error',
      status: 'error',
      details: { durationMs: Date.now() - startedAt, ...payload },
    });
    return NextResponse.json({ error: payload.message, ...payload }, { status: bridgeError.status || 500 });
  }
}
