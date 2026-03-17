/**
 * Two-way sync between the app (Firestore) and the Reception Google Sheet.
 *
 * App → Sheet:  syncStatusToReceptionSheet()  — called after every status change.
 * Sheet → App:  handled by the /api/status-webhook endpoint (called by Apps Script).
 *
 * Matching strategy: soldiers are matched by room number (unique per resident).
 */

const RECEPTION_SCRIPT_URL = process.env.NEXT_PUBLIC_RECEPTION_SCRIPT_URL;

const VALID_STATUSES = ['Home', 'Out', 'In base', 'Abroad'];

const LEGACY_STATUS_MAP = {
  home: 'Home',
  away: 'Out',
  'in base': 'In base',
  abroad: 'Abroad',
  left: 'Empty',
};

/**
 * Normalize a status value — maps old lowercase values to the new format.
 * Returns the value as-is if it's already in the new format or unknown.
 */
export function normalizeStatus(status) {
  if (!status) return 'Home';
  return LEGACY_STATUS_MAP[status] || status;
}

/**
 * Fetch the current status for a room from the reception sheet.
 * Used during profile setup to initialize a new soldier with the correct status.
 * Returns a valid status string, or 'Home' as fallback.
 */
export async function fetchStatusFromSheet(roomNumber) {
  try {
    if (!RECEPTION_SCRIPT_URL || !roomNumber) return 'Home';

    const res = await fetch(`${RECEPTION_SCRIPT_URL}?t=${Date.now()}`);
    if (!res.ok) return 'Home';

    const soldiers = await res.json();
    const match = soldiers.find(
      (s) => String(s.room || '').trim() === String(roomNumber).trim()
    );

    if (!match || !match.status || match.status === 'Empty') return 'Home';
    return VALID_STATUSES.includes(match.status) ? match.status : 'Home';
  } catch {
    return 'Home';
  }
}

/**
 * Sync a status change from the app to the reception Google Sheet.
 * Routes through /api/sync-to-sheet to avoid browser CORS issues with Apps Script.
 * Fire-and-forget — Firestore is the primary write; this is best-effort.
 */
export async function syncStatusToReceptionSheet(roomNumber, newStatus) {
  try {
    if (!roomNumber) {
      console.warn('[ReceptionSync] No room number provided');
      return { success: false, message: 'No room number' };
    }

    if (!VALID_STATUSES.includes(newStatus)) {
      console.warn('[ReceptionSync] Invalid status:', newStatus);
      return { success: false, message: 'Invalid status' };
    }

    const res = await fetch('/api/sync-to-sheet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomNumber, newStatus }),
    });

    const result = await res.json();
    if (result.success) {
      console.log('[ReceptionSync] Synced status for room', roomNumber, '→', newStatus);
    } else {
      console.warn('[ReceptionSync]', result.message);
    }
    return result;
  } catch (err) {
    console.error('[ReceptionSync] Failed:', err.message);
    return { success: false, message: err.message };
  }
}
