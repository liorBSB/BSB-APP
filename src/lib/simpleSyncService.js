/**
 * Two-way sync between the app (Firestore) and the Google Sheets copy.
 *
 * App → Sheets:  syncToSheets()  — called after every Firestore write.
 * Sheets → App:  syncFromSheets() — called on a client-side interval (every 5 min).
 */

import {
  doc,
  getDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import {
  PRIMARY_KEY_APP,
} from './sheetFieldMap';
import { authedFetch } from '@/lib/authFetch';

const SYNC_CONFIG = {
  syncInterval: 5 * 60 * 1000,
  writeToSheetsEnabled: false, // set to true to re-enable app → sheet writes
};

// ── App → Sheets ─────────────────────────────────────────────────────

export const syncToSheets = async (userId, soldierData) => {
  try {
    if (!SYNC_CONFIG.writeToSheetsEnabled) {
      return { success: true, message: 'App→Sheet writes disabled (master wins)' };
    }

    const userRef = doc(db, 'users', userId);
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

    const response = await authedFetch('/api/soldiers/update-sheet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, updateData: soldierData }),
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.error || result.message || `HTTP ${response.status}`);
    }

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
    const response = await authedFetch('/api/admin/sync-from-sheets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'manual_or_scheduler' }),
    });
    const result = await response.json();
    if (!response.ok) {
      return { success: false, message: result.error || result.message || `HTTP ${response.status}` };
    }
    return result;
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
    await syncFromSheets();
  }
}

const simpleScheduler = new SimpleScheduler();

if (typeof window !== 'undefined') {
  // Intentionally not auto-starting on all clients.
  // Scheduling sync from Sheets must be triggered from trusted admin flows.
}

export { simpleScheduler };

const simpleSyncServiceExports = {
  syncToSheets,
  syncFromSheets,
  simpleScheduler,
};

export default simpleSyncServiceExports;
