/**
 * Service for reading soldier data from the Google Sheets copy
 * via the deployed Apps Script web app.
 *
 * The script knows which spreadsheet and tab to use (configured in Script
 * Properties), so we only need the script URL here.
 */

import { sheetRowToApp, PRIMARY_KEY_APP } from './sheetFieldMap';

const SCRIPT_URL = process.env.NEXT_PUBLIC_SOLDIER_SHEETS_SCRIPT_URL;

// ── Read: get all soldiers ───────────────────────────────────────────

export const getAllSoldiers = async () => {
  if (!SCRIPT_URL) {
    throw new Error('Google Sheets is not configured. Set NEXT_PUBLIC_SOLDIER_SHEETS_SCRIPT_URL.');
  }

  const response = await fetch(`${SCRIPT_URL}?action=getAllSoldiers`);
  if (!response.ok) throw new Error(`Failed to fetch soldiers: ${response.status}`);

  const data = await response.json();
  if (!data.success) throw new Error(data.error || 'Failed to fetch soldiers');

  return data.soldiers || [];
};

// ── Read: search soldiers by name ────────────────────────────────────

export const searchSoldiersByName = async (searchTerm) => {
  if (!searchTerm || searchTerm.length < 2) return [];
  if (!SCRIPT_URL) throw new Error('Google Sheets is not configured.');

  const normalized = searchTerm.replace(/\s+/g, ' ').trim();
  const response = await fetch(
    `${SCRIPT_URL}?action=searchSoldiers&searchTerm=${encodeURIComponent(normalized)}`,
  );
  if (!response.ok) throw new Error(`Failed to search soldiers: ${response.status}`);

  const data = await response.json();
  if (!data.success) throw new Error(data.error || 'Search failed');

  if (data.soldiers.length === 0 && normalized.includes(' ')) {
    const noSpaces = normalized.replace(/\s/g, '');
    const fbResponse = await fetch(
      `${SCRIPT_URL}?action=searchSoldiers&searchTerm=${encodeURIComponent(noSpaces)}`,
    );
    if (fbResponse.ok) {
      const fbData = await fbResponse.json();
      if (fbData.success && fbData.soldiers.length > 0) return fbData.soldiers;
    }
  }

  return data.soldiers || [];
};

// ── Map a raw sheet row to app format ────────────────────────────────

export const mapSoldierData = (sheetData) => {
  if (!sheetData) return null;
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
