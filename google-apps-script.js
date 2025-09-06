// Google Apps Script for Soldier Data Management
// This script should be deployed as a web app in Google Apps Script

/**
 * Handle GET requests to the web app
 * @param {Object} e - Event object with query parameters
 * @returns {Object} JSON response
 */
function doGet(e) {
  try {
    const action = e.parameter.action;
    const spreadsheetId = e.parameter.spreadsheetId;
    const sheetName = e.parameter.sheetName;
    
    if (!action || !spreadsheetId || !sheetName) {
      return ContentService
        .createTextOutput(JSON.stringify({
          success: false,
          error: 'Missing required parameters: action, spreadsheetId, sheetName'
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // Open the spreadsheet
    const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    const sheet = spreadsheet.getSheetByName(sheetName);
    
    if (!sheet) {
      return ContentService
        .createTextOutput(JSON.stringify({
          success: false,
          error: 'Sheet not found: ' + sheetName
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // Get all data from the sheet
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const rows = data.slice(1);
    
    // Convert rows to objects
    const soldiers = rows.map(row => {
      const soldier = {};
      headers.forEach((header, index) => {
        soldier[header] = row[index] || '';
      });
      return soldier;
    });
    
    switch (action) {
      case 'getAllSoldiers':
        return handleGetAllSoldiers(soldiers);
      
      case 'searchSoldiers':
        const searchTerm = e.parameter.searchTerm;
        return handleSearchSoldiers(soldiers, searchTerm);
      
      case 'getSoldierByName':
        const fullName = e.parameter.fullName;
        return handleGetSoldierByName(soldiers, fullName);
      
      default:
        return ContentService
          .createTextOutput(JSON.stringify({
            success: false,
            error: 'Unknown action: ' + action
          }))
          .setMimeType(ContentService.MimeType.JSON);
    }
    
  } catch (error) {
    console.error('Error in doGet:', error);
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: error.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Handle POST requests to the web app
 * @param {Object} e - Event object with post data
 * @returns {Object} JSON response
 */
function doPost(e) {
  try {
    const action = e.parameter.action;
    const spreadsheetId = e.parameter.spreadsheetId;
    const sheetName = e.parameter.sheetName;
    
    if (!action || !spreadsheetId || !sheetName) {
      return ContentService
        .createTextOutput(JSON.stringify({
          success: false,
          error: 'Missing required parameters: action, spreadsheetId, sheetName'
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // Open the spreadsheet
    const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    const sheet = spreadsheet.getSheetByName(sheetName);
    
    if (!sheet) {
      return ContentService
        .createTextOutput(JSON.stringify({
          success: false,
          error: 'Sheet not found: ' + sheetName
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    switch (action) {
      case 'updateSoldier':
        const soldierData = JSON.parse(e.parameter.data);
        return handleUpdateSoldier(sheet, soldierData);
      
      default:
        return ContentService
          .createTextOutput(JSON.stringify({
            success: false,
            error: 'Unknown action: ' + action
          }))
          .setMimeType(ContentService.MimeType.JSON);
    }
    
  } catch (error) {
    console.error('Error in doPost:', error);
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: error.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Handle getAllSoldiers action
 * @param {Array} soldiers - Array of soldier objects
 * @returns {Object} JSON response
 */
function handleGetAllSoldiers(soldiers) {
  try {
    return ContentService
      .createTextOutput(JSON.stringify({
        success: true,
        soldiers: soldiers,
        count: soldiers.length
      }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: 'Failed to get all soldiers: ' + error.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Handle searchSoldiers action
 * @param {Array} soldiers - Array of soldier objects
 * @param {string} searchTerm - Search term
 * @returns {Object} JSON response
 */
function handleSearchSoldiers(soldiers, searchTerm) {
  try {
    if (!searchTerm || searchTerm.length < 2) {
      return ContentService
        .createTextOutput(JSON.stringify({
          success: true,
          soldiers: [],
          count: 0
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // Don't use toLowerCase() for Hebrew text - it can cause issues
    const searchTrimmed = searchTerm.trim();
    const filteredSoldiers = soldiers.filter(soldier => {
      const fullName = (soldier['שם מלא                                  (מילוי אוטומטי: לא לגעת)'] || '').trim();
      
      // Since there's no separate first/last name columns, we only search in the full name
      // Normalize spaces in both search term and full name
      const normalizedSearch = searchTrimmed.replace(/\s+/g, ' ').trim();
      const normalizedFullName = fullName.replace(/\s+/g, ' ').trim();
      
      // Split search into words and check if all words appear in the full name
      const searchWords = normalizedSearch.split(/\s+/).filter(word => word.length > 0);
      const fullNameWords = normalizedFullName.split(/\s+/).filter(word => word.length > 0);
      
      // Check if all search words appear in the full name
      return searchWords.every(searchWord => 
        fullNameWords.some(nameWord => nameWord.includes(searchWord))
      );
    });
    
    return ContentService
      .createTextOutput(JSON.stringify({
        success: true,
        soldiers: filteredSoldiers,
        count: filteredSoldiers.length
      }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: 'Failed to search soldiers: ' + error.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Handle getSoldierByName action
 * @param {Array} soldiers - Array of soldier objects
 * @param {string} fullName - Full name to search for
 * @returns {Object} JSON response
 */
function handleGetSoldierByName(soldiers, fullName) {
  try {
    if (!fullName) {
      return ContentService
        .createTextOutput(JSON.stringify({
          success: false,
          error: 'Full name is required'
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    const soldier = soldiers.find(s => 
      (s['שם מלא                                  (מילוי אוטומטי: לא לגעת)'] || '').trim() === fullName.trim()
    );
    
    if (!soldier) {
      return ContentService
        .createTextOutput(JSON.stringify({
          success: false,
          error: 'Soldier not found'
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService
      .createTextOutput(JSON.stringify({
        success: true,
        soldier: soldier
      }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: 'Failed to get soldier by name: ' + error.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Handle updateSoldier action
 * @param {Sheet} sheet - Google Sheet object
 * @param {Object} soldierData - Updated soldier data
 * @returns {Object} JSON response
 */
function handleUpdateSoldier(sheet, soldierData) {
  try {
    if (!soldierData.fullName) {
      return ContentService
        .createTextOutput(JSON.stringify({
          success: false,
          error: 'Full name is required for update'
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // Get all data to find the row
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const rows = data.slice(1);
    
    // Find the row with matching full name
    const rowIndex = rows.findIndex(row => 
      (row[headers.indexOf('שם מלא')] || '').trim() === soldierData.fullName.trim()
    );
    
    if (rowIndex === -1) {
      return ContentService
        .createTextOutput(JSON.stringify({
          success: false,
          error: 'Soldier not found for update'
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // Update the row
    const actualRowIndex = rowIndex + 2; // +2 because we skipped header and arrays are 0-indexed
    const updateRow = [];
    
    headers.forEach(header => {
      updateRow.push(soldierData[header] || '');
    });
    
    sheet.getRange(actualRowIndex, 1, 1, updateRow.length).setValues([updateRow]);
    
    return ContentService
      .createTextOutput(JSON.stringify({
        success: true,
        message: 'Soldier updated successfully'
      }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: 'Failed to update soldier: ' + error.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Test function to verify the script works
 */
function testScript() {
  const testData = [
    {
      'שם מלא': 'יוחנן כהן',
      'שם פרטי': 'יוחנן',
      'שם משפחה': 'כהן',
      'חדר': '101',
      'בניין': 'א',
      'קומה': '1'
    },
    {
      'שם מלא': 'שרה לוי',
      'שם פרטי': 'שרה',
      'שם משפחה': 'לוי',
      'חדר': '202',
      'בניין': 'ב',
      'קומה': '2'
    }
  ];
  
  console.log('Testing searchSoldiers:');
  const searchResult = handleSearchSoldiers(testData, 'יוחנן');
  console.log(JSON.parse(searchResult.getContent()));
  
  console.log('Testing getSoldierByName:');
  const getResult = handleGetSoldierByName(testData, 'יוחנן כהן');
  console.log(JSON.parse(getResult.getContent()));
}
