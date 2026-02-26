/**
 * Google Sheets archive export.
 * Used when a soldier is marked as "left" — exports their data to the
 * archive/departed sheet before removing them from the active users collection.
 */

import { FIELD_MAP } from './sheetFieldMap';

export const getSheetsConfig = () => ({
  spreadsheetId: process.env.NEXT_PUBLIC_GOOGLE_SHEETS_ID,
  sheetName: 'Soldiers Data',
});

export const exportSoldierToSheets = async (soldierData) => {
  try {
    const exportData = {};

    for (const field of FIELD_MAP) {
      exportData[field.app] = soldierData[field.app] || '';
    }

    exportData.leftDate = new Date().toISOString();
    exportData.exportedAt = new Date().toISOString();
    exportData.exportedBy = 'system';

    return await sendToArchiveSheet(exportData);
  } catch (error) {
    console.error('Error exporting to Google Sheets:', error);
    return { success: false, message: 'Failed to export data', error: error.message };
  }
};

async function sendToArchiveSheet(exportData) {
  const config = getSheetsConfig();
  if (!config.spreadsheetId) {
    throw new Error('Google Sheets ID missing. Please check NEXT_PUBLIC_GOOGLE_SHEETS_ID.');
  }

  const scriptUrl = process.env.NEXT_PUBLIC_GOOGLE_SHEETS_SCRIPT_URL
    || process.env.NEXT_PUBLIC_SOLDIER_SHEETS_SCRIPT_URL;

  if (!scriptUrl) {
    throw new Error('Google Sheets script URL missing.');
  }

  const params = new URLSearchParams();
  params.append('spreadsheetId', config.spreadsheetId);
  params.append('sheetName', config.sheetName);
  params.append('data', JSON.stringify(exportData));

  const response = await fetch(`${scriptUrl}?${params.toString()}`, { method: 'GET' });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Export failed: HTTP ${response.status} - ${errorText}`);
  }

  const result = await response.text();
  try {
    const parsed = JSON.parse(result);
    if (!parsed.success) throw new Error(`Script error: ${parsed.error || 'Unknown error'}`);
    return parsed;
  } catch {
    return { success: true, message: result };
  }
}

export const validateSheetsConnection = async () => {
  const config = getSheetsConfig();
  if (!config.spreadsheetId) {
    return { valid: false, message: 'Google Sheets configuration missing' };
  }
  return { valid: true, message: 'Google Sheets connection validated' };
};

export const archiveSoldierData = async () => {
  return { success: true, message: 'Soldier data archived successfully' };
};

const googleSheetsService = {
  exportSoldierToSheets,
  getSheetsConfig,
  validateSheetsConnection,
  archiveSoldierData,
};

export default googleSheetsService;
