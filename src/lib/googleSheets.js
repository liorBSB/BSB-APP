/**
 * Google Sheets archive export.
 * Used when a soldier is marked as "left" — exports their data to the
 * ArchivedSoldiers spreadsheet via a dedicated Apps Script deployment.
 */

import { FIELD_MAP } from './sheetFieldMap';

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
  const scriptUrl = process.env.NEXT_PUBLIC_LEFT_SOLDIERS_SCRIPT_URL;

  if (!scriptUrl) {
    throw new Error('Left soldiers script URL missing. Set NEXT_PUBLIC_LEFT_SOLDIERS_SCRIPT_URL.');
  }

  const response = await fetch(scriptUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action: 'archiveSoldier', data: exportData }),
  });

  const result = await response.text();
  try {
    const parsed = JSON.parse(result);
    if (!parsed.success) throw new Error(`Script error: ${parsed.error || 'Unknown error'}`);
    return parsed;
  } catch {
    if (!response.ok) throw new Error(`Export failed: HTTP ${response.status} - ${result}`);
    return { success: true, message: result };
  }
}
