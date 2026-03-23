/**
 * Reception Google Apps Script — Status Sync with BSB App
 *
 * Deploy as a Web App (Execute as: Me, Who has access: Anyone).
 *
 * SCRIPT PROPERTIES (Project Settings > Script Properties):
 *   WEBHOOK_URL    — e.g. https://your-app.vercel.app/api/status-webhook
 *   WEBHOOK_SECRET — shared secret matching STATUS_WEBHOOK_SECRET in the app's env
 *   SHEETS_BRIDGE_SECRET — shared secret matching app bridge env
 */

var SHEET_NAME = "Sheet1";

function getBridgeSecret() {
  return PropertiesService.getScriptProperties().getProperty('SHEETS_BRIDGE_SECRET');
}

function requestSecret(e, payload) {
  var fromQuery = e && e.parameter ? e.parameter.secret : '';
  if (fromQuery) return String(fromQuery);
  var fromPayload = payload && payload.secret ? payload.secret : '';
  return String(fromPayload || '');
}

function isAuthorized(e, payload) {
  var expected = String(getBridgeSecret() || '');
  if (!expected) return false;
  return requestSecret(e, payload) === expected;
}

function doGet(e) {
  if (!isAuthorized(e, null)) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Unauthorized" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  var data = sheet.getDataRange().getValues();
  var rows = data.slice(1);

  var result = rows.map(function(row) {
    return {
      id: row[0],
      firstName: row[1],
      surname: row[2],
      room: row[3],
      status: row[4]
    };
  });

  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    var params = JSON.parse(e.postData.contents);
    if (!isAuthorized(e, params)) {
      return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Unauthorized" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var targetId = params.id;
    var newStatus = params.status;

    var data = sheet.getDataRange().getValues();

    for (var i = 1; i < data.length; i++) {
      if (data[i][0] == targetId) {
        sheet.getRange(i + 1, 5).setValue(newStatus);

        notifyApp(data[i][3], newStatus);

        return ContentService.createTextOutput(JSON.stringify({
          status: "success", id: targetId, new_val: newStatus
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: "error", message: "ID not found"
    })).setMimeType(ContentService.MimeType.JSON);

  } catch(error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error", message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Notify the BSB app about a status change so Firestore stays in sync.
 * Uses UrlFetchApp to POST to the app's webhook endpoint.
 */
function notifyApp(room, status) {
  var webhookUrl = PropertiesService.getScriptProperties().getProperty('WEBHOOK_URL');
  var webhookSecret = PropertiesService.getScriptProperties().getProperty('WEBHOOK_SECRET');

  if (!webhookUrl) return;

  try {
    UrlFetchApp.fetch(webhookUrl, {
      method: "post",
      contentType: "application/json",
      headers: { "x-webhook-secret": webhookSecret || "" },
      payload: JSON.stringify({ room: String(room), status: String(status) }),
      muteHttpExceptions: true
    });
  } catch (err) {
    console.error("notifyApp failed:", err);
  }
}
