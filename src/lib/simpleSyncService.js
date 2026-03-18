/**
 * Two-way sync between the app (Firestore) and the Google Sheets copy.
 *
 * App → Sheets:  syncToSheets()  — called after every Firestore write.
 * Sheets → App:  syncFromSheets() — called on a client-side interval (every 5 min).
 */

import {
  collection,
  doc,
  updateDoc,
  getDocs,
  getDoc,
  query,
  where,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { COLLECTIONS, createDepartureRequest } from './database';
import {
  FIELD_MAP,
  PRIMARY_KEY_SHEET,
  PRIMARY_KEY_APP,
  sheetRowToApp,
  appToSheetRow,
} from './sheetFieldMap';

const SYNC_CONFIG = {
  scriptUrl: process.env.NEXT_PUBLIC_SOLDIER_SHEETS_SCRIPT_URL,
  syncInterval: 5 * 60 * 1000,
  writeToSheetsEnabled: false, // set to true to re-enable app → sheet writes
};

// ── App → Sheets ─────────────────────────────────────────────────────

export const syncToSheets = async (userId, soldierData) => {
  try {
    if (!SYNC_CONFIG.writeToSheetsEnabled) {
      return { success: true, message: 'App→Sheet writes disabled (master wins)' };
    }

    if (!SYNC_CONFIG.scriptUrl) {
      console.warn('[syncToSheets] No script URL configured');
      return { success: false, message: 'Not configured' };
    }

    const userRef = doc(db, COLLECTIONS.USERS, userId);
    const userSnap = await getDoc(userRef);
    const currentData = userSnap.exists() ? userSnap.data() : {};

    const idNumber = soldierData[PRIMARY_KEY_APP]
      || currentData[PRIMARY_KEY_APP]
      || currentData.personalNumber
      || '';

    console.log('[syncToSheets] userId:', userId, '| idNumber:', idNumber || '(MISSING)');

    if (!idNumber) {
      console.warn('[syncToSheets] No ID number found in soldierData or Firestore doc');
      return { success: false, message: 'No ID number — cannot match to sheet row' };
    }

    const sheetPayload = appToSheetRow({ ...currentData, ...soldierData });
    sheetPayload[PRIMARY_KEY_SHEET] = idNumber;

    console.log('[syncToSheets] Payload keys:', Object.keys(sheetPayload).join(', '));

    const url = `${SYNC_CONFIG.scriptUrl}?action=updateSoldierData&data=${encodeURIComponent(JSON.stringify(sheetPayload))}`;
    console.log('[syncToSheets] URL length:', url.length);

    const response = await fetch(url);
    const text = await response.text();
    console.log('[syncToSheets] Response status:', response.status, '| body:', text.substring(0, 500));

    if (!response.ok) throw new Error(`HTTP ${response.status}: ${text}`);

    let result;
    try {
      result = JSON.parse(text);
    } catch {
      throw new Error(`Invalid JSON response: ${text.substring(0, 200)}`);
    }

    if (!result.success) throw new Error(result.error || result.message || 'Unknown error');

    console.log('[syncToSheets] Success:', result.message, '| fields:', result.updatedFields);
    return { success: true, message: result.message };
  } catch (error) {
    console.error('[syncToSheets] FAILED:', error.message);
    return { success: false, message: error.message };
  }
};

// ── Sheets → App ─────────────────────────────────────────────────────

export const syncFromSheets = async () => {
  try {
    if (!SYNC_CONFIG.scriptUrl) {
      return { success: false, message: 'Not configured' };
    }

    const url = `${SYNC_CONFIG.scriptUrl}?action=getAllSoldiers`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const result = await response.json();
    if (!result.success) throw new Error(result.error);

    const sheetSoldiers = result.soldiers || [];

    const usersQuery = query(
      collection(db, COLLECTIONS.USERS),
      where('userType', '==', 'user'),
    );
    const usersSnap = await getDocs(usersQuery);
    const appSoldiers = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    let updatedCount = 0;

    for (const sheetRow of sheetSoldiers) {
      try {
        const sheetId = String(sheetRow[PRIMARY_KEY_SHEET] || '').trim();
        if (!sheetId) continue;

        const match = appSoldiers.find(s =>
          String(s[PRIMARY_KEY_APP] || '').trim() === sheetId,
        );
        if (!match) continue;

        const mapped = sheetRowToApp(sheetRow);

        const hasChanges = Object.keys(mapped).some(key => {
          const appVal = String(match[key] || '').trim();
          const sheetVal = String(mapped[key] || '').trim();
          return sheetVal !== '' && appVal !== sheetVal;
        });

        if (hasChanges) {
          const nonEmpty = {};
          for (const [k, v] of Object.entries(mapped)) {
            if (v !== '' && v !== null && v !== undefined) nonEmpty[k] = v;
          }

          const userRef = doc(db, COLLECTIONS.USERS, match.id);
          await updateDoc(userRef, {
            ...nonEmpty,
            lastSyncFromSheets: Timestamp.now(),
            updatedAt: Timestamp.now(),
          });
          updatedCount++;
        }
      } catch (err) {
        console.error('Error syncing soldier from sheets:', err);
      }
    }

    // Flag soldiers in Firestore but missing from the sheet as potential departures.
    // No auto-removal — admins review and approve each one.
    const sheetIdSet = new Set(
      sheetSoldiers
        .map(row => String(row[PRIMARY_KEY_SHEET] || '').trim())
        .filter(Boolean),
    );

    let flaggedCount = 0;
    for (const soldier of appSoldiers) {
      const appId = String(soldier[PRIMARY_KEY_APP] || '').trim();
      if (!appId) continue;
      if (sheetIdSet.has(appId)) continue;

      try {
        await createDepartureRequest({
          userId: soldier.id,
          soldierName: soldier.fullName || '',
          idNumber: appId,
          roomNumber: soldier.roomNumber || '',
        });
        flaggedCount++;
      } catch (err) {
        console.error('[syncFromSheets] Error creating departure request:', err);
      }
    }

    return { success: true, updated: updatedCount, flagged: flaggedCount };
  } catch (error) {
    return { success: false, message: error.message };
  }
};

// ── Scheduler ────────────────────────────────────────────────────────

class SimpleScheduler {
  constructor() {
    this.intervalId = null;
    this.isRunning = false;
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;

    setTimeout(() => this.performSync(), 10000);
    this.intervalId = setInterval(() => this.performSync(), SYNC_CONFIG.syncInterval);
  }

  stop() {
    if (!this.isRunning) return;
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  async performSync() {
    if (!SYNC_CONFIG.scriptUrl) return;
    await syncFromSheets();
  }
}

const simpleScheduler = new SimpleScheduler();

if (typeof window !== 'undefined') {
  setTimeout(() => {
    if (SYNC_CONFIG.scriptUrl) {
      simpleScheduler.start();
    }
  }, 3000);
}

export { simpleScheduler };

const simpleSyncServiceExports = {
  syncToSheets,
  syncFromSheets,
  simpleScheduler,
};

export default simpleSyncServiceExports;
