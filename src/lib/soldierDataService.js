/**
 * Service for reading soldier data from the Google Sheets copy
 * via the deployed Apps Script web app.
 *
 * The script knows which spreadsheet and tab to use (configured in Script
 * Properties), so we only need the script URL here.
 */

import { sheetRowToApp, PRIMARY_KEY_APP } from './sheetFieldMap';
import { authedFetch } from '@/lib/authFetch';

export const getAllSoldiers = async () => {
  // Full roster fetch in browser is intentionally disabled.
  return [];
};

// ── Read: search soldiers by name ────────────────────────────────────

export const searchSoldiersByName = async (searchTerm) => {
  if (!searchTerm || searchTerm.length < 2) return [];

  const normalized = searchTerm.replace(/\s+/g, ' ').trim();
  const response = await authedFetch('/api/soldiers/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ searchTerm: normalized }),
  });
  if (!response.ok) throw new Error(`Failed to search soldiers: ${response.status}`);

  const data = await response.json();
  if (data.error) throw new Error(data.error || 'Search failed');
  if (Array.isArray(data.soldiers)) {
    return data.soldiers;
  }

  return [];
};

// ── Map a raw sheet row to app format ────────────────────────────────

export const mapSoldierData = (sheetData) => {
  if (!sheetData) return null;
  if (
    sheetData.fullName !== undefined ||
    sheetData.firstName !== undefined ||
    sheetData.idNumber !== undefined
  ) {
    return sheetData;
  }
  return sheetRowToApp(sheetData);
};

// ── Validate required fields ─────────────────────────────────────────

export const validateSoldierData = (soldierData) => {
  const errors = [];
  if (!soldierData.fullName || soldierData.fullName.trim() === '') {
    errors.push('Full name is required');
  }
  if (!soldierData[PRIMARY_KEY_APP]) {
    errors.push('ID number is required');
  }
  return { isValid: errors.length === 0, errors };
};

// ── Simple in-memory cache ───────────────────────────────────────────

let soldiersCache = null;
let cacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000;

export const getSoldiersWithCache = async (forceRefresh = false) => {
  const now = Date.now();
  if (!forceRefresh && soldiersCache && cacheTimestamp && (now - cacheTimestamp) < CACHE_DURATION) {
    return soldiersCache;
  }
  try {
    const soldiers = await getAllSoldiers();
    soldiersCache = soldiers;
    cacheTimestamp = now;
    return soldiers;
  } catch {
    return soldiersCache || [];
  }
};

export const clearSoldiersCache = () => {
  soldiersCache = null;
  cacheTimestamp = null;
};

const soldierDataServiceExports = {
  getAllSoldiers,
  searchSoldiersByName,
  mapSoldierData,
  validateSoldierData,
  getSoldiersWithCache,
  clearSoldiersCache,
};

export default soldierDataServiceExports;
