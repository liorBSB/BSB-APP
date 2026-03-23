/**
 * Google Sheets archive export.
 * Used when a soldier is marked as "left" — exports their data to the
 * ArchivedSoldiers spreadsheet via a dedicated Apps Script deployment.
 */

import { FIELD_MAP } from './sheetFieldMap';
import { authedFetch } from '@/lib/authFetch';

export const exportSoldierToSheets = async (soldierData) => {
  try {
    const exportData = {};

    for (const field of FIELD_MAP) {
      exportData[field.sheet] = soldierData[field.app] || '';
    }

    exportData['תאריך עזיבה'] = new Date().toLocaleDateString('he-IL');
    exportData['תאריך ייצוא'] = new Date().toISOString();

    return await sendToArchiveSheet(exportData);
  } catch (error) {
    console.error('Error exporting to Google Sheets:', error);
    return { success: false, message: 'Failed to export data', error: error.message };
  }
};

async function sendToArchiveSheet(exportData) {
  const response = await authedFetch('/api/soldiers/archive', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ exportData }),
  });

  const result = await response.json();
  if (!response.ok || !result.success) {
    throw new Error(result.error || result.message || `Export failed: HTTP ${response.status}`);
  }
  return result;
}
