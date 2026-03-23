/**
 * Google Apps Script — Archived (Left) Soldiers
 *
 * Deploy as a Web App (Execute as: Me, Who has access: Anyone).
 *
 * SCRIPT PROPERTIES (Project Settings > Script Properties):
 *   SPREADSHEET_ID — 1L3lHmJiN3Z_9_FgCpK1zRQX5S2v6j85Fesg0H29-zZU
 *   SHEETS_BRIDGE_SECRET — shared secret from app server env
 *
 * SPREADSHEET: ArchivedSoldiers
 * TAB: Data
 */

var DATA_TAB = 'Data';

var COLUMNS = [
  'שם פרטי',
  'שם משפחה',
  'שם מלא                                  (מילוי אוטומטי: לא לגעת)',
  'מספר זהות',
  'סוג תעודה',
  'מגדר',
  'תאריך לידה',
  'גיל',
  'ארץ מוצא',
  'מספר סלולרי',
  'כתובת מייל חייל',
  'חדר',
  'קומה',
  'תאריך כניסה לבית (חתימת החוזה)',
  'השכלה',
  'רישיון',
  'משפחה בארץ',
  'שם האב',
  'טלפון האב',
  'שם האם',
  'טלפון האם',
  'מצב ההורים',
  'כתובת מגורים הורים',
  'כתובת מייל הורים',
  'קשר עם ההורים',
  'שם איש קשר בארץ',
  'מספר טלפון איש קשר בארץ',
  'כתובת מגורים איש קשר בארץ',
  'כתובת מייל איש קשר בארץ',
  'מספר אישי',
  'תאריך גיוס',
  'תאריך שחרור סדיר ',
  'יחידה',
  'גדוד',
  'שם משקית תש',
  'טלפון משקית תש',
  'שם קצין',
  'טלפון קצין',
  'עברות משמעת',
  'תאריך שחרור משוקלל',
  'קופת חולים לפני הצבא',
  'רמת ניקיון',
  'תאריך עזיבה',
  'תאריך ייצוא'
];

// ─── Helpers ─────────────────────────────────────────────────────────

function getSpreadsheet() {
  var id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('SPREADSHEET_ID script property is not set');
  return SpreadsheetApp.openById(id);
}

function getBridgeSecret() {
  return PropertiesService.getScriptProperties().getProperty('SHEETS_BRIDGE_SECRET');
}

function requestSecret(e, payload) {
  var fromQuery = e && e.parameter ? e.parameter.secret : '';
  if (fromQuery) return String(fromQuery);
  var fromPayload = payload && payload.secret ? payload.secret : '';
  return String(fromPayload || '');
}

function authorizeBridgeCall(e, payload) {
  var expected = String(getBridgeSecret() || '');
  if (!expected) return { ok: false, response: jsonResponse({ success: false, error: 'Bridge secret not configured' }) };
  if (requestSecret(e, payload) !== expected) {
    return { ok: false, response: jsonResponse({ success: false, error: 'Unauthorized' }) };
  }
  return { ok: true };
}

function getOrCreateTab(ss) {
  var sheet = ss.getSheetByName(DATA_TAB);
  if (!sheet) {
    sheet = ss.insertSheet(DATA_TAB);
    sheet.getRange(1, 1, 1, COLUMNS.length).setValues([COLUMNS]);
  }
  return sheet;
}

function ensureHeaders(sheet) {
  var firstRow = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];
  var isEmpty = firstRow.every(function(c) { return !c; });
  if (isEmpty) {
    sheet.getRange(1, 1, 1, COLUMNS.length).setValues([COLUMNS]);
  }
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ─── Web App entry points ────────────────────────────────────────────

function doGet(e) {
  try {
    var auth = authorizeBridgeCall(e, null);
    if (!auth.ok) return auth.response;

    var action = e.parameter.action;
    if (action === 'archiveSoldier') {
      var data = JSON.parse(e.parameter.data || '{}');
      return handleArchiveSoldier(data);
    }
    return jsonResponse({ success: false, error: 'Unknown action: ' + action });
  } catch (err) {
    console.error('doGet error:', err);
    return jsonResponse({ success: false, error: err.toString() });
  }
}

function doPost(e) {
  try {
    var raw = e.postData.contents || e.postData.getDataAsString();
    var payload = JSON.parse(raw);
    var auth = authorizeBridgeCall(e, payload);
    if (!auth.ok) return auth.response;

    if (payload.action === 'archiveSoldier') {
      return handleArchiveSoldier(payload.data);
    }
    return jsonResponse({ success: false, error: 'Unknown action: ' + payload.action });
  } catch (err) {
    console.error('doPost error:', err);
    return jsonResponse({ success: false, error: err.toString() });
  }
}

// ─── Archive handler ─────────────────────────────────────────────────

function handleArchiveSoldier(data) {
  if (!data || Object.keys(data).length === 0) {
    return jsonResponse({ success: false, error: 'No data provided' });
  }

  var ss = getSpreadsheet();
  var sheet = getOrCreateTab(ss);
  ensureHeaders(sheet);

  var row = COLUMNS.map(function(col) {
    var val = data[col];
    return (val != null && val !== undefined) ? val : '';
  });

  var nextRow = sheet.getLastRow() + 1;
  var range = sheet.getRange(nextRow, 1, 1, row.length);
  range.setNumberFormat('@');
  range.setValues([row]);

  return jsonResponse({
    success: true,
    message: 'Soldier archived successfully',
    row: nextRow
  });
}
