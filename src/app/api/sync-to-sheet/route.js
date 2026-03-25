import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/serverAuth';
import { getAdminDb } from '@/lib/firebaseAdmin';
import {
  fetchReceptionRows,
  updateReceptionStatusById,
  updateReceptionStatusByRoom,
} from '@/lib/serverSheetsBridge';
import {
  takeRateLimit,
  applyRateLimitHeaders,
  resolveRateLimitClientId,
} from '@/lib/rateLimit';
import {
  getSyncConfig,
  getSyncRequestId,
  logSyncStep,
  toBridgeError,
  toErrorPayload,
} from '@/lib/sheetsSyncRuntime';
import {
  readIdempotencyKey,
  getIdempotentResult,
  getInFlightPromise,
  setInFlightPromise,
  clearInFlightPromise,
  storeIdempotentResult,
} from '@/lib/idempotencyStore';

const VALID_STATUSES = ['Home', 'Out', 'In base', 'Abroad'];
const roomIdCache = new Map();

function getCachedRoomId(room) {
  const cached = roomIdCache.get(room);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    roomIdCache.delete(room);
    return null;
  }
  return cached.id;
}

function setCachedRoomId(room, id, ttlMs) {
  roomIdCache.set(room, { id, expiresAt: Date.now() + ttlMs });
}

function normalizeErrorResponse(err) {
  const bridgeError = toBridgeError(err, { message: 'Sync failed' });
  const status =
    bridgeError.code === 'UPSTREAM_TIMEOUT' ? 504
      : bridgeError.code === 'UPSTREAM_5XX' ? 502
        : bridgeError.status || 500;
  return {
    status,
    body: { success: false, ...toErrorPayload(bridgeError, 'Sync failed') },
  };
}

export async function POST(request) {
  const requestId = getSyncRequestId('syncsheet');
  const startedAt = Date.now();
  const idempotencyKey = readIdempotencyKey(request);
  const config = getSyncConfig();

  try {
    logSyncStep({
      requestId,
      route: 'sync-to-sheet',
      step: 'request.start',
      details: { hasIdempotencyKey: Boolean(idempotencyKey) },
    });

    const authResult = await requireAuth(request);
    if (!authResult.ok) {
      return NextResponse.json({ success: false, message: authResult.error }, { status: authResult.status });
    }

    if (idempotencyKey) {
      const cached = getIdempotentResult('sync-to-sheet', idempotencyKey);
      if (cached) {
        logSyncStep({
          requestId,
          route: 'sync-to-sheet',
          step: 'idempotency.hit',
          details: { status: cached.status },
        });
        return NextResponse.json(cached.body, { status: cached.status });
      }
      const inFlight = getInFlightPromise('sync-to-sheet', idempotencyKey);
      if (inFlight) {
        const replayed = await inFlight;
        return NextResponse.json(replayed.body, { status: replayed.status });
      }
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

    const run = async () => {
      const { roomNumber, newStatus } = await request.json();
      const requestedRoom = String(roomNumber || '').trim();

      if (!requestedRoom) {
        return { status: 400, body: { success: false, message: 'No room number' } };
      }
      if (!VALID_STATUSES.includes(newStatus)) {
        return { status: 400, body: { success: false, message: 'Invalid status' } };
      }

      const authStarted = Date.now();
      const userDoc = await getAdminDb().collection('users').doc(authResult.uid).get();
      logSyncStep({
        requestId,
        route: 'sync-to-sheet',
        step: 'load-user',
        details: { durationMs: Date.now() - authStarted },
      });

      const userData = userDoc.exists ? userDoc.data() : {};
      const isAdmin = userData?.userType === 'admin';
      const ownRoom = String(userData?.roomNumber || '').trim();
      if (!isAdmin && ownRoom !== requestedRoom) {
        return { status: 403, body: { success: false, message: 'Forbidden room access' } };
      }

      const bridgeContext = {
        requestId,
        idempotencyKey,
      };

      if (config.enableReceptionDirectUpdate) {
        try {
          const directStarted = Date.now();
          await updateReceptionStatusByRoom(requestedRoom, newStatus, bridgeContext);
          logSyncStep({
            requestId,
            route: 'sync-to-sheet',
            step: 'direct-update-by-room',
            details: { durationMs: Date.now() - directStarted },
          });
          return { status: 200, body: { success: true } };
        } catch (error) {
          const typed = toBridgeError(error, { message: 'Reception update failed' });
          if (typed.code !== 'UPSTREAM_NOT_SUPPORTED') throw typed;
          logSyncStep({
            requestId,
            route: 'sync-to-sheet',
            step: 'direct-update-by-room.fallback',
            details: { reason: typed.code, message: typed.message },
          });
        }
      }

      let rowId = getCachedRoomId(requestedRoom);
      if (!rowId) {
        const fetchStarted = Date.now();
        const soldiers = await fetchReceptionRows(bridgeContext);
        const match = soldiers.find((s) => String(s.room || '').trim() === requestedRoom);
        logSyncStep({
          requestId,
          route: 'sync-to-sheet',
          step: 'fetch-rows-and-match',
          details: { durationMs: Date.now() - fetchStarted, cached: false },
        });
        if (!match) {
          return {
            status: 404,
            body: { success: false, message: `Room ${requestedRoom} not found in reception sheet` },
          };
        }
        if (!match.id) {
          return {
            status: 422,
            body: { success: false, message: `Row for room ${requestedRoom} has no id` },
          };
        }
        rowId = match.id;
        setCachedRoomId(requestedRoom, rowId, config.receptionRoomCacheTtlMs);
      } else {
        logSyncStep({
          requestId,
          route: 'sync-to-sheet',
          step: 'room-id-cache.hit',
          details: { room: requestedRoom },
        });
      }

      const writeStarted = Date.now();
      await updateReceptionStatusById(rowId, newStatus, bridgeContext);
      logSyncStep({
        requestId,
        route: 'sync-to-sheet',
        step: 'update-status-by-id',
        details: { durationMs: Date.now() - writeStarted, room: requestedRoom },
      });
      return { status: 200, body: { success: true } };
    };

    const execution = run();
    if (idempotencyKey) {
      setInFlightPromise('sync-to-sheet', idempotencyKey, execution);
    }
    const result = await execution;
    if (idempotencyKey) {
      storeIdempotentResult('sync-to-sheet', idempotencyKey, result.status, result.body);
      clearInFlightPromise('sync-to-sheet', idempotencyKey);
    }
    logSyncStep({
      requestId,
      route: 'sync-to-sheet',
      step: 'request.done',
      details: { durationMs: Date.now() - startedAt, status: result.status },
    });
    return respond(result.body, result.status);
  } catch (err) {
    const normalized = normalizeErrorResponse(err);
    logSyncStep({
      requestId,
      route: 'sync-to-sheet',
      step: 'request.error',
      status: 'error',
      details: {
        durationMs: Date.now() - startedAt,
        message: normalized.body.message,
        code: normalized.body.code,
      },
    });
    if (idempotencyKey) {
      clearInFlightPromise('sync-to-sheet', idempotencyKey);
      storeIdempotentResult('sync-to-sheet', idempotencyKey, normalized.status, normalized.body);
    }
    return NextResponse.json(normalized.body, { status: normalized.status });
  }
}
