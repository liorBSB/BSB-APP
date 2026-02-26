/**
 * Google Apps Script — BSB Soldier Data Management v2
 *
 * Deploy as a Web App (Execute as: Me, Who has access: Anyone).
 *
 * SCRIPT PROPERTIES (Project Settings > Script Properties):
 *   COPY_SPREADSHEET_ID   — ID of your copy spreadsheet (the one with 2 tabs)
 *   MASTER_SPREADSHEET_ID — ID of the master/foundation spreadsheet
 *   MASTER_SHEET_NAME     — tab name inside the master spreadsheet
 *
 * TABS in the copy spreadsheet (created automatically on first sync):
 *   master_mirror — raw dump of master data (overwritten each sync)
 *   soldiers      — curated columns only, app reads/writes here
 *
 * TIME TRIGGERS (set up in Apps Script > Triggers):
 *   syncFromMaster  — every 2 hours
 *   cleanupStale    — every 3 days (or weekly)
 */

// ─── Constants ───────────────────────────────────────────────────────

var ID_COL = 'מספר זהות';
var MIRROR_TAB = 'master_mirror';
var SOLDIERS_TAB = 'soldiers';
var LAST_SEEN_COL = '_lastSeenInMaster';
var LAST_APP_UPDATE_COL = '_lastAppUpdate';

/**
 * The columns we care about in the soldiers tab.
 * Must match the Hebrew column names from sheetFieldMap.js in the app.
 * If the master adds columns we don't list here, they stay in the mirror
 * but never reach the soldiers tab or the app. No breakage.
 */
var KNOWN_COLUMNS = [
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
  'אפיון חדר',
  'סטטוס חדר (מילוי אוטומטי: לא לגעת)',
  'מגדר חדר',
  'תאריך כניסה לבית (חתימת החוזה)',
  'מקום מגורים לפני הבית',
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
  'חודשי שרות',
  'טווח           חודשי שרות',
  'חודשים עד שחרור',
  'תאריך שחרור משוקלל',
  'קופת חולים לפני הצבא',
  'בעיות רפואיות',
  'אלרגיות',
  'אשפוזים',
  'טיפול פסיכיאטרי',
  'תרופות קבועות',
  'רמת ניקיון',
  'תרומות',
  'הערות'
];

// ─── Config helpers ──────────────────────────────────────────────────

function getProp(key) {
  return PropertiesService.getScriptProperties().getProperty(key);
}

function getCopySpreadsheet() {
  return SpreadsheetApp.openById(getProp('COPY_SPREADSHEET_ID'));
}

function getOrCreateTab(ss, tabName) {
  var sheet = ss.getSheetByName(tabName);
    if (!sheet) {
    sheet = ss.insertSheet(tabName);
  }
  return sheet;
}

function getMasterSheet() {
  var id = getProp('MASTER_SPREADSHEET_ID');
  var name = getProp('MASTER_SHEET_NAME');
  return SpreadsheetApp.openById(id).getSheetByName(name);
}

// ─── Helpers ─────────────────────────────────────────────────────────

function sheetToObjects(sheet) {
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return { headers: data[0] || [], rows: [] };
  var headers = data[0];
  var rows = data.slice(1).map(function(row, idx) {
    var obj = {};
    headers.forEach(function(h, i) { obj[h] = row[i]; });
    obj._rowIndex = idx + 2;
    return obj;
  });
  return { headers: headers, rows: rows };
}

function jsonResponse(obj) {
      return ContentService
    .createTextOutput(JSON.stringify(obj))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
function isCalculatedHeader(header) {
  if (!header) return false;
  var h = String(header);
  return h.indexOf('מילוי אוטומטי') !== -1 || h.indexOf('לא לגעת') !== -1;
}

function isErrorValue(val) {
  if (val == null) return false;
  var s = String(val);
  return s === '#ERROR!' || s === '#REF!' || s === '#N/A' || s === '#VALUE!'
      || s === '#DIV/0!' || s === '#NAME?' || s === '#NULL!' || s.indexOf('#ERROR') !== -1;
}

// ─── Web App entry points (app talks to soldiers tab only) ───────────

function doGet(e) {
  try {
    var action = e.parameter.action;
    var ss = getCopySpreadsheet();
    var sheet = ss.getSheetByName(SOLDIERS_TAB);
    if (!sheet) return jsonResponse({ success: false, error: 'soldiers tab not found. Run syncFromMaster first.' });
    
    switch (action) {
      case 'getAllSoldiers':
        return handleGetAllSoldiers(sheet);
      case 'searchSoldiers':
        return handleSearchSoldiers(sheet, e.parameter.searchTerm);
      case 'updateSoldierData':
        var data = JSON.parse(e.parameter.data || '{}');
        return handleUpdateSoldierData(sheet, data);
      default:
        return jsonResponse({ success: false, error: 'Unknown action: ' + action });
    }
  } catch (err) {
    console.error('doGet error:', err);
    return jsonResponse({ success: false, error: err.toString() });
  }
}

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var action = payload.action;
    var ss = getCopySpreadsheet();
    var sheet = ss.getSheetByName(SOLDIERS_TAB);
    if (!sheet) return jsonResponse({ success: false, error: 'soldiers tab not found. Run syncFromMaster first.' });
    
    switch (action) {
      case 'updateSoldierData':
        return handleUpdateSoldierData(sheet, payload.data);
      default:
        return jsonResponse({ success: false, error: 'Unknown action: ' + action });
    }
  } catch (err) {
    console.error('doPost error:', err);
    return jsonResponse({ success: false, error: err.toString() });
  }
}

// ─── GET handlers ────────────────────────────────────────────────────

function handleGetAllSoldiers(sheet) {
  var parsed = sheetToObjects(sheet);
  var soldiers = parsed.rows.map(function(r) { delete r._rowIndex; return r; });
  return jsonResponse({ success: true, soldiers: soldiers, count: soldiers.length });
}

function handleSearchSoldiers(sheet, searchTerm) {
    if (!searchTerm || searchTerm.length < 2) {
    return jsonResponse({ success: true, soldiers: [], count: 0 });
  }

  var parsed = sheetToObjects(sheet);
  var words = searchTerm.trim().replace(/\s+/g, ' ').split(' ').filter(Boolean);
  var fullNameCol = 'שם מלא                                  (מילוי אוטומטי: לא לגעת)';

  var filtered = parsed.rows.filter(function(soldier) {
    var fullName = String(soldier[fullNameCol] || '').replace(/\s+/g, ' ').trim();
    var nameWords = fullName.split(' ').filter(Boolean);
    return words.every(function(sw) {
      return nameWords.some(function(nw) { return nw.indexOf(sw) !== -1; });
    });
  });

  var results = filtered.map(function(r) { delete r._rowIndex; return r; });
  return jsonResponse({ success: true, soldiers: results, count: results.length });
}

// ─── POST handler: update soldier data ───────────────────────────────

function handleUpdateSoldierData(sheet, updateData) {
  var lookupId = String(updateData[ID_COL] || updateData.idNumber || '').trim();
  if (!lookupId) {
    return jsonResponse({ success: false, error: 'מספר זהות is required for update' });
  }

  var parsed = sheetToObjects(sheet);
  var headers = parsed.headers;

  var match = parsed.rows.filter(function(r) {
    return String(r[ID_COL] || '').trim() === lookupId;
  })[0];

  if (!match) {
    return jsonResponse({ success: false, error: 'Soldier not found for ID: ' + lookupId });
  }

  var rowNum = match._rowIndex;
  var updatedFields = [];

  Object.keys(updateData).forEach(function(key) {
    if (key === 'idNumber' || key === 'action' || key.charAt(0) === '_') return;
    var colIdx = headers.indexOf(key);
    if (colIdx === -1) return;
    if (isCalculatedHeader(key)) return;

    var newVal = updateData[key] != null ? updateData[key] : '';
    var curVal = match[key] != null ? match[key] : '';
    if (String(newVal) !== String(curVal)) {
      sheet.getRange(rowNum, colIdx + 1).setValue(newVal);
      updatedFields.push(key);
    }
  });

  // Update _lastAppUpdate timestamp
  var tsIdx = headers.indexOf(LAST_APP_UPDATE_COL);
  if (tsIdx === -1) {
    tsIdx = headers.length;
    sheet.getRange(1, tsIdx + 1).setValue(LAST_APP_UPDATE_COL);
  }
  sheet.getRange(rowNum, tsIdx + 1).setValue(new Date().toISOString());

  return jsonResponse({
    success: true,
    message: 'Updated ' + updatedFields.length + ' fields',
    updatedFields: updatedFields
  });
}

// =====================================================================
//  SCHEDULED: sync from master (run every 2 hours via time trigger)
// =====================================================================

function syncFromMaster() {
  var masterSheet = getMasterSheet();
  var ss = getCopySpreadsheet();
  var mirrorSheet = getOrCreateTab(ss, MIRROR_TAB);
  var soldiersSheet = getOrCreateTab(ss, SOLDIERS_TAB);

  // ── Step 1: dump master into master_mirror (full overwrite) ────────
  var masterData = masterSheet.getDataRange().getValues();
  mirrorSheet.clearContents();
  if (masterData.length > 0) {
    mirrorSheet.getRange(1, 1, masterData.length, masterData[0].length).setValues(masterData);
  }
  console.log('Mirror updated: ' + (masterData.length - 1) + ' rows from master');

  // ── Step 2: read mirror and soldiers ───────────────────────────────
  var mirrorParsed = sheetToObjects(mirrorSheet);
  var mirrorHeaders = mirrorParsed.headers;

  // Build the soldiers tab headers if the tab is empty
  var soldiersData = soldiersSheet.getDataRange().getValues();
  var soldiersIsEmpty = (soldiersData.length <= 1 && (!soldiersData[0] || soldiersData[0].every(function(c) { return !c; })));

  if (soldiersIsEmpty) {
    var soldiersHeaders = KNOWN_COLUMNS.concat([LAST_SEEN_COL, LAST_APP_UPDATE_COL]);
    soldiersSheet.getRange(1, 1, 1, soldiersHeaders.length).setValues([soldiersHeaders]);
    console.log('Soldiers tab initialized with ' + soldiersHeaders.length + ' columns');
  }

  var soldiersParsed = sheetToObjects(soldiersSheet);
  var sHeaders = soldiersParsed.headers;

  // Make sure tracking columns exist
  if (sHeaders.indexOf(LAST_SEEN_COL) === -1) {
    sHeaders.push(LAST_SEEN_COL);
    soldiersSheet.getRange(1, sHeaders.length).setValue(LAST_SEEN_COL);
  }
  if (sHeaders.indexOf(LAST_APP_UPDATE_COL) === -1) {
    sHeaders.push(LAST_APP_UPDATE_COL);
    soldiersSheet.getRange(1, sHeaders.length).setValue(LAST_APP_UPDATE_COL);
  }

  // Re-read soldiers after possible header changes
  soldiersParsed = sheetToObjects(soldiersSheet);
  sHeaders = soldiersParsed.headers;

  // Index soldiers rows by ID
  var soldiersById = {};
  soldiersParsed.rows.forEach(function(r) {
    var id = String(r[ID_COL] || '').trim();
    if (id) soldiersById[id] = r;
  });

  // Columns that exist in BOTH mirror and soldiers (the overlap we sync)
  var syncCols = sHeaders.filter(function(h) {
    return h !== LAST_SEEN_COL && h !== LAST_APP_UPDATE_COL && mirrorHeaders.indexOf(h) !== -1;
  });

  var seenColIdx = sHeaders.indexOf(LAST_SEEN_COL);
  var now = new Date().toISOString();
  var added = 0;
  var updated = 0;

  // ── Step 3: merge mirror → soldiers ────────────────────────────────
  for (var i = 0; i < mirrorParsed.rows.length; i++) {
    var masterRow = mirrorParsed.rows[i];
    var id = String(masterRow[ID_COL] || '').trim();
    if (!id) continue;

    var existing = soldiersById[id];

    if (!existing) {
      // New soldier — build a row for the soldiers tab
      var newRow = sHeaders.map(function(h) {
        if (h === LAST_SEEN_COL) return now;
        if (h === LAST_APP_UPDATE_COL) return '';
        var val = masterRow[h];
        return (val != null && val !== '' && !isErrorValue(val)) ? val : '';
      });
      soldiersSheet.appendRow(newRow);
      added++;
    } else {
      // Existing soldier — update overlapping columns with non-empty master values
      var rowNum = existing._rowIndex;
      for (var c = 0; c < syncCols.length; c++) {
        var col = syncCols[c];
        var masterVal = masterRow[col];
        if (masterVal == null || masterVal === '' || isErrorValue(masterVal)) continue;

        var currentVal = existing[col];
        if (String(masterVal) !== String(currentVal != null ? currentVal : '')) {
          var colIdx = sHeaders.indexOf(col);
          soldiersSheet.getRange(rowNum, colIdx + 1).setValue(masterVal);
        }
      }
      // Stamp _lastSeenInMaster
      soldiersSheet.getRange(rowNum, seenColIdx + 1).setValue(now);
      updated++;
    }
  }

  console.log('syncFromMaster complete: added=' + added + ', updated=' + updated);
}

// =====================================================================
//  SCHEDULED: cleanup stale soldiers (run every 3 days via time trigger)
// =====================================================================

function cleanupStale() {
  var ss = getCopySpreadsheet();
  var sheet = ss.getSheetByName(SOLDIERS_TAB);
  if (!sheet) { console.log('cleanupStale: soldiers tab not found'); return; }

  var parsed = sheetToObjects(sheet);
  var seenIdx = parsed.headers.indexOf(LAST_SEEN_COL);
  if (seenIdx === -1) { console.log('cleanupStale: no tracking column, skipping'); return; }

  var cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);

  var toDelete = [];
  parsed.rows.forEach(function(row) {
    var seen = row[LAST_SEEN_COL];
    if (!seen) return;
    var d = new Date(seen);
    if (isNaN(d.getTime())) return;
    if (d < cutoff) toDelete.push(row._rowIndex);
  });

  // Delete bottom-up so row numbers stay valid
  toDelete.sort(function(a, b) { return b - a; });
  toDelete.forEach(function(rowNum) { sheet.deleteRow(rowNum); });

  console.log('cleanupStale: deleted ' + toDelete.length + ' rows gone from master for 7+ days');
}

// ─── Manual test helpers ─────────────────────────────────────────────

function testSync() { syncFromMaster(); }
function testCleanup() { cleanupStale(); }
